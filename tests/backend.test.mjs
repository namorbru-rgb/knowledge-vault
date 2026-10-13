import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
process.env.SUPABASE_URL='https://synthetic.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-test-key'
const express=require('../backend/node_modules/express')
const { createRouter,validateResource }=require('../backend/src/family')
const { parseProposal }=require('../backend/src/extraction')
const { ownsPhotoPath }=require('../backend/src/storageAccess')
const A='00000000-0000-4000-8000-000000000001', R='00000000-0000-4000-8000-000000000021'
test('API validates writes and rejects model actions/malformed proposals',() => {
  assert.equal(ownsPhotoPath(`${A}/photo.jpg`,A),true)
  assert.equal(ownsPhotoPath(`photos/${A}/photo.jpg`,A),true)
  assert.equal(ownsPhotoPath('someone-else/photo.jpg',A),false)
  assert.equal(ownsPhotoPath(`${A}/../someone-else/photo.jpg`,A),false)
  assert.equal(validateResource({person_id:A,kind:'symptom',title:'Synthetic',intensity:0}),null)
  assert.ok(validateResource({person_id:A,kind:'symptom',title:'Synthetic',intensity:11}))
  assert.ok(validateResource({owner_id:A,title:'Attempted reassignment'},true))
  assert.ok(validateResource({person_id:A,kind:'document',title:'Bypass upload'}))
  assert.throws(() => parseProposal('{"fields":[],"confidence":1}'))
  assert.throws(() => parseProposal('{"fields":{},"confidence":2}'))
  assert.deepEqual(parseProposal('{"fields":{"label":"synthetic"},"confidence":0.7}'),{proposal:{label:'synthetic'},confidence:0.7})
})
test('Family API denies legacy keys, read-only edits and unauthorised document URL signing',async () => {
  let signed=0, mode='legacy', wrote=0
  const db={
    from(table) {
      const q={select(){return q},eq(){return q},order(){return q},limit(){return Promise.resolve({data:[]})},
        maybeSingle(){return Promise.resolve({data:table==='fh_grants' ? {permission:'read'} : mode==='missing' ? null : {id:R,owner_id:'another-user',storage_path:`another-user/${R}`}})},
        update(){wrote++;return q},single(){return Promise.resolve({data:{}})}}
      return q
    },
    storage:{from(){return {createSignedUrl(){signed++;return Promise.resolve({data:{signedUrl:'https://synthetic.invalid'}})}}}},
  }
  const app=express(); app.use(express.json()); app.use('/api/family',createRouter((req,res,next) => {req.userId=A;req.db=db;if(mode!=='legacy')req.user={id:A};next()}))
  const server=app.listen(0,'127.0.0.1'); await new Promise(resolve => server.once('listening',resolve))
  const base=`http://127.0.0.1:${server.address().port}/api/family`
  try {
    assert.equal((await fetch(`${base}/resources`)).status,403)
    mode='read';assert.equal((await fetch(`${base}/resources/${R}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Unauthorised edit'})})).status,403);assert.equal(wrote,0)
    mode='missing';assert.equal((await fetch(`${base}/documents/${R}/url`,{method:'POST'})).status,404);assert.equal(signed,0)
    assert.equal((await fetch(`${base}/documents/${R}/extraction`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:false})})).status,400)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
