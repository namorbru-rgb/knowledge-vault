import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { modules } from '../lib/modules'
import HubIcon from '../components/HubIcon'
import ChangelogModal from '../components/ChangelogModal'

const areas = [
  { id: 'knowledge', label: 'Knowledge', description: 'Dein Wissen an einem Ort', to: '/knowledge', hint: 'Videos · Links · Fotos · Notizen' },
  { id: 'health', label: 'Gesundheit', description: 'Dein Alltag, gut begleitet', to: '/health', hint: 'Verlauf · Termine · Einnahmen' },
  { id: 'documents', label: 'Dokumente', description: 'Alles sicher aufbewahrt', to: '/documents', hint: 'Privater Tresor · Freigaben' },
  { id: 'family', label: 'Familie', description: 'Profile und Freigaben', to: '/family', hint: 'Persönlich · Gemeinsam' },
]
const shortcuts = [
  { id: 'videos', label: 'Videos' }, { id: 'links', label: 'Links' },
  { id: 'photos', label: 'Fotos' }, { id: 'notes', label: 'Notizen' },
]

export default function HubPage() {
  const navigate = useNavigate()
  const [showHistory, setShowHistory] = useState(false)
  useEffect(() => { if (new URLSearchParams(window.location.search).get('open') === 'health') navigate('/health', { replace: true }) }, [navigate])
  return <div className="hub-page hub-overview">
    <div className="hub-intro">
      <span className="hub-eyebrow">DEIN PERSÖNLICHER RAUM</span>
      <h1>Dein Family Hub</h1>
      <p>Wissen, Gesundheit und Familie.<br className="sm:hidden" /> Alles an einem Ort.</p>
    </div>
    <section aria-labelledby="areas-heading">
      <h2 id="areas-heading" className="hub-section-title">Deine Bereiche</h2>
      <div className="hub-tiles">{areas.map(area => <Link key={area.id} to={area.to} className={`hub-tile hub-tile-${area.id}`}>
        <div className="hub-tile-top"><span className="hub-icon-box"><HubIcon name={area.id} /></span><HubIcon name="arrow" className="hub-tile-arrow" /></div>
        <h3>{area.label}</h3><p>{area.description}</p><span className="hub-tile-hint">{area.hint}</span>
      </Link>)}</div>
    </section>
    <section className="hub-quick-section" aria-labelledby="quick-heading">
      <div className="hub-section-heading"><h2 id="quick-heading" className="hub-section-title">Direkt zu deinem Wissen</h2><Link to="/search" className="hub-search-link"><HubIcon name="search" /> Suche</Link></div>
      <div className="hub-shortcuts">{shortcuts.map(item => <Link key={item.id} to={`/${item.id}`}><HubIcon name={item.id} /><span>{item.label}</span></Link>)}</div>
    </section>
    <Link to="/family" className="hub-family-banner"><span className="hub-icon-box"><HubIcon name="family" /></span><span><strong>Deine Familie, deine Freigaben</strong><small>Profile einrichten und gezielt teilen.</small></span><HubIcon name="arrow" /></Link>
    <details className="hub-planned"><summary>Weitere Bereiche in Planung</summary><div>{modules.filter(m => !m.to).map(m => <span key={m.id}>{m.label}</span>)}</div></details>
    <footer className="hub-overview-footer"><p>Du entscheidest, wer deine privaten Daten sehen darf.</p><button type="button" onClick={() => setShowHistory(true)}>Versionsverlauf</button></footer>
    {showHistory && <ChangelogModal onClose={() => setShowHistory(false)} />}
  </div>
}
