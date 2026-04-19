#!/usr/bin/env node
// Run this script to apply the schema via Supabase Management API
// Usage: node run_schema.js

const fs = require('fs');
const https = require('https');

// Usage: SUPABASE_ACCESS_TOKEN=sbp_... node run_schema.js
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'nixakeaiibzhesdwtelw';

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN environment variable is required.');
  console.error('   Create a token at https://app.supabase.com/account/tokens');
  process.exit(1);
}

const sql = fs.readFileSync(__dirname + '/schema.sql', 'utf8');

const data = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ Schema applied successfully!');
    } else {
      console.error('❌ Error:', res.statusCode, body);
      console.log('👉 Please run schema.sql manually in the Supabase SQL Editor:');
      console.log('   https://app.supabase.com/project/nixakeaiibzhesdwtelw/sql');
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(data);
req.end();
