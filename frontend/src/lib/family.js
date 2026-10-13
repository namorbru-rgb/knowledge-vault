import { supabase as sb } from './supabase'
async function result(query) { const { data, error } = await query; if (error) throw new Error(error.message); return data }
async function uid() { const { data: { user }, error } = await sb.auth.getUser(); if (error || !user) throw new Error('Bitte erneut anmelden.'); return user.id }
export const family = {
  userId: uid,
  persons: () => result(sb.from('kv_persons').select('*').in('fh_kind', ['self','child']).order('name')),
  addPerson: async (name, kind) => result(sb.from('kv_persons').insert({ user_id: await uid(), name, fh_kind: kind }).select().single()),
  members: () => result(sb.from('fh_members').select('*')),
  families: () => result(sb.from('fh_families').select('*')),
  createFamily: (name, displayName) => result(sb.rpc('fh_create_family', { p_name: name, p_display_name: displayName })),
  addMember: (id, userId, name, role) => result(sb.rpc('fh_add_member', { p_family: id, p_user: userId, p_name: name, p_role: role })),
  resources: () => result(sb.from('fh_resources').select('*').order('occurred_at', { ascending: false })),
  create: async patch => result(sb.from('fh_resources').insert({ ...patch, owner_id: await uid() }).select().single()),
  update: (id, patch) => result(sb.from('fh_resources').update(patch).eq('id', id).select().single()),
  grants: () => result(sb.from('fh_grants').select('*')),
  share: (id, recipient, permission) => result(sb.from('fh_grants').upsert({ resource_id: id, recipient_id: recipient, permission })),
  unshare: (id, recipient) => result(sb.from('fh_grants').delete().eq('resource_id', id).eq('recipient_id', recipient)),
  doses: () => result(sb.from('fh_doses').select('*')),
  take: (id, day, slot) => result(sb.from('fh_doses').insert({ resource_id: id, day, slot })),
  untake: (id, day, slot) => result(sb.from('fh_doses').delete().eq('resource_id', id).eq('day', day).eq('slot', slot)),
  uploadDocument: async (file, patch) => {
    if (!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('PDF/JPEG/PNG/WebP bis 20 MB verwenden.')
    const owner = await uid(), id = crypto.randomUUID(), path = `${owner}/${id}`
    const row = await result(sb.from('fh_resources').insert({ ...patch, id, kind: 'document', owner_id: owner, storage_path: path, mime_type: file.type }).select().single())
    const { error } = await sb.storage.from('fh-vault').upload(path, file, { contentType: file.type, upsert: false })
    if (error) { await sb.from('fh_resources').delete().eq('id', id); throw new Error(error.message) }
    return row
  },
  openDocument: async row => {
    const data = await result(sb.storage.from('fh-vault').createSignedUrl(row.storage_path, 60))
    await result(sb.rpc('fh_record_open', { p_id: row.id }))
    return data.signedUrl
  },
  requestExtraction: async row => {
    const endpoint=import.meta.env.VITE_FAMILY_API_URL
    if (!endpoint || !endpoint.startsWith('https://')) throw new Error('Für KI-Vorschläge muss ein sicherer Family-API-Endpunkt konfiguriert sein.')
    const { data: { session } }=await sb.auth.getSession()
    if (!session) throw new Error('Bitte anmelden.')
    const response=await fetch(`${endpoint.replace(/\/$/,'')}/api/family/documents/${row.id}/extraction`, { method:'POST', headers:{ Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ consent:true }) })
    if (!response.ok) throw new Error('KI-Vorschlag konnte nicht erstellt werden. Bitte Serverkonfiguration prüfen.')
    return response.json()
  },
  remove: async row => {
    if (row.kind === 'document') { const { error } = await sb.storage.from('fh-vault').remove([row.storage_path]); if (error) throw new Error(error.message) }
    return result(sb.from('fh_resources').delete().eq('id', row.id))
  },
  refs: () => result(sb.from('fh_document_refs').select('*')),
  reference: row => result(sb.from('fh_document_refs').insert(row)),
  extractions: () => result(sb.from('fh_extractions').select('*').order('created_at', { ascending: false })),
  review: (id, accept) => result(sb.rpc('fh_review_extraction', { p_id: id, p_accept: accept })),
  audit: () => result(sb.from('fh_audit').select('*').order('created_at', { ascending: false }).limit(100)),
}
export const kinds = {
  symptom: 'Beschwerde', case: 'Gesundheitsfall', visit: 'Arztbesuch', hospital: 'Hospitalisation',
  examination: 'Untersuchung', prescription: 'Rezept', medication: 'Medikament / Vitamin / Supplement', nutrition: 'Ernährung', reminder: 'Erinnerung',
}
export const symptomCatalog = ['Kopfschmerzen','Rückenschmerzen','Bauchschmerzen','Müdigkeit','Übelkeit','Schwindel','Husten','Fieber','Andere Beschwerde']
export function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
export function localDateTime(date = new Date()) { return `${localDay(date)}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}` }
