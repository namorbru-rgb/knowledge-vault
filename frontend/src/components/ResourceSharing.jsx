import { useState } from 'react'
import { family } from '../lib/family'
export default function ResourceSharing({ row, userId, members, grants, reload, onError }) {
  const [open, setOpen] = useState(false), [recipient, setRecipient] = useState(''), [permission, setPermission] = useState('read')
  if (row.owner_id !== userId) return <span className="text-xs text-muted">Mit dir geteilt</span>
  async function run(action) { try { await action(); await reload() } catch (e) { onError(e.message) } }
  return <div>
    <button className="text-sm text-blue-500 py-2" onClick={() => setOpen(!open)}>Freigaben ({grants.filter(g => g.resource_id === row.id).length})</button>
    {open && <div className="border border-line rounded-lg p-3 space-y-3">
      <p className="text-xs text-muted">Nur dieser Eintrag. Verknüpfte Dokumente benötigen eigene Freigaben.</p>
      <label className="hub-label">Person<select className="hub-input" value={recipient} onChange={e => setRecipient(e.target.value)}><option value="">Auswählen</option>{[...new Map(members.filter(m => m.user_id !== userId).map(m => [m.user_id,m])).values()].map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}</select></label>
      <label className="hub-label">Berechtigung<select className="hub-input" value={permission} onChange={e => setPermission(e.target.value)}><option value="read">Lesen</option><option value="edit">Lesen und bearbeiten</option></select></label>
      <button className="hub-button" disabled={!recipient} onClick={() => run(() => family.share(row.id,recipient,permission))}>Ausdrücklich freigeben</button>
      {grants.filter(g => g.resource_id === row.id).map(g => <div key={g.recipient_id} className="text-sm flex gap-2 justify-between"><span>{members.find(m => m.user_id === g.recipient_id)?.display_name || g.recipient_id}: {g.permission === 'edit' ? 'Bearbeiten' : 'Lesen'}</span><button className="text-red-500" onClick={() => run(() => family.unshare(row.id,g.recipient_id))}>Widerrufen</button></div>)}
    </div>}
  </div>
}
