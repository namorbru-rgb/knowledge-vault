import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {setup} from './helpers/database.mjs'
import {validPushEndpoint,parseProposal} from '../supabase/functions/family-api/guards.mjs'
const A='00000000-0000-4000-8000-000000000001',S='00000000-0000-4000-8000-000000000031',P='00000000-0000-4000-8000-000000000011'
test('push endpoint isolation and extraction proposal validation',()=>{
 assert.equal(validPushEndpoint('https://fcm.googleapis.com/wpush/test'),true)
 assert.equal(validPushEndpoint('http://127.0.0.1/internal'),false)
 assert.equal(validPushEndpoint('https://attacker.invalid/test'),false)
 assert.equal(validPushEndpoint('https://fcm.googleapis.com:8443/test'),false)
 assert.throws(()=>parseProposal('{"fields":[],"confidence":1}'))
})
test('live-session revocation, push queue deduplication, leases, retries and opt-out',async()=>{
 const db=await setup();try{
  await db.exec(`alter table auth.users add banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create schema vault;create table vault.decrypted_secrets(name text,decrypted_secret text);
  insert into auth.sessions values('${S}','${A}',null);`)
  await db.exec(await readFile(new URL('../supabase/migrations/20261013200054_family_hub_runtime.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20261013201144_family_hub_rpc_hardening.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20261013202206_family_hub_extraction_limits.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/20261013202642_knowledge_media_owner_paths.sql',import.meta.url),'utf8'))
  await db.exec(`select set_config('request.jwt.claim.sub','${A}',false);select set_config('request.jwt.claims','{"session_id":"${S}"}',false);set role authenticated;`)
  assert.equal((await db.query('select fh_session_active() as active')).rows[0].active,true)
  await assert.rejects(db.query(`insert into kv_photos(user_id,storage_path) values('${A}','other-user/private.jpg')`))
  await assert.rejects(db.query(`insert into kv_photos(user_id,storage_path) values('${A}','${A}/../other-user/private.jpg')`))
  await assert.rejects(db.query(`insert into kv_photos(user_id,storage_path) values('${A}','${A}/%2e%2e/other-user/private.jpg')`))
  await db.exec(`update kv_persons set fh_kind='self' where id='${P}';insert into fh_push_subscriptions(user_id,endpoint,p256dh,auth)values('${A}','https://fcm.googleapis.com/test','${'a'.repeat(87)}','${'b'.repeat(22)}');`)
  const id=(await db.query(`insert into fh_resources(owner_id,person_id,kind,title,occurred_at) values('${A}','${P}','reminder','Synthetic','2026-10-13T08:00:00Z') returning id`)).rows[0].id
  await assert.rejects(db.query('select fh_queue_reminders()'),/permission denied/)
  await db.exec('reset role')
  assert.equal((await db.query(`select fh_queue_reminders('2026-10-13T08:01:00Z') as n`)).rows[0].n,1)
  assert.equal((await db.query(`select fh_queue_reminders('2026-10-13T08:01:00Z') as n`)).rows[0].n,0)
  const job=(await db.query('select * from fh_claim_push()')).rows[0]
  assert.ok(job.id);assert.equal((await db.query('select * from fh_claim_push()')).rows.length,0)
  await db.query(`select fh_finish_push('${job.id}',false,false)`)
  await db.query(`update fh_private.push_outbox set next_try_at=now()-interval '1 minute'`)
  assert.equal((await db.query('select * from fh_claim_push()')).rows.length,1)
  await db.query(`select fh_finish_push('${job.id}',true,false)`)
  assert.equal((await db.query('select state from fh_private.push_outbox')).rows[0].state,'sent')
  await db.query(`insert into fh_resources(owner_id,person_id,kind,title,occurred_at,details)values('${A}','${P}','reminder','Opted out','2026-10-13T08:00:00Z','{"notify":false}')`)
  assert.equal((await db.query(`select fh_queue_reminders('2026-10-13T08:01:00Z') as n`)).rows[0].n,0)
  const reservation=(await db.query(`select fh_begin_extraction('${A}') as id`)).rows[0].id
  assert.ok(reservation)
  assert.equal((await db.query(`select fh_begin_extraction('${A}') as id`)).rows[0].id,null,'concurrent extraction is denied')
  await db.query(`select fh_end_extraction('${reservation}')`)
  await db.query(`delete from auth.sessions where id='${S}'`)
  assert.equal((await db.query('select * from fh_push_subscriptions')).rows.length,0,'revoking a session also stops its device notifications')
  await db.exec('set role authenticated')
  assert.equal((await db.query('select fh_session_active() as active')).rows[0].active,false)
  assert.equal((await db.query('select * from kv_notes')).rows.length,0)
  await assert.rejects(db.query(`select fh_create_family('Forged','Revoked')`),/Active personal session required/)
 }finally{await db.close()}
})
