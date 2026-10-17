import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {safeVideoUrl,parseWhisper,displayTitle,permanentFailure,ytDlpArgs}
  = require('../backend/src/workers/videoWorkerCore.js')

test('Knowledge URLs allow supported public video hosts but reject local/internal endpoints',()=>{
  assert.match(safeVideoUrl('https://www.facebook.com/share/r/example/'),/facebook.com/)
  assert.match(safeVideoUrl('https://www.youtube.com/watch?v=test'),/youtube.com/)
  for(const url of ['http://127.0.0.1/private','file:///etc/passwd','http://localhost:3000/',
    'https://facebook.com.attacker.invalid/reel','https://user:pw@facebook.com/reel']){
    assert.throws(()=>safeVideoUrl(url))
  }
})
test('whisper segmentation rejects no-text and missing segments rather than marking done',()=>{
  assert.throws(()=>parseWhisper({text:'hello world'}),/segment list/)
  assert.throws(()=>parseWhisper({segments:[]}),/no spoken/)
  assert.throws(()=>parseWhisper({segments:[{start:0,end:4,text:'  '}]}),/no spoken/)
  assert.deepEqual(parseWhisper({segments:[{start:0,end:1,text:' Hallo  '},
    {start:1,end:2,text:' Welt'},{start:3,end:2,text:'invalid'}]}),
   [{start:0,end:1,text:'Hallo'},{start:1,end:2,text:'Welt'}])
})
test('yt-dlp URL and cookie filename never pass through a shell interpreter',()=>{
  const url='https://www.facebook.com/share/r/xyz/?a=$(touch%20/tmp/oh-no)'
  const args=ytDlpArgs(url,'/tmp/cookie safe.txt','audio','/tmp/output file.mp3')
  assert.equal(args.at(-1),url)
  assert.deepEqual(args.slice(-4),['5','-o','/tmp/output file.mp3',url])
  assert.ok(args.includes('/tmp/cookie safe.txt'))
})
test('Facebook counters do not replace meaningful captions as titles',()=>{
  assert.equal(displayTitle({title:'241K views · 4.8K reactions',description:'My sample caption\nnext line'},'fallback'),'My sample caption')
  assert.equal(displayTitle({title:'Normal title',description:'Other description'},'fallback'),'Normal title')
})
test('only unsupported hosts are permanent failure reasons',()=>{
  assert.equal(permanentFailure('Unsupported external video host'),true)
  assert.equal(permanentFailure('Video unavailable HTTP 403'),false)
})
