const { createClient } = require('@supabase/supabase-js');
const supabase = require('./supabase');
require('dotenv').config({ path: __dirname + '/../../.env' });

// Middleware: validate JWT or API key
async function verifyRequest(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];

  if (apiKey) {
    // API Key auth
    const crypto = require('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const { data, error } = await supabase
      .from('kv_api_keys')
      .select('user_id')
      .eq('key_hash', keyHash)
      .single();

    if (error || !data) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.userId = data.user_id;
    req.db = supabase; // Legacy API keys remain limited to owner-filtered Knowledge routes.
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token' });
  }

  const token = authHeader.replace('Bearer ', '');

  // Verify JWT with Supabase
  const userSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error } = await userSupabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = user.id;
  req.user = user;
  // Use the verified user's JWT for every API database/storage request; workers
  // retain their separate service client. Never expose that client via Family Hub.
  req.db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  next();
}

async function authMiddleware(req,res,next) {
  try { await verifyRequest(req,res,next); }
  catch { res.status(503).json({ error:'Authentication service unavailable' }); }
}
module.exports = { authMiddleware };
