require('dotenv').config({ path: __dirname + '/../../.env' });
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const axios = require('axios');
const supabase = require('../supabase');
const { getEmbedding } = require('../embeddings');
const execAsync = promisify(exec);

const WHISPER_PATH = process.env.WHISPER_PATH || 'whisper';
const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const FB_COOKIES_FILE = process.env.FB_COOKIES_FILE || '';
const WORK_DIR = '/tmp/kv-video-work';
const MAX_RETRIES = 3;

if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true });

// Facebook-Share-Links (facebook.com/share/v/..., /share/r/...) sind nur
// Redirects. yt-dlp scheitert daran oft — vorher den finalen URL auflösen.
async function resolveShareUrl(url) {
  if (!/^https?:\/\/(?:www\.|m\.)?facebook\.com\/share\//i.test(url)) return url;
  try {
    const res = await axios.get(url, {
      maxRedirects: 10,
      timeout: 15000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      },
    });
    const finalUrl = res.request?.res?.responseUrl || res.config?.url || url;
    if (finalUrl && finalUrl !== url) {
      console.log('Resolved share URL:', url, '->', finalUrl);
    }
    return finalUrl || url;
  } catch (e) {
    console.warn('Share URL resolve failed:', url, e.message);
    return url;
  }
}

function cookiesArg() {
  if (!FB_COOKIES_FILE) return '';
  if (!fs.existsSync(FB_COOKIES_FILE)) {
    console.warn('FB_COOKIES_FILE gesetzt, aber Datei fehlt:', FB_COOKIES_FILE);
    return '';
  }
  return `--cookies "${FB_COOKIES_FILE}"`;
}

async function processVideo(video) {
  console.log('Processing video:', video.id, video.url);
  const workDir = path.join(WORK_DIR, video.id);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    await supabase.from('kv_videos').update({ transcript_status: 'processing' }).eq('id', video.id);

    const sourceUrl = await resolveShareUrl(video.url);
    const cookies = cookiesArg();

    // 1. Download video info
    const { stdout: infoJson } = await execAsync(
      `${YTDLP_PATH} ${cookies} --dump-json --no-playlist "${sourceUrl}"`,
      { timeout: 30000 }
    );
    const info = JSON.parse(infoJson);
    const description = info.description || '';
    // yt-dlp setzt bei Facebook-Videos oft "241K views · 4.8K reactions"
    // als Title. Falls das so aussieht, lieber erste Zeile der
    // Description nehmen (= eigentlicher Caption-Text).
    const rawTitle = (info.title || '').trim();
    const isStatsTitle = /^\d+([.,]\d+)?\s*[KMB]?\s*(views?|aufrufe)\b/i.test(rawTitle)
      || /\breactions?\b|\breaktionen\b/i.test(rawTitle);
    let title = rawTitle || video.url;
    if (isStatsTitle && description) {
      const firstLine = description.split(/\r?\n/).map(s => s.trim()).find(Boolean);
      if (firstLine) title = firstLine.slice(0, 200);
    }
    const duration = info.duration || 0;
    const thumbnail = info.thumbnail || '';

    // 2. Download audio
    const audioFile = path.join(workDir, 'audio.mp3');
    await execAsync(
      `${YTDLP_PATH} ${cookies} -x --audio-format mp3 --audio-quality 0 -o "${audioFile}" "${sourceUrl}"`,
      { timeout: 600000 }
    );

    // 3. Transcribe with Whisper
    await execAsync(
      `${WHISPER_PATH} "${audioFile}" --model small --output_format json --output_dir "${workDir}"`,
      { timeout: 1200000 }
    );

    // 4. Parse transcript
    const transcriptFile = path.join(workDir, 'audio.json');
    if (!fs.existsSync(transcriptFile)) throw new Error('Whisper output not found');
    const transcript = JSON.parse(fs.readFileSync(transcriptFile, 'utf8'));

    // 5. Update video record
    await supabase.from('kv_videos').update({
      title,
      description: description.slice(0, 2000),
      duration_seconds: Math.round(duration),
      thumbnail_url: thumbnail,
      transcript_status: 'done',
      transcript_error: null
    }).eq('id', video.id);

    // 6. Store segments with embeddings
    const segments = transcript.segments || [];
    for (const seg of segments) {
      const embedding = await getEmbedding(seg.text);
      await supabase.from('kv_video_segments').insert({
        video_id: video.id,
        user_id: video.user_id,
        start_time: seg.start,
        end_time: seg.end,
        text: seg.text,
        embedding
      });
    }

    console.log('Video processed:', video.id, 'segments:', segments.length);
  } catch (err) {
    const newCount = (video.transcript_retry_count || 0) + 1;
    const giveUp = newCount >= MAX_RETRIES;
    console.error('Video processing error:', video.id, `(Versuch ${newCount}/${MAX_RETRIES})`, err.message);
    await supabase.from('kv_videos').update({
      transcript_status: giveUp ? 'error' : 'pending',
      transcript_retry_count: newCount,
      transcript_error: (err.message || 'Unbekannter Fehler').slice(0, 500),
    }).eq('id', video.id);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function runWorker() {
  // Holt offene Videos: alles 'pending' und alles 'error', das noch
  // Versuche übrig hat. So werden bestehende Fehler-Einträge nach dem
  // Hinzufügen des retry_count-Feldes automatisch nachgeholt.
  const { data: pendingVideos } = await supabase
    .from('kv_videos')
    .select('*')
    .or(`transcript_status.eq.pending,and(transcript_status.eq.error,transcript_retry_count.lt.${MAX_RETRIES})`)
    .limit(3);

  if (pendingVideos && pendingVideos.length > 0) {
    for (const video of pendingVideos) {
      await processVideo(video);
    }
  }
}

// Run every 30 seconds
runWorker();
setInterval(runWorker, 30000);
console.log('Video worker started');
