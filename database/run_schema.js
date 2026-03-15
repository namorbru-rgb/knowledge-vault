#!/usr/bin/env node
// Run this script to apply the schema via Supabase Management API
// Usage: node run_schema.js

const fs = require('fs');
const https = require('https');

const SUPABASE_ACCESS_TOKEN = 'sbp_c750f3b8c0e6515f346cc9ba01e150b9b1d05ac9';
const PROJECT_REF = 'nixakeaiibzhesdwtelw';

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
