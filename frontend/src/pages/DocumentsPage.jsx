import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { family, kinds } from '../lib/family'
import ResourceSharing from '../components/ResourceSharing'
const categories = ['Ausweis','Führerausweis','Krankenkassenkarte','Arztbericht','Labor','CT / MRT','Krankenkassenrechnung','Steuerunterlagen','Rezept','Andere']
export default function DocumentsPage() {
  const [rows,setRows] = useState([]), [persons,setPersons] = useState([]), [members,setMembers] = useState([]), [grants,setGrants] = useState([]), [extractions,setExtractions] = useState([]), [refs,setRefs] = useState([])
  const [userId,setUserId] = useState(''), [personId,setPersonId] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  const [title,setTitle] = useState(''), [category,setCategory] = useState(categories[0]), [expiry,setExpiry] = useState(''), [file,setFile] = useState(null)
  async function load() {
    const [r,p,m,g,e,ref,u]=await Promise.all([family.resources(),family.persons(),family.members(),family.grants(),family.extractions(),family.refs(),family.userId()])
    setRows(r); setPersons(p); setMembers(m); setGrants(g); setExtractions(e); setRefs(ref); setUserId(u); setPersonId(old => old || p[0]?.id || '')
  }
  useEffect(() => { load().catch(e => setError(e.message)) }, [])
  async function run(action) { setBusy(true); setError(''); try { await action(); await load() } catch(e) { setError(e.message) } finally { setBusy(false) } }
  async function upload(e) { e.preventDefault(); const form=e.currentTarget; await run(async () => { if (!file) throw new Error('Datei auswählen.'); await family.uploadDocument(file,{ person_id: personId, title: title.trim() || file.name, expires_on: expiry || null, details: { category } }); form.reset(); setFile(null); setTitle(''); setExpiry('') }) }
  async function open(row) {
    // Open synchronously so popup blockers allow the authorised document tab.
    const tab=window.open('about:blank','_blank'); if (tab) tab.opener=null
    try { const url=await family.openDocument(row); if (tab) tab.location.replace(url); else throw new Error('Bitte Pop-ups für Dokumente erlauben.') } catch(e) { tab?.close(); setError(e.message) }
  }
  return <div className="hub-page space-y-5">
    <h1 className="text-2xl font-bold">Privater Dokumententresor</h1>
    <p className="text-muted">Eine Datei, mehrere Verknüpfungen. Freigaben gelten einzeln; Öffnungslinks laufen nach 60 Sekunden ab.</p>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    {!persons.length ? <Link to="/family" className="hub-button inline-block">Persönliches Profil einrichten</Link> : <form onSubmit={upload} className="hub-card space-y-3">
      <label className="hub-label">Profil<select className="hub-input" value={personId} onChange={e => setPersonId(e.target.value)}>{persons.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
      <label className="hub-label">Datei (PDF oder Foto, maximal 20 MB)<input className="hub-input" required type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files[0] || null)} /></label>
      <label className="hub-label">Titel<input className="hub-input" maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="Dateiname als Standard" /></label>
      <div className="grid sm:grid-cols-2 gap-3"><label className="hub-label">Kategorie<select className="hub-input" value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label className="hub-label">Ablaufdatum<input type="date" className="hub-input" value={expiry} onChange={e => setExpiry(e.target.value)} /></label></div>
      <button className="hub-button" disabled={busy || !personId}>{busy ? 'Speichern…' : 'Privat speichern'}</button>
      <p className="text-xs text-muted">Dateien gehen nicht automatisch an einen KI-Dienst. Es werden keine bestehenden Krankenakten importiert.</p>
    </form>}
    <div className="grid sm:grid-cols-2 gap-4">{rows.filter(r => r.kind==='document').map(r => <article className="hub-card space-y-3" key={r.id}>
      <p className="text-xs text-muted">{r.details.category} · {persons.find(p => p.id===r.person_id)?.name || 'Geteiltes Profil'}</p><h2 className="font-semibold">{r.title}</h2>
      {r.expires_on && <p className={new Date(`${r.expires_on}T23:59:59`)<new Date() ? 'text-red-500' : 'text-muted'}>Gültig bis {r.expires_on}</p>}
      <button className="hub-button" onClick={() => open(r)}>Dokument öffnen</button>
      {r.owner_id===userId && <details><summary className="text-sm text-blue-500 cursor-pointer">KI-Vorschlag anfordern</summary><p className="text-xs text-muted my-2">Dabei wird diese Datei zur Verarbeitung an Anthropic übermittelt. Das Ergebnis bleibt ein Vorschlag und wird erst nach deiner Bestätigung übernommen.</p><button disabled={busy} className="hub-button" onClick={() => run(() => family.requestExtraction(r))}>Übermittlung zustimmen und Vorschlag erstellen</button></details>}
      {refs.filter(ref => ref.document_id===r.id).map(ref => <p className="text-sm" key={ref.resource_id}>Verknüpft: {rows.find(row => row.id===ref.resource_id)?.title}</p>)}
      {r.owner_id===userId && <label className="hub-label">Weiteren Eintrag verknüpfen<select className="hub-input" disabled={busy} value="" onChange={e => { if (e.target.value) run(() => family.reference({ document_id: r.id, resource_id: e.target.value, owner_id: userId, person_id: r.person_id })) }}><option value="">Auswählen</option>{rows.filter(row => row.kind!=='document' && row.person_id===r.person_id && row.owner_id===userId && !refs.some(ref => ref.document_id===r.id && ref.resource_id===row.id)).map(row => <option key={row.id} value={row.id}>{kinds[row.kind]} · {row.title}</option>)}</select></label>}
      {extractions.filter(e => e.document_id===r.id).map(e => <div key={e.id} className="bg-elevated rounded-lg p-3"><p className="font-semibold">KI-Vorschlag · {Math.round(Number(e.confidence)*100)} %</p><p className="text-xs break-all">Quelle: {e.source}</p><pre className="text-xs whitespace-pre-wrap break-all my-2">{JSON.stringify(e.proposal,null,2)}</pre>{e.status==='pending' ? <div className="flex gap-2"><button disabled={busy} className="hub-button" onClick={() => run(() => family.review(e.id,true))}>Bestätigen</button><button disabled={busy} onClick={() => run(() => family.review(e.id,false))}>Verwerfen</button></div> : <p>{e.status==='confirmed' ? 'Bestätigt' : 'Verworfen'}</p>}</div>)}
      <ResourceSharing row={r} userId={userId} members={members} grants={grants} reload={load} onError={setError} />
      {r.owner_id===userId && <button disabled={busy} className="text-red-500 text-sm" onClick={() => { if (confirm('Dokument und Verknüpfungen löschen?')) run(() => family.remove(r)) }}>Löschen</button>}
    </article>)}</div>
    {!rows.some(r => r.kind==='document') && <p className="text-muted">Noch keine Dokumente.</p>}
  </div>
}
