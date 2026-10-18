import { useEffect, useState } from 'react'
import { family } from '../lib/family'
import PasswordSettings from '../components/PasswordSettings'
import PasskeySettings from '../components/PasskeySettings'
import FamilyAdminPanel from '../components/FamilyAdminPanel'

export default function FamilyPage() {
  const [persons, setPersons] = useState([])
  const [members, setMembers] = useState([])
  const [care, setCare] = useState([])
  const [families, setFamilies] = useState([])
  const [userId, setUserId] = useState('')
  const [name, setName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function load() {
    try {
      const [p, m, f, u, c] = await Promise.all([
        family.persons(), family.members(), family.families(), family.userId(),
        family.carePermissions(),
      ])
      setPersons(p); setMembers(m); setFamilies(f); setUserId(u); setCare(c)
    } catch (err) { setError(err.message) }
  }
  useEffect(() => { load() }, [])

  async function run(event, operation) {
    event.preventDefault(); setBusy(true); setError(''); setInfo('')
    try { await operation(); await load(); setInfo('Gespeichert.') }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  const ownProfile = persons.find(p => p.fh_kind === 'self')
  const children = persons.filter(p => p.fh_kind === 'child')
  const otherAdults = members.filter(m=>m.user_id!==userId && members.some(own=>own.user_id===userId&&own.family_id===m.family_id))
    .filter((m,i,arr)=>arr.findIndex(x=>x.user_id===m.user_id)===i)

  return <div className="hub-page space-y-5">
    <header className="space-y-2">
      <h1 className="text-2xl font-bold">Meine Familie</h1>
      <p className="text-muted">Familienmitglieder und Zugänge an einem Ort verwalten.</p>
    </header>
    {error && <p className="text-red-600" role="alert">{error}</p>}
    {info && <p className="text-green-700" role="status">{info}</p>}

    {import.meta.env.VITE_PASSKEY_ENABLED === 'true' && <PasskeySettings />}
    <FamilyAdminPanel />

    <section className="hub-card space-y-3">
      <h2 className="font-semibold text-lg">Familie</h2>
      {families.length > 0 ? families.map(f => <div key={f.id} className="space-y-2">
        <div className="text-lg font-semibold">{f.name}</div>
        <div className="space-y-1">
          {members.filter(m => m.family_id === f.id).map(m =>
            <div className="flex justify-between gap-2 rounded-lg bg-elevated px-3 py-2" key={m.user_id}>
              <span>{m.display_name}</span>
              <span className="text-sm text-muted">{m.role === 'admin' ? 'Administration' : 'Mitglied'}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted">Erwachsene verwenden ihre persönlichen Konten. Private Einträge bleiben durch eigene Zugriffsrechte geschützt.</p>
      </div>) : <form className="space-y-3" onSubmit={event => run(event, async () => {
        await family.createFamily(familyName.trim(), displayName.trim())
        setFamilyName(''); setDisplayName('')
      })}>
        <p className="text-sm text-muted">Du gehörst noch keiner Familie an. Nur einmal einrichten.</p>
        <label className="hub-label">Familienname
          <input className="hub-input" required value={familyName} onChange={event => setFamilyName(event.target.value)} placeholder="z. B. Bruderer" />
        </label>
        <label className="hub-label">Dein Vorname
          <input className="hub-input" required value={displayName} onChange={event => setDisplayName(event.target.value)} />
        </label>
        <button className="hub-button" disabled={busy}>Familie erstellen</button>
      </form>}
    </section>

    <section className="hub-card space-y-3">
      <h2 className="font-semibold text-lg">Gesundheitsprofile</h2>
      {ownProfile ? <p>Mein Profil: <strong>{ownProfile.name}</strong></p> :
        <form className="space-y-2" onSubmit={event => run(event, async () => {
          await family.addPerson(name.trim(), 'self'); setName('')
        })}>
          <p className="text-sm text-muted">Dein persönliches Profil einmalig anlegen.</p>
          <label className="hub-label">Dein Name
            <input className="hub-input" required value={name} onChange={event => setName(event.target.value)} />
          </label>
          <button disabled={busy} className="hub-button">Mein Profil anlegen</button>
        </form>}
      {children.length > 0 && <div className="space-y-1">
        <h3 className="font-medium">Kinderprofile</h3>
        {children.map(c => <p key={c.id} className="rounded-lg bg-elevated px-3 py-2">{c.name}</p>)}
      </div>}
      {!!persons.length && !!otherAdults.length && <details className="border border-line rounded-xl p-3">
        <summary className="cursor-pointer font-medium">Wer darf für uns Beschwerden erfassen?</summary>
        <div className="space-y-3 mt-3">
          <p className="text-sm text-muted">Hier erlaubst du anderen Familienmitgliedern, neue Gesundheitseinträge für dein Profil oder die Kinder unter deiner Verantwortung zu erfassen. Bestehende private Akten bleiben geschützt.</p>
          {persons.map(p=><div key={p.id} className="space-y-2">
            <h3 className="font-semibold text-sm">{p.name}</h3>
            {otherAdults.map(m=>{
              const active=care.some(c=>c.person_id===p.id&&c.caregiver_id===m.user_id)
              return <div key={m.user_id} className="flex items-center justify-between gap-2 border border-line rounded-lg px-3 py-2">
                <span className="text-sm">{m.display_name}</span>
                <button type="button" disabled={busy} className={active?'hub-secondary-button':'hub-button'}
                  onClick={()=>run({preventDefault(){}},()=>active?family.revokeCare(p.id,m.user_id):family.grantCare(p.id,m.user_id))}>
                  {active?'Freigabe beenden':'Erfassen erlauben'}
                </button>
              </div>
            })}
          </div>)}
        </div>
      </details>}
      <details className="border border-line rounded-xl p-3">
        <summary className="cursor-pointer font-medium">Kind hinzufügen</summary>
        <form className="space-y-2 mt-3" onSubmit={event => run(event, async () => {
          await family.addPerson(name.trim(), 'child'); setName('')
        })}>
          <label className="hub-label">Name des Kindes
            <input className="hub-input" required value={name} onChange={event => setName(event.target.value)} />
          </label>
          <button className="hub-button" disabled={busy}>Kinderprofil anlegen</button>
        </form>
      </details>
    </section>

    <details className="hub-card">
      <summary className="cursor-pointer font-medium">Mein eigenes Passwort ändern</summary>
      <div className="mt-3"><PasswordSettings /></div>
    </details>
    <p className="text-xs text-muted">Die Familienadministration gibt keine automatische Einsicht in private Gesundheitsakten.</p>
  </div>
}
