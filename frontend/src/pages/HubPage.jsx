import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { family,localDay } from '../lib/family'
import { modules } from '../lib/modules'
import HubIcon from '../components/HubIcon'
import ChangelogModal from '../components/ChangelogModal'

const actions=[
  {to:'/health?action=symptom',icon:'health',name:'Beschwerde erfassen',text:'Kopfschmerzen, Fieber, Bauchweh…',primary:true},
  {to:'/health?action=doses',icon:'home',name:'Einnahmen abhaken',text:'Vitamine und Medikamente'},
  {to:'/documents',icon:'documents',name:'Dokument hinzufügen',text:'Foto, Arztbericht oder Rechnung'},
]
const areas=[
  {id:'health',label:'Gesundheit',description:'Beschwerden, Einnahmen, Verlauf',to:'/health'},
  {id:'knowledge',label:'Knowledge',description:'Eure Notizen, Videos und Erinnerungen',to:'/knowledge'},
  {id:'documents',label:'Dokumente',description:'Sicher aufbewahren und wiederfinden',to:'/documents'},
  {id:'family',label:'Familie',description:'Profile und Zugriffsrechte verwalten',to:'/family'},
]
export default function HubPage(){
  const navigate=useNavigate()
  const [name,setName]=useState('')
  const [due,setDue]=useState(null)
  const [history,setHistory]=useState(false)
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).get('open')==='health')navigate('/health',{replace:true})
    let alive=true
    Promise.allSettled([family.members(),family.userId(),family.resources(),family.doses()]).then(r=>{
      if(!alive)return
      const val=i=>r[i].status==='fulfilled'?r[i].value:null
      const me=(val(0)||[]).find(m=>m.user_id===val(1))
      setName(me?.display_name||'')
      const meds=(val(2)||[]).filter(x=>x.kind==='medication'&&x.owner_id===val(1))
      const all=meds.flatMap(x=>(x.details?.slots||[]).map(slot=>({id:x.id,slot})))
      if(all.length){
        const taken=(val(3)||[]).filter(d=>d.day===localDay())
        setDue({total:all.length,done:all.filter(x=>taken.some(d=>d.resource_id===x.id&&d.slot===x.slot)).length})
      }
    }).catch(()=>{})
    return ()=>{alive=false}
  },[navigate])
  return <div className="hub-page space-y-6">
    <header className="hub-intro !mb-0">
      <span className="hub-eyebrow">{name?`HALLO, ${name.toUpperCase()}`:'WILLKOMMEN'}</span>
      <h1>Dein Family Hub</h1>
      <p>Alles Wichtige für eure Familie – einfach und übersichtlich.</p>
    </header>
    <section aria-labelledby="start-heading">
      <h2 id="start-heading" className="font-semibold text-lg mb-3">Was möchtest du heute machen?</h2>
      <div className="space-y-3">
        {actions.map(action=><Link key={action.to} to={action.to}
          className={`hub-daily-action ${action.primary?'is-primary':''}`}>
          <span className="hub-daily-icon"><HubIcon name={action.icon}/></span>
          <span className="flex-1 min-w-0"><strong>{action.name}</strong><small>{action.text}</small></span>
          <HubIcon name="arrow" className="hub-tile-arrow"/>
        </Link>)}
      </div>
      {due&&<Link to="/health?action=doses" className="block mt-3 text-sm text-muted">
        Heute: <strong>{due.done} von {due.total}</strong> geplanten Einnahmen bestätigt. <span className="text-blue-600">Ansehen →</span>
      </Link>}
    </section>
    <section aria-labelledby="areas-heading">
      <h2 id="areas-heading" className="hub-section-title">Deine Bereiche</h2>
      <div className="hub-tiles">{areas.map(area=><Link key={area.id} to={area.to} className={`hub-tile hub-tile-${area.id}`}>
        <div className="hub-tile-top"><span className="hub-icon-box"><HubIcon name={area.id}/></span><HubIcon name="arrow" className="hub-tile-arrow"/></div>
        <h3>{area.label}</h3><p>{area.description}</p>
      </Link>)}</div>
    </section>
    <details className="hub-more">
      <summary>Weitere Module und Einstellungen</summary>
      <div className="space-y-3 mt-3">
        <p className="text-xs text-muted">Diese zusätzlichen Bereiche sind für spätere Erweiterungen vorgesehen.</p>
        <div className="flex flex-wrap gap-2">{modules.filter(m=>!m.to).map(m=><span key={m.id} className="rounded-lg border border-line px-3 py-2 text-sm">{m.label}</span>)}</div>
        <Link className="hub-secondary-button inline-block" to="/settings">Einstellungen öffnen</Link>
      </div>
    </details>
    <footer className="hub-overview-footer">
      <p>Deine persönlichen Daten bleiben geschützt. Freigaben kannst du selbst verwalten.</p>
      <button onClick={()=>setHistory(true)} type="button">Versionsverlauf</button>
    </footer>
    {history&&<ChangelogModal onClose={()=>setHistory(false)}/>}
  </div>
}
