import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

async function adminRequest(body) {
  const { data, error } = await supabase.functions.invoke('family-admin', { body })
  if (!error) return data
  let message = 'Die Benutzerverwaltung ist nicht erreichbar.'
  try {
    const response = error.context
    const details = typeof response?.json === 'function' ? await response.json() : null
    if (details?.error) message = details.error
  } catch { /* Keep a safe generic error message. */ }
  const failure = new Error(message)
  failure.status = error.context?.status
  throw failure
}

export default function FamilyAdminPanel() {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [members, setMembers] = useState([])
  const [families, setFamilies] = useState([])
  const [familyId, setFamilyId] = useState('')
  const [target, setTarget] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [authMode, setAuthMode] = useState('passkey')
  const [adminId, setAdminId] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createConfirm, setCreateConfirm] = useState('')
  const [createAdminPassword, setCreateAdminPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState('')

  async function refresh() {
    try {
      const data = await adminRequest({ action: 'list' })
      if (!data?.allowed) return
      const { data: { user } } = await supabase.auth.getUser()
      setAdminId(user?.id || '')
      setAllowed(true)
      setFamilies(data.families || [])
      setFamilyId(previous => (data.families || []).includes(previous) ? previous : data.families?.[0] || '')
      setMembers(data.members || [])
    } catch (err) {
      // An ordinary family member must never see privileged controls.
      if (err.status !== 403) setProblem('Die Familienverwaltung konnte nicht geladen werden.')
    } finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [])

  async function verifyWithPasskey() {
    // Face ID is verified by Supabase Auth. The resulting freshly issued
    // signed token is checked again by the family-admin Edge Function.
    const { data, error } = await supabase.auth.signInWithPasskey()
    if (error) {
      throw new Error(error.code === 'passkey_disabled'
        ? 'Face ID ist noch nicht in Supabase aktiviert. Bis dahin ist die Passwort-Reserve verfügbar.'
        : 'Face ID konnte nicht bestätigt werden. Bitte zuerst unter Familie einen Passkey einrichten.')
    }
    if (!data.user || data.user.id !== adminId) {
      await supabase.auth.signOut()
      throw new Error('Es wurde ein anderer Account gewählt. Bitte erneut mit deinem eigenen Konto anmelden.')
    }
  }

  async function savePassword(event) {
    event.preventDefault()
    setProblem(''); setMessage('')
    if (!target || !familyId) return setProblem('Bitte ein Familienmitglied auswählen.')
    if (newPassword !== confirmPassword) return setProblem('Die neuen Passwörter stimmen nicht überein.')
    if (newPassword.length < 12) return setProblem('Mindestens 12 Zeichen für das neue Passwort verwenden.')
    setBusy(true)
    try {
      if (authMode === 'passkey') await verifyWithPasskey()
      const response = await adminRequest({
        action: 'set-password', familyId, targetUserId: target,
        password: newPassword,
        ...(authMode === 'password' ? { adminPassword } : {}),
      })
      setMessage(response.auditWarning
        ? 'Passwort geändert. Achtung: Die Protokollierung muss geprüft werden.'
        : 'Passwort geändert. Die Person kann sich sofort mit diesem Passwort anmelden.')
      setTarget(''); setNewPassword(''); setConfirmPassword(''); setAdminPassword('')
    } catch (err) { setProblem(err.message) }
    finally { setBusy(false) }
  }

  async function createAccount(event) {
    event.preventDefault()
    setProblem(''); setMessage('')
    if (createPassword !== createConfirm) return setProblem('Die Passwörter stimmen nicht überein.')
    if (createPassword.length < 12) return setProblem('Mindestens 12 Zeichen für das neue Passwort verwenden.')
    setBusy(true)
    try {
      if (authMode === 'passkey') await verifyWithPasskey()
      const response = await adminRequest({
        action: 'create-account', familyId, name: newName.trim(),
        email: newEmail.trim(), password: createPassword,
        ...(authMode === 'password' ? { adminPassword: createAdminPassword } : {}),
      })
      setMessage(response.auditWarning
        ? 'Konto erstellt. Die Protokollierung muss geprüft werden.'
        : 'Konto erstellt. Die Person kann sich mit ihrer E-Mail und dem vergebenen Passwort anmelden.')
      setNewName(''); setNewEmail(''); setCreatePassword(''); setCreateConfirm(''); setCreateAdminPassword('')
      await refresh()
    } catch (err) { setProblem(err.message) }
    finally { setBusy(false) }
  }

  if (loading || !allowed) return null
  const visible = members.filter(m => m.family_id === familyId)
  return <section className="hub-card space-y-4" aria-labelledby="superadmin-heading">
    <div>
      <h2 id="superadmin-heading" className="text-lg font-semibold">Benutzer & Passwörter verwalten</h2>
      <p className="text-sm text-muted mt-1">Du verwaltest die Konten deiner Familie. Es werden keine Passwort-E-Mails benötigt.</p>
    </div>
    {families.length > 1 && <label className="hub-label">Familie
      <select className="hub-input" value={familyId} onChange={e => setFamilyId(e.target.value)}>
        {families.map(f => <option key={f} value={f}>{members.find(m => m.family_id === f)?.display_name || 'Familie'} ({f.slice(0,8)})</option>)}
      </select>
    </label>}
    <div className="space-y-2">
      {visible.map(m => <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 border border-line rounded-xl p-3">
        <div className="min-w-0">
          <div className="font-medium">{m.display_name} {m.role === 'admin' && <span className="text-xs text-muted">(Admin)</span>}</div>
          <div className="text-xs text-muted break-all">{m.email || 'E-Mail nicht verfügbar'}</div>
        </div>
        <button type="button" className="hub-button !px-3 !py-2 text-sm" onClick={() => { setTarget(m.user_id); setProblem(''); setMessage('') }}>Passwort setzen</button>
      </div>)}
    </div>
    <label className="hub-label">Administrative Bestätigung
      <select className="hub-input" value={authMode} onChange={event => setAuthMode(event.target.value)}>
        <option value="passkey">Face ID / Passkey (empfohlen)</option>
        <option value="password">Eigenes gespeichertes Passwort (Reserve)</option>
      </select>
    </label>
    <p className="text-xs text-muted">Face ID prüft deine Identität auf diesem Gerät; dein eigenes Passwort musst du nicht mehr eintippen.</p>
    {target && <form className="space-y-3 border border-line rounded-xl p-3" onSubmit={savePassword}>
      <h3 className="font-semibold">Neues definitives Passwort für {visible.find(m => m.user_id === target)?.display_name}</h3>
      <p className="text-xs text-muted">Dieses Passwort gehört dem Familienmitglied, nicht deinem eigenen Zugang. Bitte nicht unter deinem eigenen Login im Passwortmanager speichern.</p>
      <label className="hub-label">Neues Passwort (mindestens 12 Zeichen)
        <input className="hub-input" type="password" autoComplete="off" required minLength={12} maxLength={128} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
      </label>
      <label className="hub-label">Neues Passwort wiederholen
        <input className="hub-input" type="password" autoComplete="off" required minLength={12} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
      </label>
      {authMode === 'password' && <label className="hub-label">Dein eigenes gespeichertes Passwort
        <input className="hub-input" type="password" autoComplete="current-password" required value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
      </label>}
      <div className="flex flex-wrap gap-2">
        <button className="hub-button" disabled={busy}>{busy ? 'Bitte warten…' : 'Neues Passwort speichern'}</button>
        <button type="button" className="px-3 py-2 text-muted" onClick={() => { setTarget(''); setNewPassword(''); setConfirmPassword(''); setAdminPassword('') }}>Abbrechen</button>
      </div>
    </form>}
    <details className="border border-line rounded-xl p-3">
      <summary className="font-medium cursor-pointer">Weiteres Familienkonto anlegen</summary>
      <form className="space-y-3 mt-3" onSubmit={createAccount}>
        <p className="text-xs text-muted">Das Konto wird direkt angelegt, ohne Einladungs- oder Bestätigungsmail.</p>
        <label className="hub-label">Name
          <input className="hub-input" required maxLength={120} value={newName} onChange={e => setNewName(e.target.value)} />
        </label>
        <label className="hub-label">E-Mail
          <input className="hub-input" required type="email" autoComplete="off" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
        </label>
        <label className="hub-label">Definitives Passwort
          <input className="hub-input" required type="password" autoComplete="off" minLength={12} value={createPassword} onChange={e => setCreatePassword(e.target.value)} />
        </label>
        <label className="hub-label">Passwort wiederholen
          <input className="hub-input" required type="password" autoComplete="off" minLength={12} value={createConfirm} onChange={e => setCreateConfirm(e.target.value)} />
        </label>
        {authMode === 'password' && <label className="hub-label">Dein eigenes gespeichertes Passwort
          <input className="hub-input" required type="password" autoComplete="current-password" value={createAdminPassword} onChange={e => setCreateAdminPassword(e.target.value)} />
        </label>}
        <button className="hub-button" disabled={busy}>Konto erstellen</button>
      </form>
    </details>
    {problem && <p className="text-sm text-red-600" role="alert">{problem}</p>}
    {message && <p className="text-sm text-green-700" role="status">{message}</p>}
    <p className="text-xs text-muted">Passwörter sind nicht auslesbar. Administrative Änderungen werden protokolliert. Als Superadmin kannst du andere Konten durch ein Passwort-Reset übernehmen.</p>
  </section>
}
