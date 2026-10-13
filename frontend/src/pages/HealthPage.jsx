import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { family, kinds, symptomCatalog, localDay, localDateTime } from '../lib/family'
import ResourceSharing from '../components/ResourceSharing'
import PushSettings from '../components/PushSettings'

export default function HealthPage() {
  const [rows,setRows] = useState([]), [persons,setPersons] = useState([]), [members,setMembers] = useState([]), [grants,setGrants] = useState([]), [doses,setDoses] = useState([])
  const [userId,setUserId] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false), [personId,setPersonId] = useState(''), [filter,setFilter] = useState('')
  const [kind,setKind] = useState('symptom'), [title,setTitle] = useState(symptomCatalog[0]), [notes,setNotes] = useState(''), [intensity,setIntensity] = useState(5), [at,setAt] = useState(localDateTime())
  const [dose,setDose] = useState(''), [slots,setSlots] = useState('08:00'), [favorite,setFavorite] = useState(false), [caseId,setCaseId] = useState(''), [until,setUntil] = useState('')
  const [dictating,setDictating] = useState(false), recognition = useRef(null)
  async function load() {
    const [r,p,m,g,d,u] = await Promise.all([family.resources(),family.persons(),family.members(),family.grants(),family.doses(),family.userId()])
    setRows(r.filter(r => r.kind!=='document')); setPersons(p); setMembers(m); setGrants(g); setDoses(d); setUserId(u)
    setPersonId(old => old || p.find(x => x.fh_kind==='self')?.id || p[0]?.id || '')
  }
  useEffect(() => { load().catch(e => setError(e.message)); return () => recognition.current?.abort() }, [])
  async function run(action) { setBusy(true); setError(''); try { await action(); await load() } catch(e) { setError(e.message) } finally { setBusy(false) } }
  async function save(e) {
    e.preventDefault()
    await run(async () => {
      const schedule = slots.split(',').map(s => s.trim()).filter(Boolean)
      if (kind==='medication' && (!dose.trim() || !schedule.length || schedule.some(s => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)))) throw new Error('Dosierung und Uhrzeiten im Format HH:MM angeben.')
      await family.create({ person_id: personId, kind, title: title.trim(), occurred_at: new Date(at).toISOString(), intensity: kind==='symptom' ? Number(intensity) : null,
        details: { notes, ...(caseId ? { case_id: caseId } : {}), ...(kind==='medication' ? { dosage: dose, slots: [...new Set(schedule)], category: 'medication' } : {}), ...(kind==='nutrition' ? { favorite } : {}), ...(until ? { end_at: new Date(until).toISOString() } : {}) } })
      setNotes(''); setAt(localDateTime())
    })
  }
  function dictate() {
    if (dictating) { recognition.current?.stop(); return }
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Ctor) { setError('Diktat wird von diesem Browser nicht unterstützt.'); return }
    const rec = new Ctor(); recognition.current=rec; rec.lang='de-CH'; rec.continuous=false
    rec.onresult=e => setNotes(n => `${n} ${e.results[0][0].transcript}`.trim())
    rec.onend=() => setDictating(false); rec.onerror=() => { setDictating(false); setError('Diktat konnte nicht gestartet werden.') }
    try { rec.start(); setDictating(true) } catch { setError('Mikrofon nicht verfügbar.') }
  }
  const today = localDay(), visible = rows.filter(r => !filter || r.person_id===filter)
  const canEdit = row => row.owner_id===userId || grants.some(g => g.resource_id===row.id && g.recipient_id===userId && g.permission==='edit')
  return <div className="hub-page space-y-5">
    <h1 className="text-2xl font-bold">Gesundheit</h1>
    <p className="text-muted">Dein Verlauf und ausdrücklich mit dir geteilte Einträge.</p>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    <PushSettings />
    {!persons.length ? <Link to="/family" className="hub-button inline-block">Zuerst ein persönliches Profil anlegen</Link> : <form onSubmit={save} className="hub-card space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="hub-label">Profil<select className="hub-input" value={personId} onChange={e => setPersonId(e.target.value)}>{persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="hub-label">Eintrag<select className="hub-input" value={kind} onChange={e => { setKind(e.target.value); setTitle(e.target.value==='symptom' ? symptomCatalog[0] : '') }}>{Object.entries(kinds).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <label className="hub-label">{kind==='symptom' ? 'Beschwerde' : 'Titel'}<input className="hub-input" list={kind==='symptom' ? 'symptoms' : undefined} value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} /></label>
      <datalist id="symptoms">{symptomCatalog.map(s => <option key={s} value={s} />)}</datalist>
      {kind==='symptom' && <label className="hub-label">Intensität: {intensity} / 10<input aria-label="Intensität" className="w-full mt-2" type="range" min="0" max="10" value={intensity} onChange={e => setIntensity(e.target.value)} /></label>}
      <label className="hub-label">Datum und Uhrzeit<input type="datetime-local" className="hub-input" required value={at} onChange={e => setAt(e.target.value)} /></label>
      {kind==='hospital' && <label className="hub-label">Entlassung (optional)<input type="datetime-local" className="hub-input" value={until} onChange={e => setUntil(e.target.value)} /></label>}
      {kind==='medication' && <div className="grid sm:grid-cols-2 gap-3"><label className="hub-label">Dosierung<input required className="hub-input" value={dose} placeholder="z.B. 1 Tablette" onChange={e => setDose(e.target.value)} /></label><label className="hub-label">Tägliche Uhrzeiten<input required className="hub-input" value={slots} placeholder="08:00, 20:00" onChange={e => setSlots(e.target.value)} /></label></div>}
      {kind==='nutrition' && <label className="hub-label"><input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} /> Als Favorit speichern</label>}
      {kind!=='case' && <label className="hub-label">Gesundheitsfall (optional)<select className="hub-input" value={caseId} onChange={e => setCaseId(e.target.value)}><option value="">Ohne Zuordnung</option>{rows.filter(r => r.kind==='case' && r.person_id===personId && r.owner_id===userId).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label>}
      <label className="hub-label">Notizen / Befund / Plan<textarea className="hub-input" rows="3" value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <div className="flex flex-wrap gap-3"><button className="hub-button" disabled={busy || !personId}>Speichern</button><button className="text-blue-500 px-3" type="button" onClick={dictate}>{dictating ? 'Diktat beenden' : '🎙 Diktieren'}</button></div>
      <p className="text-xs text-muted">Diktat startet nur auf Wunsch. Je nach Browser verarbeitet ein externer Spracherkennungsdienst die Aufnahme.</p>
    </form>}
    <section className="hub-card space-y-3"><h2 className="font-semibold">Heute · Einnahmen</h2>
      {rows.filter(r => r.kind==='medication' && canEdit(r)).map(r => <div key={r.id}><p>{r.title} · {r.details.dosage}</p><div className="flex flex-wrap gap-3">{(r.details.slots || []).map(slot => {
        const taken=doses.some(d => d.resource_id===r.id && d.day===today && d.slot===slot)
        return <label className="flex items-center gap-2 py-2" key={slot}><input type="checkbox" disabled={busy} checked={taken} onChange={() => run(() => taken ? family.untake(r.id,today,slot) : family.take(r.id,today,slot))} />{slot}</label>
      })}</div></div>)}
      {!rows.some(r => r.kind==='medication') && <p className="text-muted">Noch kein Dosierungsplan angelegt.</p>}
    </section>
    <section className="hub-card"><h2 className="font-semibold mb-2">Erinnerungen</h2><p className="text-xs text-muted mb-2">Aktiviere die Hintergrund-Erinnerungen oben, um auf diesem Gerät auch bei geschlossener App benachrichtigt zu werden.</p>{rows.filter(r => ['reminder','visit','examination'].includes(r.kind) && localDay(new Date(r.occurred_at))>=today).sort((a,b) => a.occurred_at.localeCompare(b.occurred_at)).map(r => <p key={r.id}>{new Date(r.occurred_at).toLocaleString()} · {r.title}</p>)}</section>
    <label className="hub-label">Verlauf filtern<select className="hub-input" value={filter} onChange={e => setFilter(e.target.value)}><option value="">Alle sichtbaren Profile</option>{persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="grid sm:grid-cols-2 gap-4">{visible.map(r => <article key={r.id} className="hub-card space-y-2">
      <p className="text-xs text-muted">{kinds[r.kind]} · {new Date(r.occurred_at).toLocaleString()} · {persons.find(p => p.id===r.person_id)?.name || 'Geteiltes Profil'}</p>
      <h2 className="font-semibold">{r.title}{r.intensity!==null && <span className="text-blue-500"> · {r.intensity}/10</span>}</h2>
      {r.intensity!==null && <meter className="w-full" min="0" max="10" value={r.intensity} aria-label="Beschwerdeintensität" />}
      <p className="whitespace-pre-wrap text-sm">{r.details.notes}</p>
      {r.details.dosage && <p className="text-sm">{r.details.dosage} · {(r.details.slots || []).join(', ')}</p>}
      {r.details.case_id && <p className="text-xs text-muted">Fall: {rows.find(c => c.id===r.details.case_id)?.title || 'Separat freigegebener Fall'}</p>}
      {r.kind==='nutrition' && r.details.favorite && r.owner_id===userId && <button disabled={busy} className="text-blue-500 text-sm py-2" onClick={() => run(() => family.create({ person_id: r.person_id, kind: 'nutrition', title: r.title, details: r.details, occurred_at: new Date().toISOString() }))}>★ Heute erneut erfassen</button>}
      {canEdit(r) && <details><summary className="text-blue-500 text-sm cursor-pointer">Notiz bearbeiten</summary><form className="space-y-2" onSubmit={e => { e.preventDefault(); const text=new FormData(e.currentTarget).get('notes'); run(() => family.update(r.id,{ details: { ...r.details, notes: text } })) }}><textarea className="hub-input" name="notes" defaultValue={r.details.notes} /><button className="hub-button" disabled={busy}>Änderung speichern</button></form></details>}
      <ResourceSharing row={r} userId={userId} members={members} grants={grants} reload={load} onError={setError} />
      {r.owner_id===userId && <button disabled={busy} className="text-sm text-red-500" onClick={() => { if (confirm('Eintrag löschen?')) run(() => family.remove(r)) }}>Löschen</button>}
    </article>)}</div>
    {!visible.length && <p className="text-muted">Noch keine Einträge. Neue Einträge sind zunächst privat.</p>}
  </div>
}
