const express = require('express');
const { authMiddleware } = require('./auth');
const kinds = new Set(['symptom','case','visit','hospital','examination','prescription','medication','nutrition','reminder']);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function validateResource(body, updating = false) {
  const allowed = updating ? ['title','occurred_at','details','intensity','expires_on'] : ['person_id','kind','title','occurred_at','details','intensity','expires_on'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) return 'Unsupported fields';
  if (!updating && (!uuid(body.person_id) || !kinds.has(body.kind))) return 'Invalid person or kind';
  if ((!updating || 'title' in body) && (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200)) return 'Invalid title';
  if ('intensity' in body && body.intensity !== null && (!Number.isInteger(body.intensity) || body.intensity < 0 || body.intensity > 10)) return 'Invalid intensity';
  if ('occurred_at' in body && (typeof body.occurred_at !== 'string' || !Number.isFinite(Date.parse(body.occurred_at)))) return 'Invalid date';
  if ('details' in body && (!body.details || typeof body.details !== 'object' || Array.isArray(body.details) || JSON.stringify(body.details).length > 20000)) return 'Invalid details';
  return null;
}
function createRouter(authenticate = authMiddleware) {
const router = express.Router();
const extractionWindows = new Map();
let activeExtractions=0;
router.use(authenticate);
// Legacy Knowledge API keys have no sensitive-data scopes. Never silently elevate them.
router.use((req,res,next) => {
  res.set('Cache-Control','no-store');
  if (!req.user || !req.db) return res.status(403).json({ error: 'Personal user session required for Family Hub' });
  next();
});
const route = handler => async (req,res,next) => { try { await handler(req,res) } catch(e) { next(e) } };
const fail = (res,error) => res.status(400).json({ error: 'Request rejected', code: error.code });
router.get('/resources', route(async (req,res) => {
  const { data,error } = await req.db.from('fh_resources').select('*').order('occurred_at',{ ascending:false }).limit(500);
  if (error) return fail(res,error); res.json(data);
}));
router.post('/resources', route(async (req,res) => {
  const errorMessage=validateResource(req.body); if (errorMessage) return res.status(400).json({ error:errorMessage });
  const { data,error } = await req.db.from('fh_resources').insert({ ...req.body, owner_id:req.userId }).select().single();
  if (error) return fail(res,error); res.status(201).json(data);
}));
router.patch('/resources/:id', route(async (req,res) => {
  const errorMessage=validateResource(req.body,true); if (errorMessage || !uuid(req.params.id)) return res.status(400).json({ error:errorMessage || 'Invalid id' });
  // Explicit backend check in addition to UPDATE RLS.
  const { data:row }=await req.db.from('fh_resources').select('id,owner_id').eq('id',req.params.id).maybeSingle();
  if (!row) return res.status(404).json({ error:'Not found' });
  if (row.owner_id!==req.userId) {
    const { data:grant }=await req.db.from('fh_grants').select('permission').eq('resource_id',row.id).eq('recipient_id',req.userId).maybeSingle();
    if (grant?.permission!=='edit') return res.status(403).json({ error:'Edit permission required' });
  }
  const { data,error }=await req.db.from('fh_resources').update(req.body).eq('id',row.id).select().single();
  if (error) return fail(res,error); res.json(data);
}));
router.post('/documents/:id/url', route(async (req,res) => {
  if (!uuid(req.params.id)) return res.status(400).json({ error:'Invalid id' });
  const { data:row }=await req.db.from('fh_resources').select('id,storage_path').eq('id',req.params.id).eq('kind','document').maybeSingle();
  if (!row) return res.status(404).json({ error:'Not found' });
  const { data,error }=await req.db.storage.from('fh-vault').createSignedUrl(row.storage_path,60);
  if (error) return fail(res,error);
  const { error:auditError }=await req.db.rpc('fh_record_open',{ p_id:row.id });
  if (auditError) return fail(res,auditError);
  res.json({ url:data.signedUrl, expires_in:60 });
}));
router.post('/documents/:id/extraction', route(async (req,res) => {
  if (!uuid(req.params.id) || req.body.consent!==true) return res.status(400).json({ error:'Explicit consent required' });
  const { data:row }=await req.db.from('fh_resources').select('*').eq('id',req.params.id).eq('kind','document').eq('owner_id',req.userId).maybeSingle();
  if (!row) return res.status(404).json({ error:'Not found' });
  if (!process.env.FAMILY_EXTRACTION_MODEL || !process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error:'Extraction provider is not configured' });
  const now=Date.now();
  for (const [key,value] of extractionWindows) if (now-value.start>3600000) extractionWindows.delete(key);
  const window=extractionWindows.get(req.userId) || { start:now,count:0,active:false };
  if (window.count>=3 || window.active || activeExtractions>=3 || (!extractionWindows.has(req.userId) && extractionWindows.size>=1000)) return res.status(429).json({ error:'Extraction limit reached. Try later.' });
  window.count++;window.active=true;extractionWindows.set(req.userId,window);activeExtractions++;
  try {
  const { data:file,error }=await req.db.storage.from('fh-vault').download(row.storage_path);
  if (error) return fail(res,error);
  const proposal=await require('./extraction').extract(file,row);
  // The service client can only insert a suggestion for the verified owner/file.
  // Model output never determines the target resource, table or action.
  const { data:suggestion,error:saveError }=await require('./supabase').from('fh_extractions').insert({ document_id:row.id,...proposal }).select('id').single();
  if (saveError) return fail(res,saveError); res.status(201).json(suggestion);
  } finally { window.active=false;activeExtractions--; }
}));
router.post('/resources/:id/grants', route(async (req,res) => {
  if (!uuid(req.params.id) || !uuid(req.body.recipient_id) || !['read','edit'].includes(req.body.permission)) return res.status(400).json({ error:'Invalid grant' });
  const { data:owner }=await req.db.from('fh_resources').select('id').eq('id',req.params.id).eq('owner_id',req.userId).maybeSingle();
  if (!owner) return res.status(404).json({ error:'Not found' });
  const { error }=await req.db.from('fh_grants').upsert({ resource_id:owner.id,recipient_id:req.body.recipient_id,permission:req.body.permission });
  if (error) return fail(res,error); res.status(201).json({ success:true });
}));
router.delete('/resources/:id/grants/:recipient', route(async (req,res) => {
  if (!uuid(req.params.id) || !uuid(req.params.recipient)) return res.status(400).json({ error:'Invalid id' });
  const { data:owner }=await req.db.from('fh_resources').select('id').eq('id',req.params.id).eq('owner_id',req.userId).maybeSingle();
  if (!owner) return res.status(404).json({ error:'Not found' });
  const { error }=await req.db.from('fh_grants').delete().eq('resource_id',owner.id).eq('recipient_id',req.params.recipient);
  if (error) return fail(res,error); res.json({ success:true });
}));
router.use((err,req,res,next) => { res.status(500).json({ error:'Family Hub request failed' }); });
return router;
}
module.exports = { router:createRouter(), createRouter, validateResource };
