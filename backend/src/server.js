require('dotenv').config({ path: __dirname + '/../.env' });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const supabase = require('./supabase');
const { authMiddleware } = require('./auth');
const { getEmbedding } = require('./embeddings');
const app = express();
const PORT = process.env.KV_PORT || 3100;
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/kv-uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });
app.use(cors({ origin: ['https://namorbru-rgb.github.io', 'http://localhost:5173'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
// VIDEOS
app.post('/api/videos', authMiddleware, async (req, res) => {
  const { url, title } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  const { data, error } = await supabase.from('kv_videos')
    .insert({ user_id: req.userId, url, title: title || url, transcript_status: 'pending' })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.get('/api/videos', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('kv_videos')
    .select('*').eq('user_id', req.userId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.get('/api/videos/:id', authMiddleware, async (req, res) => {
  const { data: video, error } = await supabase.from('kv_videos')
    .select('*').eq('id', req.params.id).eq('user_id', req.userId).single();
  if (error || !video) return res.status(404).json({ error: 'Not found' });
  const { data: segments } = await supabase.from('kv_video_segments')
    .select('id, start_time, end_time, text').eq('video_id', req.params.id).order('start_time');
  res.json({ ...video, segments: segments || [] });
});
app.delete('/api/videos/:id', authMiddleware, async (req, res) => {
  const { error } = await supabase.from('kv_videos').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
// LINKS
app.post('/api/links', authMiddleware, async (req, res) => {
  const { url, title } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  const { data, error } = await supabase.from('kv_links')
    .insert({ user_id: req.userId, url, title: title || url, status: 'pending' })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.get('/api/links', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('kv_links')
    .select('*').eq('user_id', req.userId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.get('/api/links/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('kv_links')
    .select('*').eq('id', req.params.id).eq('user_id', req.userId).single();
  if (error || !data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});
app.delete('/api/links/:id', authMiddleware, async (req, res) => {
  const { error } = await supabase.from('kv_links').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
// PHOTOS
app.post('/api/photos', authMiddleware, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileBuffer = fs.readFileSync(req.file.path);
  const storagePath = 'photos/' + req.userId + '/' + req.file.filename;
  const { error: uploadError } = await supabase.storage
    .from('kv-media').upload(storagePath, fileBuffer, { contentType: req.file.mimetype });
  if (uploadError) console.error('Storage error:', uploadError.message);
  fs.unlinkSync(req.file.path);
  const { data, error } = await supabase.from('kv_photos')
    .insert({ user_id: req.userId, storage_path: storagePath, filename: req.file.originalname, status: 'pending' })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.get('/api/photos', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('kv_photos')
    .select('*').eq('user_id', req.userId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const withUrls = (data || []).map(p => {
    if (p.storage_path) {
      const { data: u } = supabase.storage.from('kv-media').getPublicUrl(p.storage_path);
      return { ...p, public_url: u?.publicUrl };
    }
    return p;
  });
  res.json(withUrls);
});
app.delete('/api/photos/:id', authMiddleware, async (req, res) => {
  const { error } = await supabase.from('kv_photos').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
// NOTES
app.post('/api/notes', authMiddleware, async (req, res) => {
  const { content, video_id, link_id, photo_id } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const { data, error } = await supabase.from('kv_notes')
    .insert({ user_id: req.userId, content, video_id, link_id, photo_id })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  getEmbedding(content).then(async (emb) => {
    if (emb) await supabase.from('kv_notes').update({ embedding: emb }).eq('id', data.id);
  });
  res.json(data);
});
app.get('/api/notes', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('kv_notes')
    .select('*').eq('user_id', req.userId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.put('/api/notes/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('kv_notes')
    .update({ content: req.body.content }).eq('id', req.params.id).eq('user_id', req.userId).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.delete('/api/notes/:id', authMiddleware, async (req, res) => {
  const { error } = await supabase.from('kv_notes').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
// SEARCH
app.post('/api/search', authMiddleware, async (req, res) => {
  const { query, types, limit = 20 } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });
  try {
    const embedding = await getEmbedding(query);
    if (embedding) {
      const { data, error } = await supabase.rpc('kv_search_similar', {
        query_embedding: embedding, match_threshold: 0.6, match_count: limit, p_user_id: req.userId
      });
      if (!error && data) return res.json({ results: data, mode: 'semantic' });
    }
    const results = [];
    const st = types || ['videos', 'links', 'notes', 'photos'];
    const q = query;
    if (st.includes('videos')) {
      const { data } = await supabase.from('kv_videos').select('id, title, description, url, created_at')
        .eq('user_id', req.userId).or(`title.ilike.%${q}%,description.ilike.%${q}%`).limit(5);
      if (data) results.push(...data.map(d => ({ ...d, type: 'video' })));
    }
    if (st.includes('links')) {
      const { data } = await supabase.from('kv_links').select('id, title, description, url, summary, tags, created_at')
        .eq('user_id', req.userId).or(`title.ilike.%${q}%,description.ilike.%${q}%`).limit(5);
      if (data) results.push(...data.map(d => ({ ...d, type: 'link' })));
    }
    if (st.includes('notes')) {
      const { data } = await supabase.from('kv_notes').select('id, content, created_at')
        .eq('user_id', req.userId).ilike('content', `%${q}%`).limit(5);
      if (data) results.push(...data.map(d => ({ ...d, type: 'note', title: d.content.slice(0, 60) })));
    }
    if (st.includes('photos')) {
      const { data } = await supabase.from('kv_photos').select('id, filename, description, ocr_text, created_at')
        .eq('user_id', req.userId).or(`filename.ilike.%${q}%,description.ilike.%${q}%`).limit(5);
      if (data) results.push(...data.map(d => ({ ...d, type: 'photo', title: d.filename })));
    }
    res.json({ results, mode: 'text' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// STATS
app.get('/api/stats', authMiddleware, async (req, res) => {
  const [v, l, p, n] = await Promise.all([
    supabase.from('kv_videos').select('id', { count: 'exact', head: true }).eq('user_id', req.userId),
    supabase.from('kv_links').select('id', { count: 'exact', head: true }).eq('user_id', req.userId),
    supabase.from('kv_photos').select('id', { count: 'exact', head: true }).eq('user_id', req.userId),
    supabase.from('kv_notes').select('id', { count: 'exact', head: true }).eq('user_id', req.userId),
  ]);
  res.json({ videos: v.count || 0, links: l.count || 0, photos: p.count || 0, notes: n.count || 0 });
});
// API KEYS
app.post('/api/keys', authMiddleware, async (req, res) => {
  const key = 'kv_' + uuidv4().replace(/-/g, '');
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const { data, error } = await supabase.from('kv_api_keys')
    .insert({ user_id: req.userId, key_hash: keyHash, name: req.body.name }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...data, key });
});
app.get('/api/keys', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('kv_api_keys')
    .select('id, name, created_at').eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
app.delete('/api/keys/:id', authMiddleware, async (req, res) => {
  const { error } = await supabase.from('kv_api_keys').delete().eq('id', req.params.id).eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
app.listen(PORT, '0.0.0.0', () => {
  console.log('KnowledgeVault API running on port ' + PORT);
});
module.exports = app;
