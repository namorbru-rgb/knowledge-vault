const SAFE_HOSTS=new Set(['facebook.com','fb.watch','youtube.com','youtu.be','instagram.com','tiktok.com','bewusst-vegan-froh.de']);
function safeVideoUrl(raw){
  let u;try{u=new URL(raw)}catch{throw new Error('Invalid video URL')}
  const host=u.hostname.toLowerCase().replace(/^www\./,'').replace(/^m\./,'');
  if(!['http:','https:'].includes(u.protocol) || ![...SAFE_HOSTS].some(x=>host===x||host.endsWith('.'+x)))
    throw new Error('Unsupported external video host');
  if(u.username||u.password)throw new Error('Video URL contains credentials');
  return u.toString();
}
function parseWhisper(data){
  if(!data||typeof data!=='object'||!Array.isArray(data.segments))
    throw new Error('Whisper JSON has no segment list');
  const segments=data.segments.map((s)=>{
    const text=String(s?.text||'').trim();
    const start=Number(s?.start),end=Number(s?.end);
    return {start,end,text};
  }).filter(x=>x.text && Number.isFinite(x.start) && Number.isFinite(x.end)&&x.start>=0&&x.end>=x.start);
  if(segments.length===0)throw new Error('Whisper produced no spoken transcript');
  if(segments.length>3000)throw new Error('Whisper transcript exceeds 3000 segments');
  return segments;
}
function displayTitle(info,url){
  const description=typeof info?.description==='string'?info.description:'';
  const rawTitle=String(info?.title||'').trim();
  const isStatsTitle=/^\d+([.,]\d+)?\s*[KMB]?\s*(views?|aufrufe)\b/i.test(rawTitle)
    || /\breactions?\b|\breaktionen\b/i.test(rawTitle);
  return ((isStatsTitle?description.split(/\r?\n/).find(x=>x.trim()):rawTitle)||url).slice(0,300);
}
function permanentFailure(text){
  return /Unsupported external video host|Invalid video URL|Video URL contains credentials|Video URL resolves to unsupported host/i.test(text||'');
}
function ytDlpArgs(url,cookies,action,output){
  const common=['--no-playlist','--no-progress','--no-warnings','--socket-timeout','25','--retries','3','--fragment-retries','3'];
  if(cookies)common.push('--cookies',cookies);
  if(action==='info')return [...common,'--dump-single-json',url];
  if(action==='audio')return [...common,'-x','--audio-format','mp3','--audio-quality','5','-o',output,url];
  throw new Error('Invalid yt-dlp mode');
}
module.exports={safeVideoUrl,parseWhisper,displayTitle,permanentFailure,ytDlpArgs};
