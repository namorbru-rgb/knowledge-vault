import { createClient } from 'npm:@supabase/supabase-js@2.117.3'

// Resolve public social preview metadata only. Never fetch user-controlled hosts.
// Requests are scoped to the signed-in owner's records and limited per call.
const url = Deno.env.get('SUPABASE_URL')!
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anon = Deno.env.get('SUPABASE_ANON_KEY')!
const service = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const origins = new Set(['https://namorbru-rgb.github.io','http://localhost:5173','http://127.0.0.1:5173'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function safeVideoUrl(raw:string) {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null
    if (!['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com',
      'fb.watch','www.youtube.com','youtube.com','youtu.be','www.instagram.com','instagram.com'].includes(u.hostname)) return null
    return u
  } catch { return null }
}
function meta(html:string, key:string) {
  const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  const tag=html.match(new RegExp('<meta\\s+[^>]*(?:property|name)=["\\\']'+escaped+'["\\\'][^>]*>','i'))
  const alternate=html.match(new RegExp('<meta\\s+[^>]*content=["\\\'][^>]*["\\\']\\s+[^>]*(?:property|name)=["\\\']'+escaped+'["\\\'][^>]*>','i'))
  const candidate=tag?.[0]||alternate?.[0]||''
  return candidate.match(/content=["']([^"']{1,2000})["']/i)?.[1]
    ?.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim() || null
}
function safeImage(raw:string|null) {
  try {
    if(!raw)return null
    const u=new URL(raw)
    if(u.protocol!=='https:'||u.username||u.password||u.port)return null
    // Provider-owned image delivery only; never permit arbitrary images.
    if (!['fbcdn.net','fbsbx.com','ytimg.com','googleusercontent.com','cdninstagram.com']
      .some(d=>u.hostname===d||u.hostname.endsWith('.'+d))) return null
    return u.href
  }catch{return null}
}
function meaningful(title:string|null, raw:string) {
  if(!title)return null
  const clean=title.replace(/<[^>]*>/g,'').replace(/\\s+/g,' ').trim().slice(0,180)
  if(!clean||clean===raw||/^(facebook|watch|videos?)$/i.test(clean))return null
  return clean
}
async function extract(raw:string) {
  const u=safeVideoUrl(raw)
  if(!u)return null
  // YouTube IDs provide a stable, official thumbnail without scraping.
  if(u.hostname==='youtu.be'||u.hostname.includes('youtube.com')) {
    const id=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')||u.pathname.match(/\/shorts\/([\w-]+)/)?.[1]
    if(id&&/^[\w-]{11}$/.test(id))return {thumbnail_url:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',title:null}
  }
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),7000)
  try {
    const response=await fetch(u.href,{
      redirect:'manual',signal:controller.signal,
      headers:{'Accept':'text/html','User-Agent':'Mozilla/5.0 (compatible; FamilyHubPreview/1.0)'},
    })
    if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))return null
    const html=(await response.text()).slice(0,350000)
    return {
      thumbnail_url:safeImage(meta(html,'og:image')||meta(html,'twitter:image')),
      title:meaningful(meta(html,'og:title')||meta(html,'twitter:title'),raw),
    }
  }catch{return null}finally{clearTimeout(timeout)}
}
Deno.serve(async req=>{
  const origin=req.headers.get('origin')||''
  const headers:Record<string,string>={
    'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods':'POST,OPTIONS',
  }
  if(origins.has(origin))headers['Access-Control-Allow-Origin']=origin
  const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
  if(req.method!=='POST'||(origin&&!origins.has(origin)))return respond({error:'Forbidden'},403)
  try{
    const auth=req.headers.get('authorization')||''
    if(!auth.startsWith('Bearer '))return respond({error:'Unauthorized'},401)
    const {data:verified,error:authError}=await service.auth.getUser(auth.slice(7))
    if(authError||!verified.user)return respond({error:'Unauthorized'},401)
    const personal=createClient(url,anon,{
      global:{headers:{Authorization:auth}},
      auth:{persistSession:false,autoRefreshToken:false},
    })
    const {data:active,error:activeError}=await personal.rpc('fh_session_active')
    if(activeError||!active)return respond({error:'Session expired'},401)
    const input=await req.json()
    if(!Array.isArray(input.ids)||input.ids.length<1||input.ids.length>8||
       !input.ids.every((id:unknown)=>typeof id==='string'&&uuid.test(id)))
      return respond({error:'Invalid selection'},400)
    const {data:videos,error:lookupError}=await service.from('kv_videos')
      .select('id,url,title,thumbnail_url')
      .eq('user_id',verified.user.id).in('id',input.ids)
    if(lookupError)return respond({error:'Lookup unavailable'},500)
    const results=[]
    for(const video of videos||[]){
      if(video.thumbnail_url){results.push({id:video.id,status:'existing'});continue}
      const metadata=await extract(video.url)
      if(!metadata?.thumbnail_url){results.push({id:video.id,status:'unavailable'});continue}
      const patch:Record<string,string>={thumbnail_url:metadata.thumbnail_url}
      if(metadata.title&&(!video.title||video.title===video.url))patch.title=metadata.title
      const {error}=await service.from('kv_videos').update(patch)
        .eq('id',video.id).eq('user_id',verified.user.id)
      results.push({id:video.id,status:error?'failed':'updated'})
    }
    return respond({results})
  }catch{return respond({error:'Preview service unavailable'},500)}
})
