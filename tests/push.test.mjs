import {test} from 'node:test';import assert from 'node:assert/strict';import {createECDH,randomBytes} from 'node:crypto';import webpush from 'web-push';
test('VAPID signing and encrypted push payload are generated without sending data',()=>{
 const receiver=createECDH('prime256v1');receiver.generateKeys();const server=webpush.generateVAPIDKeys();
 const request=webpush.generateRequestDetails({endpoint:'https://fcm.googleapis.com/synthetic',keys:{p256dh:receiver.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}},'{}',{vapidDetails:{subject:'https://namorbru-rgb.github.io/knowledge-vault/',...server},TTL:300});
 assert.equal(request.headers.TTL,300);assert.equal(request.headers['Content-Encoding'],'aes128gcm');assert.ok(request.body.length>20);assert.ok(request.headers.Authorization);
})
