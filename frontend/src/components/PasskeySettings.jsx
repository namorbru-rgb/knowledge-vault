import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Passkeys live in Supabase Auth, never in the Family Hub document database.
// A credential is registered only after direct interaction and iOS confirmation.
export default function PasskeySettings() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState('')

  async function refresh() {
    try {
      const { data, error } = await supabase.auth.passkey.list()
      if (error) throw error
      setItems(Array.isArray(data) ? data : data?.passkeys || [])
    } catch {
      // Keep setup visible even when passkey support is not enabled yet.
    } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  async function enroll() {
    setBusy(true); setProblem(''); setMessage('')
    try {
      if (!window.PublicKeyCredential) throw new Error('not-supported')
      const { error } = await supabase.auth.registerPasskey()
      if (error) throw error
      setMessage('Face ID ist eingerichtet. Ab jetzt kannst du dich ohne Passwort anmelden.')
      await refresh()
    } catch (error) {
      setProblem(error?.code === 'passkey_disabled'
        ? 'Passkeys sind in den Supabase-Einstellungen noch nicht aktiviert. Ein Administrator muss die Funktion einmal freigeben.'
        : 'Face ID konnte nicht eingerichtet werden. Bitte in Safari auf dem iPhone erneut versuchen.')
    } finally { setBusy(false) }
  }

  return <section className="hub-card space-y-3">
    <h2 className="text-lg font-semibold">Face ID / Passkey</h2>
    <p className="text-sm text-muted">Einmal auf diesem iPhone einrichten. Danach kannst du dich ohne ein weiteres Passwort anmelden.</p>
    {!loading && items.length > 0 && <p className="text-sm text-green-700">{items.length} Passkey{items.length === 1 ? '' : 's'} eingerichtet.</p>}
    <button type="button" className="hub-button" disabled={busy} onClick={enroll}>
      {busy ? 'Face ID wird eingerichtet…' : 'Face ID auf diesem iPhone einrichten'}
    </button>
    {message && <p role="status" className="text-sm text-green-700">{message}</p>}
    {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
    <p className="text-xs text-muted">Deine bestehende Passwortanmeldung bleibt als Reserve erhalten. Passkeys werden durch iCloud-Schlüsselbund beziehungsweise den gewählten Passwortmanager geschützt.</p>
  </section>
}
