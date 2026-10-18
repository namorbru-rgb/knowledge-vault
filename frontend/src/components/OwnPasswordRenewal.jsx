import { useState } from 'react'
import { supabase } from '../lib/supabase'

// The session already proves the account owner. Supabase Auth Admin performs
// the update only if an explicit pending renewal exists for that same user.
export default function OwnPasswordRenewal({ onDone }) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault()
    if (password.length < 12) return setError('Bitte mindestens 12 Zeichen verwenden.')
    setSaving(true)
    setError('')
    try {
      const { data, error: callError } = await supabase.functions.invoke('family-admin', {
        body: { action:'set-own-password', password, confirm:true },
      })
      if (callError) {
        let message = 'Passwort konnte nicht gespeichert werden.'
        try {
          const detail = await callError.context?.json?.()
          if (detail?.error) message = detail.error
        } catch { /* Avoid leaking credentials or internals */ }
        throw new Error(message)
      }
      if (!data?.success) throw new Error('Bitte nochmals versuchen.')
      setPassword('')
      onDone?.()
    } catch (failure) {
      setError(failure.message || 'Passwort konnte nicht gespeichert werden.')
    } finally { setSaving(false) }
  }

  return <main className="min-h-screen bg-app text-fg flex items-center justify-center p-5">
    <form className="hub-card w-full max-w-sm space-y-4" onSubmit={save}>
      <h1 className="text-2xl font-bold">Neues Passwort festlegen</h1>
      <p className="text-muted">
        Für dein Family-Hub-Konto ist eine Passworterneuerung vorgemerkt.
        Du brauchst weder dein altes Passwort noch eine E-Mail.
      </p>
      <label className="hub-label">Neues Passwort (mindestens 12 Zeichen)
        <input
          className="hub-input"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />
        Passwort anzeigen
      </label>
      <p className="text-xs text-muted">
        Du kannst ein vom iPhone vorgeschlagenes starkes Passwort verwenden und im Passwortmanager speichern.
      </p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className="hub-button w-full" disabled={saving}>
        {saving ? 'Speichern…' : 'Neues Passwort speichern'}
      </button>
      <p className="text-xs text-muted">
        Dein bisheriges Passwort bleibt bis zum erfolgreichen Speichern gültig.
      </p>
    </form>
  </main>
}
