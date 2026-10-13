import {useState} from 'react'
import {supabase} from '../lib/supabase'
export default function PasswordSettings({onDone}){
  const [password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  return <form className="hub-card space-y-3" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const {error}=await supabase.auth.updateUser({password});if(error)throw error;setPassword('');setMessage('Persönliches Passwort gespeichert.');onDone?.()}catch{setMessage('Passwort konnte nicht gespeichert werden.')}finally{setBusy(false)}}}>
    <h2 className="font-semibold">Persönliches Passwort setzen</h2><label className="hub-label">Neues Passwort (mindestens 12 Zeichen)<input className="hub-input" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy} className="hub-button">Passwort speichern</button>{message&&<p role="status">{message}</p>}
  </form>
}
