import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {setup} from './helpers/database.mjs'

const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', C='00000000-0000-4000-8000-000000000003'
const P='00000000-0000-4000-8000-000000000011', PB='00000000-0000-4000-8000-000000000012', R='00000000-0000-4000-8000-000000000021', D='00000000-0000-4000-8000-000000000022'
async function asUser(db,id,sql) { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id || ''}',false); set role ${id ? 'authenticated' : 'anon'}`); return db.query(sql) }
test('migration and real PostgreSQL RLS: owner, stranger, admin, explicit grants, immutability, audit', async () => {
  const db=await setup()
  try {
    assert.equal((await asUser(db,A,'select * from kv_notes')).rows.length,1)
    await assert.rejects(asUser(db,null,'select * from kv_notes'),/permission denied/)
    await asUser(db,A,`update kv_persons set fh_kind='self' where id='${P}'`)
    await asUser(db,B,`update kv_persons set fh_kind='self' where id='${PB}'`)
    await assert.rejects(asUser(db,A,`insert into fh_resources(person_id,owner_id,kind,title) values('${PB}','${A}','symptom','Forged owner')`))
    await asUser(db,A,`insert into fh_resources(id,person_id,owner_id,kind,title,intensity) values('${R}','${P}','${A}','symptom','Synthetic symptom',5)`)
    await assert.rejects(asUser(db,A,`insert into fh_resources(person_id,owner_id,kind,title,intensity) values('${P}','${A}','symptom','Invalid',11)`))
    const fid=(await asUser(db,A,`select fh_create_family('Synthetic family','Synthetic A') as id`)).rows[0].id
    await asUser(db,A,`select fh_add_member('${fid}','${B}','Synthetic admin','admin')`)
    assert.equal((await asUser(db,B,`select * from fh_resources`)).rows.length,0,'admin does not inherit private data')
    await assert.rejects(asUser(db,C,`select fh_add_member('${fid}','${C}','Forged admin','admin')`))
    assert.equal((await asUser(db,C,'select * from fh_members')).rows.length,0)
    await assert.rejects(asUser(db,B,`insert into fh_grants values('${R}','${B}','edit',now())`))
    await asUser(db,A,`insert into fh_grants(resource_id,recipient_id,permission) values('${R}','${B}','read')`)
    assert.equal((await asUser(db,B,'select * from fh_resources')).rows.length,1)
    assert.equal((await asUser(db,B,`update fh_resources set title='Read-only attempted write' where id='${R}' returning id`)).rows.length,0)
    await asUser(db,A,`update fh_grants set permission='edit' where resource_id='${R}'`)
    await asUser(db,B,`update fh_resources set title='Authorised edit' where id='${R}'`)
    await assert.rejects(asUser(db,B,`update fh_resources set owner_id='${B}' where id='${R}'`),/cannot be reassigned/)
    await assert.rejects(asUser(db,B,`update fh_resources set person_id='${PB}' where id='${R}'`),/cannot be reassigned/)
    assert.equal((await asUser(db,B,`delete from fh_resources where id='${R}' returning id`)).rows.length,0)
    assert.equal((await asUser(db,B,'select * from fh_audit')).rows.length,0)
    assert.ok((await asUser(db,A,'select * from fh_audit')).rows.length>=4)
    await asUser(db,A,`delete from fh_grants where resource_id='${R}'`)
    assert.equal((await asUser(db,B,'select * from fh_resources')).rows.length,0)
    const med=(await asUser(db,A,`insert into fh_resources(person_id,owner_id,kind,title,details) values('${P}','${A}','medication','Synthetic medication','{"dosage":"synthetic","slots":["08:00"]}') returning id`)).rows[0].id
    await assert.rejects(asUser(db,A,`insert into fh_resources(person_id,owner_id,kind,title,details) values('${P}','${A}','medication','Invalid schedule','{"dosage":"synthetic","slots":[{}]}')`))
    await assert.rejects(asUser(db,A,`insert into fh_doses(resource_id,day,slot) values('${med}','2026-10-13','99:99')`))
    await asUser(db,A,`insert into fh_doses(resource_id,day,slot) values('${med}','2026-10-13','08:00')`)
    await assert.rejects(asUser(db,A,`insert into fh_doses(resource_id,day,slot) values('${med}','2026-10-13','08:00')`))
  } finally { await db.close() }
})
test('private Storage fences override broad policies; sharing and revocation; no file reassignment', async () => {
  const db=await setup()
  try {
    await asUser(db,A,`update kv_persons set fh_kind='self' where id='${P}'`)
    await asUser(db,A,`insert into fh_resources(id,person_id,owner_id,kind,title,storage_path,mime_type) values('${D}','${P}','${A}','document','Synthetic PDF','${A}/${D}','application/pdf')`)
    await asUser(db,A,`insert into storage.objects(bucket_id,name) values('fh-vault','${A}/${D}'),('kv-media','${A}/browser.jpg'),('kv-media','photos/${A}/server.jpg')`)
    assert.equal((await asUser(db,A,'select * from storage.objects')).rows.length,3)
    assert.equal((await asUser(db,B,'select * from storage.objects')).rows.length,0)
    await assert.rejects(asUser(db,B,`insert into storage.objects(bucket_id,name) values('fh-vault','${A}/${D}')`))
    await assert.rejects(asUser(db,A,`insert into storage.objects(bucket_id,name) values('fh-vault','${A}/unregistered')`))
    await asUser(db,A,`insert into fh_grants(resource_id,recipient_id,permission) values('${D}','${B}','read')`)
    assert.equal((await asUser(db,B,'select * from storage.objects')).rows.length,1)
    assert.equal((await asUser(db,B,`delete from storage.objects where bucket_id='fh-vault' returning name`)).rows.length,0)
    assert.equal((await asUser(db,A,`update storage.objects set name='hijack' returning name`)).rows.length,0)
    await asUser(db,A,`delete from fh_grants where resource_id='${D}'`)
    assert.equal((await asUser(db,B,'select * from storage.objects')).rows.length,0)
    await db.exec('reset role'); assert.equal((await db.query(`select public from storage.buckets where id='kv-media'`)).rows[0].public,false)
    // Other applications' Storage policies/buckets remain intact.
    await asUser(db,B,`insert into storage.objects(bucket_id,name) values('unrelated','ok')`)
  } finally { await db.close() }
})
test('extraction confirmation is owner-only, atomic and one-time; proposals never overwrite data before consent',async () => {
  const db=await setup()
  try {
    await asUser(db,A,`update kv_persons set fh_kind='self' where id='${P}'`)
    await asUser(db,A,`insert into fh_resources(id,person_id,owner_id,kind,title,storage_path,mime_type) values('${D}','${P}','${A}','document','Synthetic PDF','${A}/${D}','application/pdf')`)
    await db.exec('reset role')
    const eid=(await db.query(`insert into fh_extractions(document_id,proposal,source,confidence) values('${D}','{"lab":"synthetic"}','synthetic:test',0.8) returning id`)).rows[0].id
    assert.deepEqual((await asUser(db,A,`select details from fh_resources where id='${D}'`)).rows[0].details,{})
    await assert.rejects(asUser(db,B,`select fh_review_extraction('${eid}',true)`),/Owner required/)
    await asUser(db,A,`select fh_review_extraction('${eid}',true)`)
    assert.equal((await asUser(db,A,`select details from fh_resources where id='${D}'`)).rows[0].details.confirmed_extraction.lab,'synthetic')
    await assert.rejects(asUser(db,A,`select fh_review_extraction('${eid}',true)`),/Already reviewed/)
    await assert.rejects(asUser(db,A,`insert into fh_extractions(document_id,proposal,source,confidence) values('${D}','{}','forged',1)`),/permission denied/)
  } finally { await db.close() }
})
test('unused migration rolls back safely, populated migration refuses data loss',async () => {
  const rollback=await readFile(new URL('../database/rollback_family_hub.sql',import.meta.url),'utf8')
  const db=await setup()
  try {
    await db.exec(rollback)
    assert.equal((await db.query(`select to_regclass('public.fh_resources') as relation`)).rows[0].relation,null)
    assert.equal((await asUser(db,A,'select * from kv_notes')).rows.length,1)
    await db.exec('reset role')
    assert.equal((await db.query(`select public from storage.buckets where id='kv-media'`)).rows[0].public,false)
  } finally { await db.close() }
  const used=await setup()
  try {
    await asUser(used,A,`select fh_create_family('Synthetic','Synthetic')`)
    await used.exec('reset role')
    await assert.rejects(used.exec(rollback),/rollback refused/)
    await used.exec('rollback')
    assert.equal((await used.query('select * from fh_families')).rows.length,1)
  } finally { await used.close() }
})
