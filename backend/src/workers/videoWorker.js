require('dotenv').config({ path: __dirname + '/../../.env' });
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const supabase = require('../supabase');
const { getEmbedding } = require('../embeddings');
const execAsync = promisify(exec);

const WHISPER_PATH = process.env.WHISPER_PATH || 'whisper';
const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const WORK_DIR = '/tmp/kv-video-work';

if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true });

async function processVideo(video) {
  console.log('Processing video:', video.id, video.url);
  const workDir = path.join(WORK_DIR, video.id);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    await supabase.from('kv_videos').update({ transcript_status: 'processing' }).eq('id', video.id);

    // 1. Download video info
    const { stdout: infoJson } = await execAsync(
      `${YTDLP_PATH} --dump-json --no-playlist "${video.url}"`,
      { timeout: 30000 }
    );
    const info = JSON.parse(infoJson);
    const title = info.title || video.url;
    const description = info.description || '';
    const duration = info.duration || 0;
    const thumbnail = info.thumbnail || '';

    // 2. Download audio
    const audioFile = path.join(workDir, 'audio.mp3');
    await execAsync(
      `${YTDLP_PATH} -x --audio-format mp3 --audio-quality 0 -o "${audioFile}" "${video.url}"`,
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
      transcript_status: 'done'
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
    console.error('Video processing error:', video.id, err.message);
    await supabase.from('kv_videos').update({ transcript_status: 'error' }).eq('id', video.id);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function runWorker() {
  const { data: pendingVideos } = await supabase
    .from('kv_videos')
    .select('*')
    .eq('transcript_status', 'pending')
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
