import {useState} from 'react'
import {enablePush,disablePush} from '../lib/push'
export default function PushSettings() {
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  async function run(action,success){setBusy(true);try{await action();setMessage(success)}catch(e){setMessage(e.message)}finally{setBusy(false)}}
  return <section className="hub-card space-y-3"><h2 className="font-semibold">Hintergrund-Erinnerungen</h2>
    <p className="text-sm text-muted">Nach deiner Zustimmung erhält dieses Gerät Erinnerungen zu Einnahmen und Terminen, auch wenn die App geschlossen ist. Auf dem Sperrbildschirm erscheinen keine Gesundheitsdetails.</p>
    <div className="flex flex-wrap gap-3"><button disabled={busy} className="hub-button" onClick={()=>run(enablePush,'Benachrichtigungen für dieses Gerät aktiviert.')}>Benachrichtigungen aktivieren</button><button disabled={busy} onClick={()=>run(disablePush,'Benachrichtigungen für dieses Gerät deaktiviert.')}>Deaktivieren</button></div>
    {message&&<p role="status" className="text-sm">{message}</p>}
  </section>
}
