import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage({ initialError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError || '')
  const [busy, setBusy] = useState(false)
  async function login(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch { setError('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.') }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-app text-fg flex items-center justify-center p-5">
    <form onSubmit={login} className="hub-card w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Family Hub</h1>
      <p className="text-muted">Mit deinem persönlichen Konto anmelden.</p>
      <label className="hub-label">E-Mail<input className="hub-input" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="hub-label">Passwort<input className="hub-input" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="text-red-500">{error}</p>}
      <button disabled={busy} className="hub-button w-full">{busy ? 'Anmelden…' : 'Anmelden'}</button>
      <p className="text-xs text-muted">Erwachsene verwenden separate Konten. Ein Konto wird nach Einladung eingerichtet.</p>
    </form>
  </main>
}
