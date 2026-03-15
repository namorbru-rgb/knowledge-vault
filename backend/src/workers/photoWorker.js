require('dotenv').config({ path: __dirname + '/../../.env' });
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const supabase = require('../supabase');
const { getEmbedding } = require('../embeddings');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function analyzePhoto(photo) {
  console.log('Processing photo:', photo.id);
  try {
    await supabase.from('kv_photos').update({ status: 'processing' }).eq('id', photo.id);

    // Download from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('kv-media').download(photo.storage_path);
    if (downloadError) throw new Error(downloadError.message);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = photo.storage_path.match(/\.(jpg|jpeg)$/i) ? 'image/jpeg' :
      photo.storage_path.match(/\.png$/i) ? 'image/png' : 'image/jpeg';

    // Analyze with Claude Haiku
    const response = await anthropic.messages.create({
      model: 'claude-haiku-20240307',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: base64 }
        }, {
          type: 'text',
          text: 'Describe this image in detail. List objects detected and any visible text. Respond as JSON: {"description": "...", "objects": ["obj1", "obj2"], "ocr_text": "visible text here"}'
        }]
      }]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{.*\}/s);
    let description = '', objects = [], ocrText = '';
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      description = parsed.description || '';
      objects = parsed.objects || [];
      ocrText = parsed.ocr_text || '';
    }

    const embText = `${photo.filename}\n${description}\n${ocrText}`;
    const embedding = await getEmbedding(embText);

    await supabase.from('kv_photos').update({
      description,
      objects_detected: objects,
      ocr_text: ocrText,
      embedding,
      status: 'done'
    }).eq('id', photo.id);

    console.log('Photo processed:', photo.id);
  } catch (err) {
    console.error('Photo processing error:', photo.id, err.message);
    await supabase.from('kv_photos').update({ status: 'error' }).eq('id', photo.id);
  }
}

async function runWorker() {
  const { data: pendingPhotos } = await supabase
    .from('kv_photos').select('*').eq('status', 'pending').limit(5);
  if (pendingPhotos && pendingPhotos.length > 0) {
    for (const photo of pendingPhotos) {
      await analyzePhoto(photo);
    }
  }
}

runWorker();
setInterval(runWorker, 20000);
console.log('Photo worker started');
