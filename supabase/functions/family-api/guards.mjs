export function validPushEndpoint(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443')&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)&&value.length<2048}catch{return false}
}
export function parseProposal(text){
  const obj=JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''))
  if(!obj||!obj.fields||typeof obj.fields!=='object'||Array.isArray(obj.fields)||JSON.stringify(obj.fields).length>20000||!Number.isFinite(obj.confidence)||obj.confidence<0||obj.confidence>1)throw new Error('Invalid proposal')
  return {proposal:obj.fields,confidence:obj.confidence}
}
