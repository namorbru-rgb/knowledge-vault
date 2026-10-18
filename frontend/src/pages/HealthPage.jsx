import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { family, kinds, symptomCatalog, localDay, localDateTime } from '../lib/family'
import { buildSymptomPeriod, symptomPeriodLabel } from '../lib/symptomPeriod'
import ResourceSharing from '../components/ResourceSharing'
import PushSettings from '../components/PushSettings'

const quickActions = [
  { id:'symptom', title:'Beschwerde erfassen', icon:'♡', subtitle:'Was tut weh?' },
  { id:'doses', title:'Einnahmen abhaken', icon:'✓', subtitle:'Heute erledigt?' },
  { id:'medication', title:'Präparat einrichten', icon:'+', subtitle:'Nur einmal anlegen' },
  { id:'nutrition', title:'Ernährung', icon:'◌', subtitle:'Mahlzeit festhalten' },
]
const advancedKinds = ['visit','case','examination','hospital','prescription','reminder']
const mealSuggestions = ['Frühstück','Mittagessen','Abendessen','Zwischenmahlzeit','Wasser']
const asDate = value => { try { return new Date(value).toLocaleString('de-CH',{dateStyle:'short',timeStyle:'short'}) } catch { return value } }

export default function HealthPage() {
  const [searchParams,setSearchParams] = useSearchParams()
  const initialMode = searchParams.get('action')
  const [mode,setMode] = useState(['symptom','doses','medication','nutrition','advanced'].includes(initialMode) ? initialMode : 'symptom')
  const [advancedKind,setAdvancedKind] = useState('visit')
  const [rows,setRows] = useState([])
  const [persons,setPersons] = useState([])
  const [members,setMembers] = useState([])
  const [grants,setGrants] = useState([])
  const [doses,setDoses] = useState([])
  const [userId,setUserId] = useState('')
  const [personId,setPersonId] = useState('')
  const [busy,setBusy] = useState(false)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [success,setSuccess] = useState('')
  const [title,setTitle] = useState(symptomCatalog[0])
  const [notes,setNotes] = useState('')
  const [intensity,setIntensity] = useState(5)
  const [at,setAt] = useState(localDateTime())
  // The date range is deliberately visible for symptoms, including past events.
  const [symptomFromDate,setSymptomFromDate] = useState(localDay())
  const [symptomUntilMode,setSymptomUntilMode] = useState('same')
  const [symptomToDate,setSymptomToDate] = useState('')
  const [symptomUseTime,setSymptomUseTime] = useState(false)
  const [symptomFromTime,setSymptomFromTime] = useState('')
  const [symptomToTime,setSymptomToTime] = useState('')
  const [dose,setDose] = useState('')
  const [slot1,setSlot1] = useState('08:00')
  const [slot2,setSlot2] = useState('')
  const [category,setCategory] = useState('Vitamin')
  const [favorite,setFavorite] = useState(false)
  const [dictating,setDictating] = useState(false)
  const [filterHistory,setFilterHistory] = useState(false)
  const speech = useRef(null)

  async function load() {
    const [r,p,m,g,d,u] = await Promise.all([
      family.resources(),family.selectableProfiles(),family.members(),
      family.grants(),family.doses(),family.userId(),
    ])
    setRows(r.filter(row=>row.kind!=='document'))
    setPersons(p);setMembers(m);setGrants(g);setDoses(d);setUserId(u)
    setPersonId(current => p.some(person=>person.id===current) ? current :
      p.find(person=>person.profile_owner_id===u && person.fh_kind==='self')?.id || p[0]?.id || '')
  }
  useEffect(()=>{
    let mounted=true
    load().catch(err=>{if(mounted)setError(err.message)}).finally(()=>{if(mounted)setLoading(false)})
    return ()=>{mounted=false;speech.current?.abort()}
  },[])
  useEffect(()=>{
    const action=searchParams.get('action')
    if(['symptom','doses','medication','nutrition','advanced'].includes(action))setMode(action)
  },[searchParams])

  function chooseMode(next) {
    setMode(next);setSuccess('');setError('')
    if(next==='symptom')setTitle(symptomCatalog[0])
    else if(next==='nutrition')setTitle('')
    else if(next==='medication')setTitle('')
    setSearchParams(next==='symptom'?{}:{action:next})
  }
  async function run(work) {
    setBusy(true);setError('');setSuccess('')
    try {await work();await load()}
    catch(err){setError(err.message || 'Speichern fehlgeschlagen.')}
    finally {setBusy(false)}
  }
  const selected=persons.find(p=>p.id===personId)
  const mine=selected?.profile_owner_id===userId
  const today=localDay()
  const visible=rows.filter(r=>r.person_id===personId)
  const canEdit=r=>r.owner_id===userId||grants.some(g=>g.resource_id===r.id&&g.recipient_id===userId&&g.permission==='edit')
  const scheduled=visible.filter(r=>r.kind==='medication'&&canEdit(r))
  const intakeEvents=scheduled.flatMap(r=>(r.details?.slots||[]).map(slot=>({
    row:r,slot,taken:doses.some(d=>d.resource_id===r.id&&d.day===today&&d.slot===slot),
  })))
  const checked=intakeEvents.filter(e=>e.taken).length
  const knownSymptomNames=[
    ...new Set([...symptomCatalog.filter(s=>s!=='Andere Beschwerde'),
      ...visible.filter(r=>r.kind==='symptom').map(r=>r.title)]),
  ].slice(0,14)
  const favoriteFoods=[
    ...new Set(visible.filter(r=>r.kind==='nutrition'&&r.details?.favorite).map(r=>r.title)),
  ].slice(0,6)

  async function save(event) {
    event.preventDefault()
    if(!selected)return setError('Bitte zuerst ein Familienmitglied auswählen.')
    const kind=mode==='advanced'?advancedKind:mode
    const label=String(title||'').trim()
    if(!label)return setError('Bitte eine Beschwerde oder einen Namen auswählen.')
    let details={notes:notes.trim()}
    if(kind==='medication'){
      const slots=[slot1,slot2].filter(Boolean)
      if(!dose.trim()||!slots.length)return setError('Dosierung und Einnahmezeit fehlen.')
      details={...details,dosage:dose.trim(),slots:[...new Set(slots)],category}
    }
    if(kind==='nutrition')details={...details,favorite}
    setBusy(true);setError('');setSuccess('')
    try {
      const period = kind==='symptom' ? buildSymptomPeriod({
        fromDate:symptomFromDate, untilMode:symptomUntilMode,
        untilDate:symptomToDate, useTime:symptomUseTime,
        fromTime:symptomFromTime, untilTime:symptomToTime,
      }) : null
      await family.createForPerson({
        person_id:personId,kind,title:label,
        occurred_at:period?.occurred_at || new Date(at).toISOString(),
        intensity:kind==='symptom'?Number(intensity):null,
        details:{ ...details,...(period?.details || {}) },
      })
      await load()
      setSuccess(`${label} für ${selected.name} gespeichert.`)
      setNotes('');setAt(localDateTime())
      if(kind==='nutrition')setTitle('')
      if(kind==='medication'){setTitle('');setDose('')}
    }catch(err){setError(err.message||'Speichern fehlgeschlagen.')}
    finally{setBusy(false)}
  }
  function dictate(){
    if(dictating){speech.current?.stop();return}
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition
    if(!Recognition){setError('Nutze die Mikrofontaste deiner iPhone-Tastatur für die Spracheingabe.');return}
    const rec=new Recognition();speech.current=rec;rec.lang='de-CH';rec.continuous=false
    rec.onresult=event=>setNotes(old=>[old,event.results[0][0].transcript].filter(Boolean).join(' ').trim())
    rec.onend=()=>setDictating(false)
    rec.onerror=()=>{setDictating(false);setError('Spracheingabe nicht verfügbar. Du kannst die iPhone-Diktierfunktion verwenden.')}
    try{rec.start();setDictating(true)}catch{setError('Mikrofon nicht verfügbar.')}
  }
  if(loading)return <div className="hub-page"><h1 className="text-2xl font-bold">Gesundheit</h1><p className="text-muted">Lade Familienprofile…</p></div>
  return <div className="hub-page space-y-5">
    <header>
      <h1 className="text-2xl font-bold">Gesundheit</h1>
      <p className="text-muted mt-1">Beschwerden notieren, Einnahmen abhaken und Verläufe ansehen.</p>
    </header>
    {error&&<p role="alert" className="hub-feedback-error">{error}</p>}
    {success&&<p role="status" className="hub-feedback-success">{success}</p>}
    {!persons.length ? <div className="hub-card space-y-3">
      <h2 className="font-semibold">Noch kein Gesundheitsprofil vorhanden</h2>
      <p className="text-muted text-sm">Erstelle ein eigenes Profil oder bitte ein Familienmitglied um die Freigabe.</p>
      <Link className="hub-button inline-block" to="/family">Familienprofile einrichten</Link>
    </div> : <>
      <section className="hub-card space-y-3" aria-labelledby="health-person-heading">
        <h2 id="health-person-heading" className="font-semibold">Für wen?</h2>
        <div className="hub-person-picks">
          {persons.map(p=><button key={p.id} type="button" className={`hub-person-pill ${personId===p.id?'is-selected':''}`}
            aria-pressed={personId===p.id} onClick={()=>{setPersonId(p.id);setSuccess('');setError('')}}>{p.name}</button>)}
        </div>
        {selected&&!mine&&<p className="text-xs text-muted">Du darfst für {selected.name} neue Einträge erfassen. Frühere private Akten bleiben geschützt.</p>}
      </section>
      <section aria-labelledby="health-action-heading">
        <h2 id="health-action-heading" className="hub-section-title">Was möchtest du tun?</h2>
        <div className="hub-quick-actions">
          {quickActions.map(action=><button key={action.id} type="button" onClick={()=>chooseMode(action.id)}
            className={`hub-quick-action ${mode===action.id?'is-selected':''}`} aria-pressed={mode===action.id}>
            <span className="hub-quick-symbol">{action.icon}</span>
            <span><strong>{action.title}</strong><small>{action.subtitle}</small></span>
          </button>)}
        </div>
      </section>
      {mode==='doses'&&<section className="hub-card space-y-3">
        <h2 className="text-lg font-semibold">Einnahmen heute · {selected?.name}</h2>
        {intakeEvents.length ? <>
          <p className="text-sm text-muted">{checked} von {intakeEvents.length} bestätigt</p>
          {intakeEvents.map(({row,slot,taken})=><label key={row.id+slot} className="hub-intake-item">
            <input type="checkbox" disabled={busy} checked={taken}
              onChange={()=>run(()=>taken?family.untake(row.id,today,slot):family.take(row.id,today,slot))}/>
            <span className="flex-1"><strong>{row.title}</strong><small>{row.details?.dosage} · {slot} Uhr</small></span>
            <span className={taken?'text-green-700 font-semibold':'text-muted'}>{taken?'Erledigt':'Offen'}</span>
          </label>)}
        </> : <>
          <p className="text-muted text-sm">Für {selected?.name} sind noch keine Einnahmen eingerichtet, auf die du Zugriff hast.</p>
          <button type="button" className="hub-button" onClick={()=>chooseMode('medication')}>Vitamin oder Medikament anlegen</button>
        </>}
      </section>}
      {mode!=='doses'&&<form onSubmit={save} className="hub-card space-y-4">
        <h2 className="text-lg font-semibold">{mode==='symptom'?'Welche Beschwerde?':
          mode==='medication'?'Präparat einmalig einrichten':
          mode==='nutrition'?'Was wurde gegessen?':'Weiteren Gesundheitseintrag erfassen'}</h2>
        {mode==='symptom'&&<>
          <div className="hub-choice-grid">
            {knownSymptomNames.map(name=><button key={name} type="button" className={`hub-choice ${title===name?'is-selected':''}`}
              aria-pressed={title===name} onClick={()=>setTitle(name)}>{name}</button>)}
          </div>
          <label className="hub-label">Andere Beschwerde oder Bezeichnung
            <input className="hub-input" value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} required/>
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><label htmlFor="severity" className="font-semibold text-sm">Wie stark?</label><strong className="text-lg">{intensity} / 10</strong></div>
            <input id="severity" aria-label="Intensität" className="w-full" type="range" min="0" max="10"
              value={intensity} onChange={e=>setIntensity(Number(e.target.value))}/>
            <div className="flex justify-between text-xs text-muted"><span>Keine</span><span>Sehr stark</span></div>
          </div>
          <section className="rounded-xl border border-line p-3 space-y-3" aria-label="Beschwerdezeitraum">
            <h3 className="font-semibold">Wann war die Beschwerde?</h3>
            <p className="text-sm text-muted">Auch rückwirkend erfassen. Uhrzeiten sind freiwillig.</p>
            <label className="hub-label">Von (Datum)
              <input className="hub-input" type="date" required max={localDay()}
                value={symptomFromDate}
                onChange={e=>setSymptomFromDate(e.target.value)}/>
            </label>
            <label className="hub-label">Bis
              <select className="hub-input" aria-label="Ende der Beschwerde" value={symptomUntilMode}
                onChange={e=>setSymptomUntilMode(e.target.value)}>
                <option value="same">Am gleichen Tag</option>
                <option value="date">Anderes Enddatum wählen</option>
                <option value="ongoing">Dauert noch an</option>
              </select>
            </label>
            {symptomUntilMode==='date'&&<label className="hub-label">Bis (Datum)
              <input className="hub-input" type="date" required min={symptomFromDate} max={localDay()}
                value={symptomToDate} onChange={e=>setSymptomToDate(e.target.value)}/>
            </label>}
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={symptomUseTime}
                onChange={e=>setSymptomUseTime(e.target.checked)}/>
              Uhrzeit ebenfalls erfassen
            </label>
            {symptomUseTime&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="hub-label">Von (Uhrzeit)
                <input className="hub-input" type="time" required value={symptomFromTime}
                  onChange={e=>setSymptomFromTime(e.target.value)}/>
              </label>
              {symptomUntilMode!=='ongoing'&&<label className="hub-label">Bis (Uhrzeit)
                <input className="hub-input" type="time" required value={symptomToTime}
                  onChange={e=>setSymptomToTime(e.target.value)}/>
              </label>}
            </div>}
          </section>
        </>}
        {mode==='medication'&&<>
          <label className="hub-label">Was wird eingenommen?
            <input className="hub-input" placeholder="z. B. Magnesium" value={title} onChange={e=>setTitle(e.target.value)} required maxLength={200}/>
          </label>
          <div className="hub-person-picks">
            {['Vitamin','Supplement','Medikament'].map(c=><button key={c} type="button" className={`hub-person-pill ${category===c?'is-selected':''}`}
              onClick={()=>setCategory(c)} aria-pressed={category===c}>{c}</button>)}
          </div>
          <label className="hub-label">Dosierung
            <input className="hub-input" placeholder="z. B. 1 Kapsel" value={dose} onChange={e=>setDose(e.target.value)} required maxLength={120}/>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="hub-label">Uhrzeit<input className="hub-input" type="time" value={slot1} onChange={e=>setSlot1(e.target.value)} required/></label>
            <label className="hub-label">Zweite Uhrzeit (optional)<input className="hub-input" type="time" value={slot2} onChange={e=>setSlot2(e.target.value)}/></label>
          </div>
        </>}
        {mode==='nutrition'&&<>
          <div className="hub-choice-grid">
            {[...new Set([...favoriteFoods,...mealSuggestions])].map(food=><button key={food} type="button"
              className={`hub-choice ${title===food?'is-selected':''}`} aria-pressed={title===food}
              onClick={()=>setTitle(food)}>{food}</button>)}
          </div>
          <label className="hub-label">Mahlzeit oder Lebensmittel
            <input className="hub-input" placeholder="Einmal schreiben, später auswählen" value={title} onChange={e=>setTitle(e.target.value)} required maxLength={200}/>
          </label>
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={favorite} onChange={e=>setFavorite(e.target.checked)}/>Für später merken</label>
        </>}
        {mode==='advanced'&&<>
          <label className="hub-label">Was möchtest du dokumentieren?
            <select className="hub-input" value={advancedKind} onChange={e=>setAdvancedKind(e.target.value)}>
              {advancedKinds.map(k=><option key={k} value={k}>{kinds[k]}</option>)}
            </select>
          </label>
          <label className="hub-label">Bezeichnung
            <input className="hub-input" placeholder="z. B. Arzttermin" required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/>
          </label>
        </>}
        <details className="hub-more">
          <summary>{mode==='symptom'?'Bemerkung oder Spracheingabe ergänzen (optional)':'Datum, Bemerkungen oder Spracheingabe ergänzen (optional)'}</summary>
          <div className="space-y-3 mt-3">
            {mode!=='symptom'&&<label className="hub-label">Datum und Uhrzeit
              <input className="hub-input" type="datetime-local" value={at} onChange={e=>setAt(e.target.value)} required/>
            </label>}
            <label className="hub-label">Bemerkung
              <textarea className="hub-input" rows="3" value={notes} onChange={e=>setNotes(e.target.value)}
                placeholder="Optional etwas dazu sagen oder schreiben"/>
            </label>
            <button type="button" className="hub-secondary-button" onClick={dictate}>{dictating?'Diktat beenden':'Mit Sprache ergänzen'}</button>
            <p className="text-xs text-muted">Je nach Browser erfolgt die Spracherkennung durch den Geräteanbieter.</p>
          </div>
        </details>
        <button className="hub-button w-full sm:w-auto" disabled={busy||!personId||!title.trim()}>
          {busy?'Speichere…':mode==='symptom'?'Beschwerde speichern':'Speichern'}
        </button>
      </form>}
      {mode!=='doses'&&intakeEvents.length>0&&<section className="hub-card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Einnahmen heute</h2>
          <button className="text-blue-600 text-sm" type="button" onClick={()=>chooseMode('doses')}>Alle anzeigen</button>
        </div>
        <p className="text-sm text-muted">{checked}/{intakeEvents.length} erledigt</p>
        {intakeEvents.slice(0,3).map(({row,slot,taken})=><label key={row.id+slot} className="hub-intake-item">
          <input type="checkbox" checked={taken} disabled={busy} onChange={()=>run(()=>taken?family.untake(row.id,today,slot):family.take(row.id,today,slot))}/>
          <span className="flex-1"><strong>{row.title}</strong><small>{row.details?.dosage} · {slot}</small></span>
          <span>{taken?'✓':''}</span>
        </label>)}
      </section>}
      {visible.length>0&&<section className="hub-card space-y-3">
        <div className="flex justify-between items-center gap-2">
          <h2 className="font-semibold">Zuletzt erfasst</h2>
          <button type="button" className="text-blue-600 text-sm" onClick={()=>setFilterHistory(v=>!v)}>{filterHistory?'Weniger anzeigen':'Verlauf anzeigen'}</button>
        </div>
        {(filterHistory?visible:visible.slice(0,3)).map(r=><article key={r.id} className="border-b border-line last:border-0 pb-3 space-y-2">
          <p className="text-xs text-muted">{kinds[r.kind]} · {r.kind==='symptom'?symptomPeriodLabel(r):asDate(r.occurred_at)}</p>
          <h3 className="font-semibold">{r.title}{r.kind==='symptom'&&r.intensity!==null?` · ${r.intensity}/10`:''}</h3>
          {r.details?.notes&&<p className="text-sm whitespace-pre-wrap">{r.details.notes}</p>}
          {r.details?.dosage&&<p className="text-sm text-muted">{r.details.dosage}</p>}
          {filterHistory&&<>
            {canEdit(r)&&<details className="hub-more"><summary>Bemerkung bearbeiten</summary>
              <form className="space-y-2 mt-2" onSubmit={e=>{e.preventDefault();const value=new FormData(e.currentTarget).get('notes');run(()=>family.update(r.id,{details:{...r.details,notes:value}}))}}>
                <textarea className="hub-input" name="notes" defaultValue={r.details?.notes||''}/><button className="hub-button" disabled={busy}>Änderung speichern</button>
              </form>
            </details>}
            <ResourceSharing row={r} userId={userId} members={members} grants={grants} reload={load} onError={setError}/>
            {r.owner_id===userId&&<button className="text-xs text-red-600" disabled={busy} onClick={()=>{if(window.confirm('Eintrag wirklich löschen?'))run(()=>family.remove(r))}}>Löschen</button>}
          </>}
        </article>)}
      </section>}
      <details className="hub-more">
        <summary>Weitere Funktionen: Arztbesuche, Untersuchungen, Erinnerungen</summary>
        <div className="space-y-3 mt-3">
          <button type="button" className="hub-secondary-button" onClick={()=>{chooseMode('advanced');setTitle('')}}>Arztbesuch oder weiteren Eintrag erfassen</button>
          <PushSettings/>
        </div>
      </details>
    </>}
  </div>
}
