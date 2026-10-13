import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage({ initialError }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError || '')
  const [busy, setBusy] = useState(false)
  const [signup,setSignup]=useState(false)
  const [link,setLink]=useState('')
  async function login(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const { data,error } = signup ? await supabase.auth.signUp({email,password}) : await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (signup && !data.session) setError('Konto angelegt. Bitte die Bestätigung in deinem E-Mail-Postfach öffnen.')
    } catch { setError('Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen. Bei einem bisherigen gemeinsamen Zugang das Passwort neu setzen.') }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-app text-fg flex items-center justify-center p-5">
    <form onSubmit={login} className="hub-card w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-bold">Family Hub</h1>
      <p className="text-muted">Mit deinem persönlichen Konto anmelden.</p>
      <label className="hub-label">E-Mail<input className="hub-input" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="hub-label">Passwort<input className="hub-input" type="password" autoComplete={signup?'new-password':'current-password'} minLength={signup?12:undefined} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="text-red-500">{error}</p>}
      <button disabled={busy} className="hub-button w-full">{busy ? 'Bitte warten…' : signup?'Persönliches Konto erstellen':'Anmelden'}</button>
      <button type="button" className="text-sm text-blue-500" onClick={()=>setSignup(!signup)}>{signup?'Zur Anmeldung':'Persönliches Konto erstellen'}</button>
      <button type="button" disabled={busy || !email} className="block text-sm text-blue-500" onClick={async()=>{setBusy(true);try{const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+import.meta.env.BASE_URL});if(error)throw error;setError('Wenn das Konto existiert, wurde eine Nachricht gesendet. Falls der Link nicht öffnet, kopiere ihn unverändert in das Feld unten.')}catch{setError('Zurücksetzen konnte nicht gestartet werden.')}finally{setBusy(false)}}}>Passwort vergessen / neu setzen</button>
      <details><summary className="text-sm text-blue-500 cursor-pointer">Link aus Bestätigungs-E-Mail verwenden</summary><label className="hub-label mt-2">E-Mail-Link<input className="hub-input" type="url" value={link} onChange={e=>setLink(e.target.value)} autoComplete="off"/></label><button type="button" className="hub-button mt-2" disabled={busy||!link} onClick={async()=>{setBusy(true);try{const url=new URL(link);if(url.origin!=='https://nixakeaiibzhesdwtelw.supabase.co'||url.pathname!=='/auth/v1/verify')throw new Error('Ungültiger Link');const type=url.searchParams.get('type'),token=url.searchParams.get('token');if(!['recovery','signup','invite'].includes(type)||!token)throw new Error('Ungültiger Link');const {error}=await supabase.auth.verifyOtp({token_hash:token,type});if(error)throw error;setLink('')}catch{setError('Dieser Link ist ungültig oder abgelaufen. Bitte eine neue Nachricht anfordern.')}finally{setBusy(false)}}}>E-Mail-Link bestätigen</button></details>
      <p className="text-xs text-muted">Erwachsene verwenden separate Konten. Gesundheits- und Kinderprofile legst du nach der Anmeldung selbst an.</p>
    </form>
  </main>
}
