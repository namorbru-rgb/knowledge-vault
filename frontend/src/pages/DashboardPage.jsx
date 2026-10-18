import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { family } from '../lib/family'
import HubIcon from '../components/HubIcon'

const sections=[
  {label:'Videos',to:'/videos',description:'Gespeicherte und transkribierte Videos',icon:'videos'},
  {label:'Links',to:'/links',description:'Interessante Webseiten',icon:'links'},
  {label:'Fotos',to:'/photos',description:'Fotos und Beschreibungen',icon:'photos'},
  {label:'Notizen',to:'/notes',description:'Gedanken und Erinnerungen',icon:'notes'},
]
const types={note:'Notiz',video:'Video',link:'Link',photo:'Foto'}
function safeUrl(raw){
  try{const u=new URL(raw);return ['http:','https:'].includes(u.protocol)?u.href:null}
  catch{return null}
}
export default function DashboardPage(){
  const [stats,setStats]=useState({})
  const [feed,setFeed]=useState([])
  const [members,setMembers]=useState([])
  const [shares,setShares]=useState([])
  const [userId,setUserId]=useState('')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [filter,setFilter]=useState('all')
  const [limit,setLimit]=useState(20)
  const [showShare,setShowShare]=useState(false)
  const [expanded,setExpanded]=useState({})
  async function load(){
    const results=await Promise.allSettled([
      api.getStats(),family.knowledgeFeed(100,0),family.members(),
      family.knowledgeShares(),family.userId(),
    ])
    const val=i=>results[i].status==='fulfilled'?results[i].value:null
    if(results[1].status==='rejected')setError('Das gemeinsame Wissen konnte nicht geladen werden.')
    setStats(val(0)||{});setFeed(val(1)||[]);setMembers(val(2)||[])
    setShares(val(3)||[]);setUserId(val(4)||'')
    setLoading(false)
  }
  useEffect(()=>{load().catch(err=>{setError(err.message);setLoading(false)})},[])
  const recipients=members.filter(m=>m.user_id!==userId && members.some(my=>my.user_id===userId&&my.family_id===m.family_id))
    .filter((m,i,all)=>all.findIndex(x=>x.user_id===m.user_id)===i)
  const filtered=feed.filter(row=>filter==='all'||(filter==='mine'?row.mine:row.record_owner===filter))
    .slice(0,limit)
  async function toggle(recipient){
    setBusy(true);setError('')
    try{
      if(shares.some(s=>s.owner_id===userId&&s.recipient_id===recipient))await family.unshareKnowledge(recipient)
      else await family.shareKnowledge(recipient)
      await load()
    }catch(err){setError(err.message)}
    finally{setBusy(false)}
  }
  return <div className="hub-page space-y-5">
    <header>
      <h1 className="text-2xl font-bold">Knowledge</h1>
      <p className="text-muted mt-1">Eure Erinnerungen, Videos, Links und Notizen an einem Ort.</p>
    </header>
    <section className="hub-card space-y-3">
      <h2 className="font-semibold text-lg">Gemeinsames Familienwissen</h2>
      <p className="text-sm text-muted">Hier siehst du deine eigenen Einträge und alle Knowledge-Einträge, die Familienmitglieder mit dir teilen.</p>
      {error&&<p className="text-sm text-red-600" role="alert">{error}</p>}
      <div className="hub-person-picks">
        <button type="button" onClick={()=>{setFilter('all');setLimit(20)}} aria-pressed={filter==='all'}
          className={`hub-person-pill ${filter==='all'?'is-selected':''}`}>Alle freigegebenen</button>
        <button type="button" onClick={()=>{setFilter('mine');setLimit(20)}} aria-pressed={filter==='mine'}
          className={`hub-person-pill ${filter==='mine'?'is-selected':''}`}>Nur meine</button>
        {recipients.map(m=><button type="button" key={m.user_id} onClick={()=>{setFilter(m.user_id);setLimit(20)}}
          aria-pressed={filter===m.user_id} className={`hub-person-pill ${filter===m.user_id?'is-selected':''}`}>{m.display_name}</button>)}
      </div>
      {loading?<p className="text-muted">Lade Einträge…</p>:filtered.length ? <div className="space-y-2">
        {filtered.map(row=>{
          const url=safeUrl(row.link_url)
          const note=row.record_type==='note'
          const showDetails=expanded[row.record_id]
          return <article key={row.record_type+row.record_id} className="hub-knowledge-entry">
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <span>{types[row.record_type]||'Eintrag'} · {row.mine?'Von mir':`Von ${row.owner_name}`}</span>
              <span>{new Date(row.created_at).toLocaleDateString('de-CH')}</span>
            </div>
            <h3 className="font-semibold mt-1 break-words">{row.title||'(Ohne Titel)'}</h3>
            {row.summary && (!note || showDetails) && <p className="text-sm text-muted mt-1 whitespace-pre-wrap break-words">
              {showDetails?row.summary:row.summary.slice(0,180)}{!showDetails&&row.summary.length>180?'…':''}
            </p>}
            {note&&row.summary&&!showDetails&&row.summary.length>180&&<p className="text-sm text-muted mt-1">{row.summary.slice(0,180)}…</p>}
            <div className="flex gap-3 mt-2 items-center text-sm">
              {url&&<a className="text-blue-600 font-semibold" href={url} target="_blank" rel="noopener noreferrer">Quelle öffnen</a>}
              {row.summary&&row.summary.length>180&&<button className="text-blue-600" type="button"
                onClick={()=>setExpanded(old=>({...old,[row.record_id]:!old[row.record_id]}))}>{showDetails?'Weniger':'Mehr lesen'}</button>}
              {row.record_type==='photo'&&<span className="text-xs text-muted">Foto-Datei bleibt privat</span>}
            </div>
          </article>
        })}
        {filtered.length===limit&&limit<feed.length&&<button className="hub-secondary-button w-full" type="button"
          onClick={()=>setLimit(n=>n+20)}>Weitere Einträge anzeigen</button>}
        {limit>=100&&feed.length>=100&&<p className="text-xs text-muted">Für ältere Einträge die Eintragssuche verwenden; weitere Archivseiten werden nachgeladen.</p>}
      </div> : <div className="bg-elevated rounded-xl p-4">
        <p className="font-semibold">Hier ist noch nichts freigegeben.</p>
        <p className="text-sm text-muted mt-1">Katarina kann ihre Knowledge-Einträge mit dir teilen. Die Freigabe nimmt sie einmal in ihrem eigenen Konto vor.</p>
      </div>}
    </section>
    <details className="hub-more" open={showShare} onToggle={e=>setShowShare(e.currentTarget.open)}>
      <summary>Meine Knowledge-Einträge mit der Familie teilen</summary>
      <div className="space-y-3 mt-3">
        <p className="text-sm text-muted">Du entscheidest, welche erwachsenen Familienmitglieder deine Notizen, Links, Video-Titel und Foto-Beschreibungen lesen können. Gesundheitsdaten und private Bilddateien werden dadurch nicht freigegeben.</p>
        {recipients.map(m=>{
          const shared=shares.some(s=>s.owner_id===userId&&s.recipient_id===m.user_id)
          return <div key={m.user_id} className="flex items-center justify-between gap-3 border border-line rounded-xl p-3">
            <span className="font-medium">{m.display_name}</span>
            <button type="button" disabled={busy} onClick={()=>toggle(m.user_id)} className={shared?'hub-secondary-button':'hub-button'}>
              {shared?'Freigabe beenden':'Wissen teilen'}
            </button>
          </div>
        })}
        {!recipients.length&&<p className="text-sm text-muted">Noch kein weiteres Erwachsenen-Konto in deiner Familie vorhanden.</p>}
      </div>
    </details>
    <section>
      <h2 className="hub-section-title">Wissen hinzufügen oder verwalten</h2>
      <div className="hub-quick-actions">
        {sections.map(section=><Link key={section.to} to={section.to} className="hub-quick-action">
          <HubIcon name={section.icon}/>
          <span><strong>{section.label}</strong><small>{section.description}</small></span>
        </Link>)}
      </div>
    </section>
  </div>
}
