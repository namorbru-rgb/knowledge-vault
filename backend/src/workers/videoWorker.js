// KnowledgeVault transcription worker.
// Claim -> download -> speech-to-text -> ATOMIC commit of validated segments -> done.
// A video with no stored transcript is never counted as done.
require('dotenv').config({path:__dirname+'/../../.env'});
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn}=require('node:child_process');
const axios=require('axios');
const db=require('../supabase');
const {safeVideoUrl,parseWhisper,displayTitle,permanentFailure,ytDlpArgs}=require('./videoWorkerCore');

const YTDLP=process.env.YTDLP_PATH||'yt-dlp';
const WHISPER=process.env.WHISPER_PATH||'whisper';
const MODEL=process.env.WHISPER_MODEL||'small';
const COOKIES=process.env.FB_COOKIES_FILE||'';
const SLEEP_MS=Number(process.env.VIDEO_WORKER_INTERVAL_MS||30000);
const BASE=process.env.VIDEO_WORK_DIR||path.join(os.tmpdir(),'kv-video-work');
let shuttingDown=false;
process.on('SIGTERM',()=>{shuttingDown=true;});
process.on('SIGINT',()=>{shuttingDown=true;});
fs.mkdirSync(BASE,{recursive:true});

function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function execute(bin,args,{timeout=120000,stdoutMax=6000000}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(bin,args,{stdio:['ignore','pipe','pipe'],shell:false});
    const stdout=[],stderr=[];
    let outSize=0,errSize=0,finished=false;
    const timeoutId=setTimeout(()=>{child.kill('SIGKILL');},timeout);
    child.stdout.on('data',chunk=>{outSize+=chunk.length;if(outSize<=stdoutMax)stdout.push(chunk);else child.kill('SIGKILL');});
    child.stderr.on('data',chunk=>{errSize+=chunk.length;if(errSize<=40000)stderr.push(chunk);});
    child.on('error',err=>end(err));
    child.on('close',(code,signal)=>{
      if(code!==0)return end(new Error(bin+' failed ('+(signal||code)+'): '+Buffer.concat(stderr).toString('utf8').slice(-1300)));
      end(null,Buffer.concat(stdout).toString('utf8'));
    });
    function end(err,value){if(finished)return;finished=true;clearTimeout(timeoutId);if(err)reject(err);else resolve(value);}
  });
}
function cookiesFile(){
  if(!COOKIES)return '';
  if(!fs.existsSync(COOKIES))throw new Error('Facebook cookies file configured but missing');
  return COOKIES;
}
async function resolveShare(raw){
  const u=new URL(raw);
  if(!/(^|\.)facebook\.com$/i.test(u.hostname)||!u.pathname.startsWith('/share/'))return raw;
  try{
    const response=await axios.get(raw,{timeout:15000,maxRedirects:7,maxContentLength:1200000,
      validateStatus:code=>code>=200&&code<400,
      headers:{'User-Agent':'Mozilla/5.0'}});
    const redirected=response.request?.res?.responseUrl||raw;
    return safeVideoUrl(redirected);
  }catch{ return raw; }
}
async function transcribe(job){
  const id=job.id,claim=job.claim_token;
  const temp=fs.mkdtempSync(path.join(BASE,id+'-'));
  let heartbeat=null;
  try{
    heartbeat=setInterval(async()=>{
      try{
        const {data,error}=await db.rpc('kv_transcription_heartbeat',{p_id:id,p_claim:claim});
        if(error||data!==true)console.warn('Claim heartbeat failed for',id);
      }catch(e){console.warn('Heartbeat unavailable',id);}
    },60000);
    let url=safeVideoUrl(job.url);
    url=await resolveShare(url);
    let info;
    const commonCookie=cookiesFile();
    try{info=JSON.parse(await execute(YTDLP,ytDlpArgs(url,commonCookie,'info'),{timeout:90000}));}
    catch(e){
      // Some Facebook redirect pages are valid URLs yet unrecognized by yt-dlp.
      // Try the original once when a redirect was followed.
      if(url===job.url)throw e;
      url=safeVideoUrl(job.url);
      info=JSON.parse(await execute(YTDLP,ytDlpArgs(url,commonCookie,'info'),{timeout:90000}));
    }
    const audio=path.join(temp,'audio.mp3');
    await execute(YTDLP,ytDlpArgs(url,commonCookie,'audio',audio),{timeout:600000,stdoutMax:200000});
    if(!fs.existsSync(audio)||fs.statSync(audio).size<1000)throw Error('Audio missing or empty');
    await execute(WHISPER,[audio,'--model',MODEL,'--output_format','json','--output_dir',temp,'--verbose','False'],{timeout:3600000,stdoutMax:200000});
    const jsonPath=path.join(temp,'audio.json');
    if(!fs.existsSync(jsonPath))throw Error('Whisper transcript JSON missing');
    const parsed=JSON.parse(fs.readFileSync(jsonPath,'utf8'));
    const segments=parseWhisper(parsed);
    const infoData={title:displayTitle(info,url),description:info?.description||'',
      thumbnail:info?.thumbnail||'',duration:String(Math.round(Number(info?.duration)||0))};
    const {data:count,error}=await db.rpc('kv_transcription_finalize',{
      p_id:id,p_claim:claim,p_segments:segments,p_info:infoData
    });
    if(error||count!==segments.length)throw Error('Atomic transcript database commit failed: '+(error?.message||'segment count mismatch'));
    console.log('TRANSCRIBED',id,'segments:',count,'duration:',infoData.duration);
  }catch(e){
    const reason=String(e?.message||e).slice(0,400);
    console.error('TRANSCRIPTION_FAILED',id,reason);
    const {data:next,error}=await db.rpc('kv_transcription_fail',{
      p_id:id,p_claim:claim,p_reason:reason,p_permanent:permanentFailure(reason)
    });
    if(error)console.error('Could not save failure status',id,error.message);
    else console.log('Next status:',next,id);
  }finally{
    if(heartbeat)clearInterval(heartbeat);
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
async function main(){
  console.log('Knowledge video worker ready (atomic-transcript-v2, model',MODEL,')');
  while(!shuttingDown){
    try{
      const {data,error}=await db.rpc('kv_transcription_claim');
      if(error)throw Error('Queue claim failed: '+error.message);
      if(!data){await delay(Math.max(5000,Math.min(120000,SLEEP_MS)));continue;}
      await transcribe(data);
    }catch(e){
      console.error('Worker error:',e?.message||e);
      await delay(Math.max(30000,SLEEP_MS));
    }
  }
  console.log('Knowledge worker stopped');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={transcribe,execute,resolveShare};
