import { Link,useNavigate } from 'react-router-dom'
import {useEffect} from 'react'
import { modules } from '../lib/modules'
export default function HubPage() {
  const navigate=useNavigate()
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('open')==='health')navigate('/health',{replace:true})},[navigate])
  return <div className="hub-page">
    <h1 className="text-3xl font-bold text-fg">Dein Family Hub</h1>
    <p className="text-muted mt-2 mb-6">Wissen sammeln. Gesundheit begleiten. Dokumente sicher aufbewahren.</p>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{modules.map(m => {
      const content = <><span className="text-3xl">{m.icon}</span><h2 className="text-xl font-semibold mt-3">{m.label}</h2><p className="text-muted mt-2">{m.description}</p>{!m.to && <span className="text-xs text-muted">Geplant</span>}</>
      return m.to ? <Link className="hub-card hover:border-blue-500" key={m.id} to={m.to}>{content}</Link> : <div className="hub-card opacity-60" key={m.id}>{content}</div>
    })}</div>
    <p className="text-muted mt-6">Private Daten bleiben privat. Auch Familienadministratoren benötigen eine ausdrückliche Freigabe.</p>
    <Link className="hub-button inline-block mt-4" to="/family">Persönliches Profil einrichten</Link>
  </div>
}
