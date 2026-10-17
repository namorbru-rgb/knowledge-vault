import { useState } from 'react'

// Separate login/consent page used by the OAuth broker for ChatGPT and other
// explicitly registered MCP clients. The password goes only to our Supabase
// Edge Function as an HTTPS form POST. No credentials are stored in the app.
const BROKER='https://nixakeaiibzhesdwtelw.supabase.co/functions/v1/knowledge-oauth/authorize'
const RESOURCE='https://nixakeaiibzhesdwtelw.supabase.co/functions/v1/knowledge-mcp'
const FIELDS=['response_type','client_id','redirect_uri','state','code_challenge','code_challenge_method','scope','resource']

export default function KnowledgeOAuthAuthorize() {
  const [approved,setApproved]=useState(false)
  const fragment=window.location.hash
  const params=new URLSearchParams(fragment.slice(fragment.indexOf('?')+1))
  const data=Object.fromEntries(FIELDS.map(key=>[key,params.get(key)||'']))
  const allowed=(!data.resource||data.resource===RESOURCE)&&data.response_type==='code'&&
    data.code_challenge_method==='S256'&&data.client_id.length>0&&
    data.redirect_uri.startsWith('https://')
  const client=params.get('client_name')||'KI-Assistent'
  let callbackHost=''
  try { callbackHost=new URL(data.redirect_uri).hostname } catch {}
  const error=params.get('error')||''

  return <main className="min-h-screen bg-app text-fg flex items-center justify-center p-5">
    <section className="hub-card w-full max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Knowledge für KI freigeben</h1>
      <p className="text-muted">Verbinde dein persönliches Family-Hub-Konto mit <strong>{client}</strong>.</p>
      {callbackHost&&<p className="text-xs text-muted">Weiterleitung nach Anmeldung an: <strong>{callbackHost}</strong></p>}
      <div className="rounded-lg border border-line p-4 space-y-2 text-sm">
        <p><strong>Was der Assistent lesen darf</strong></p>
        <p>Deine Knowledge-Einträge, gespeicherte Videos und verfügbare Transkripte,
          Webseiteninhalte, Fotos mit OCR sowie Notizen. Auch Bibliotheken, die andere
          Personen ausdrücklich mit dir geteilt haben.</p>
        <p><strong>Nicht freigegeben:</strong> Gesundheitsdaten, Medikamente,
          private Dokumente und Datenbanken von KAMA.</p>
        <p>Der Assistent darf über diese Verbindung nichts erstellen, verändern oder löschen.
          Du kannst die Verbindung später in ChatGPT trennen.</p>
      </div>
      {!allowed?<p role="alert" className="text-red-600">Ungültige oder unvollständige Anmeldeanfrage. Starte die Verbindung erneut in ChatGPT.</p>:
        <form method="post" action={BROKER} className="space-y-4">
          {FIELDS.map(key=><input key={key} type="hidden" name={key} value={key==='resource'?RESOURCE:data[key]} />)}
          <label className="hub-label">Deine persönliche E-Mail
            <input className="hub-input" type="email" name="email" autoComplete="username" required />
          </label>
          <label className="hub-label">Dein Passwort
            <input className="hub-input" type="password" name="password" autoComplete="current-password" required />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="consent" value="yes" checked={approved}
              onChange={e=>setApproved(e.target.checked)} required className="mt-1" />
            <span>Ich erlaube <strong>{client}</strong>, meine zugänglichen Knowledge-Inhalte
              für Antworten, Suche und Auswertungen zu lesen.</span>
          </label>
          {error&&<p role="alert" className="text-red-600">{error}</p>}
          <button className="hub-button w-full" type="submit" disabled={!approved}>
            Knowledge mit KI verbinden
          </button>
        </form>}
      <a className="block text-blue-600 text-sm" href="/knowledge-vault/">Abbrechen und zurück zu Family Hub</a>
    </section>
  </main>
}
