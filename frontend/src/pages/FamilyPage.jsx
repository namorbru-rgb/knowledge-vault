import { useEffect, useState } from 'react'
import { family } from '../lib/family'
import PasswordSettings from '../components/PasswordSettings'
import KnowledgeSharing from '../components/KnowledgeSharing'
export default function FamilyPage() {
  const [persons, setPersons] = useState([]), [members, setMembers] = useState([]), [families, setFamilies] = useState([]), [audit,setAudit] = useState([])
  const [userId,setUserId] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  const [name,setName] = useState(''), [kind,setKind] = useState('self'), [familyName,setFamilyName] = useState(''), [displayName,setDisplayName] = useState('')
  const [fid,setFid] = useState(''), [account,setAccount] = useState(''), [memberName,setMemberName] = useState(''), [role,setRole] = useState('member')
  async function load() { try { const [p,m,f,a,u] = await Promise.all([family.persons(),family.members(),family.families(),family.audit(),family.userId()]); setPersons(p); setMembers(m); setFamilies(f); setAudit(a); setUserId(u) } catch(e) { setError(e.message) } }
  useEffect(() => { load() }, [])
  async function run(e,action) { e.preventDefault(); setBusy(true); setError(''); try { await action(); await load() } catch(e) { setError(e.message) } finally { setBusy(false) } }
  return <div className="hub-page space-y-5">
    <h1 className="text-2xl font-bold">Familie & persönliche Profile</h1>
    <KnowledgeSharing />
    <details className="hub-card"><summary className="font-semibold cursor-pointer">Passwort ändern</summary><div className="mt-3"><PasswordSettings /></div></details>
    <p className="text-muted">Jeder Erwachsene meldet sich selbst an. Knowledge-Personen sind Zuordnungen und keine Benutzerkonten. Kinderprofile verwaltet ein Sorgeberechtigter.</p>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    <div className="hub-card"><p>Deine Konto-ID (für eine Einladung):</p><code className="text-sm break-all">{userId}</code></div>
    <form className="hub-card space-y-3" onSubmit={e => run(e,async () => { await family.addPerson(name.trim(),kind); setName('') })}>
      <h2 className="font-semibold">Persönliches Profil oder Kind anlegen</h2>
      <label className="hub-label">Name<input className="hub-input" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="hub-label">Profil<select className="hub-input" value={kind} onChange={e => setKind(e.target.value)}><option value="self">Mein eigenes Profil</option><option value="child">Kind unter meiner Verantwortung</option></select></label>
      <button className="hub-button" disabled={busy}>Profil anlegen</button>
      {persons.map(p => <p key={p.id}>{p.name} · {p.fh_kind === 'self' ? 'Eigenes Profil' : 'Kind'}</p>)}
    </form>
    {families.length===0&&<form className="hub-card space-y-3" onSubmit={e => run(e,() => family.createFamily(familyName.trim(),displayName.trim()))}>
      <h2 className="font-semibold">Familie erstellen</h2>
      <label className="hub-label">Familienname<input required className="hub-input" value={familyName} onChange={e => setFamilyName(e.target.value)} /></label>
      <label className="hub-label">Dein Anzeigename<input required className="hub-input" value={displayName} onChange={e => setDisplayName(e.target.value)} /></label>
      <button disabled={busy} className="hub-button">Familie erstellen</button>
    </form>}
    <form className="hub-card space-y-3" onSubmit={e => run(e,() => family.addMember(fid,account,memberName.trim(),role))}>
      <h2 className="font-semibold">Bestehendes Konto zur Familie hinzufügen</h2>
      <label className="hub-label">Familie<select className="hub-input" required value={fid} onChange={e => setFid(e.target.value)}><option value="">Auswählen</option>{families.filter(f => members.some(m => m.family_id===f.id && m.user_id===userId && m.role==='admin')).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label className="hub-label">Konto-ID<input className="hub-input" required pattern="[0-9a-fA-F-]{36}" value={account} onChange={e => setAccount(e.target.value)} /></label>
      <label className="hub-label">Anzeigename<input className="hub-input" required value={memberName} onChange={e => setMemberName(e.target.value)} /></label>
      <label className="hub-label">Rolle<select className="hub-input" value={role} onChange={e => setRole(e.target.value)}><option value="member">Familienmitglied</option><option value="admin">Familienadministration</option></select></label>
      <button className="hub-button" disabled={busy || !fid}>Hinzufügen</button>
      <p className="text-xs text-muted">Die Rolle erlaubt Familienverwaltung. Private Einträge werden dadurch nicht freigegeben.</p>
      {members.map(m => <p key={`${m.family_id}-${m.user_id}`}>{m.display_name} · {m.role === 'admin' ? 'Administration' : 'Mitglied'}</p>)}
    </form>
    <section className="hub-card"><h2 className="font-semibold mb-3">Aktivitätsprotokoll meiner Daten</h2>{audit.map(a => <p className="text-xs text-muted py-1" key={a.id}>{new Date(a.created_at).toLocaleString()} · {a.action} · {a.actor_id}</p>)}</section>
  </div>
}
