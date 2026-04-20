// Direkte Supabase-Aufrufe mit dem authentifizierten Client des Nutzers.
// Wir verwenden bewusst NICHT den service_role-Schlüssel im Browser – RLS
// stellt sicher, dass jeder Nutzer nur seine eigenen Daten sieht.
import { supabase as sb } from './supabase'

let _userId = null

export function setAuthToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    _userId = payload.sub
  } catch (e) {
    _userId = null
  }
}

function uid() { return _userId }

export const api = {
  getStats: async () => {
    const u = uid()
    const [v, l, p, n] = await Promise.all([
      sb.from('kv_videos').select('id', { count: 'exact', head: true }).eq('user_id', u),
      sb.from('kv_links').select('id', { count: 'exact', head: true }).eq('user_id', u),
      sb.from('kv_photos').select('id', { count: 'exact', head: true }).eq('user_id', u),
      sb.from('kv_notes').select('id', { count: 'exact', head: true }).eq('user_id', u),
    ])
    return { videos: v.count||0, links: l.count||0, photos: p.count||0, notes: n.count||0 }
  },

  getVideos: async () => {
    const { data, error } = await sb.from('kv_videos').select('*').eq('user_id', uid()).order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data || []
  },
  getVideo: async (id) => {
    const { data } = await sb.from('kv_videos').select('*, segments:kv_video_segments(*)').eq('id', id).single()
    return data
  },
  addVideo: async (url, title) => {
    const { data, error } = await sb.from('kv_videos').insert({ url, title: title||url, user_id: uid(), transcript_status: 'pending', created_at: new Date().toISOString() }).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  deleteVideo: async (id) => {
    const { error } = await sb.from('kv_videos').delete().eq('id', id).eq('user_id', uid())
    if (error) throw new Error(error.message)
    return {}
  },

  getLinks: async () => {
    const { data, error } = await sb.from('kv_links').select('*').eq('user_id', uid()).order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data || []
  },
  addLink: async (url, title) => {
    const { data, error } = await sb.from('kv_links').insert({ url, title: title||url, user_id: uid(), created_at: new Date().toISOString() }).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  deleteLink: async (id) => {
    const { error } = await sb.from('kv_links').delete().eq('id', id).eq('user_id', uid())
    if (error) throw new Error(error.message)
    return {}
  },

  getPhotos: async () => {
    const { data, error } = await sb.from('kv_photos').select('*').eq('user_id', uid()).order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data || []).map(p => ({
      ...p,
      public_url: p.storage_path ? sb.storage.from('kv-media').getPublicUrl(p.storage_path).data?.publicUrl : null,
    }))
  },
  uploadPhoto: async (formData) => {
    const file = formData.get('photo')
    if (!file) throw new Error('Keine Datei')
    const safeName = file.name.replace(/[^\w.\-]+/g, '_')
    const path = `${uid()}/${Date.now()}_${safeName}`
    const { error: upErr } = await sb.storage.from('kv-media').upload(path, file, { contentType: file.type, upsert: false })
    if (upErr) throw new Error(upErr.message)
    const { data, error } = await sb.from('kv_photos').insert({
      storage_path: path,
      filename: file.name,
      user_id: uid(),
      created_at: new Date().toISOString(),
    }).select().single()
    if (error) throw new Error(error.message)
    return { ...data, public_url: sb.storage.from('kv-media').getPublicUrl(path).data?.publicUrl }
  },
  deletePhoto: async (id) => {
    const { data: p } = await sb.from('kv_photos').select('storage_path').eq('id', id).eq('user_id', uid()).single()
    if (p?.storage_path) await sb.storage.from('kv-media').remove([p.storage_path])
    const { error } = await sb.from('kv_photos').delete().eq('id', id).eq('user_id', uid())
    if (error) throw new Error(error.message)
    return {}
  },

  getNotes: async () => {
    const { data, error } = await sb.from('kv_notes').select('*').eq('user_id', uid()).order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data || []
  },
  addNote: async (content, refs) => {
    const { data, error } = await sb.from('kv_notes').insert({ content, ...refs, user_id: uid(), created_at: new Date().toISOString() }).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  updateNote: async (id, content) => {
    const { data, error } = await sb.from('kv_notes').update({ content, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', uid()).select().single()
    if (error) throw new Error(error.message)
    return data
  },
  deleteNote: async (id) => {
    const { error } = await sb.from('kv_notes').delete().eq('id', id).eq('user_id', uid())
    if (error) throw new Error(error.message)
    return {}
  },

  search: async (query, types) => {
    const u = uid()
    const results = []
    if (!types || types.includes('notes')) {
      const { data } = await sb.from('kv_notes')
        .select('id,content,created_at')
        .eq('user_id', u).ilike('content', `%${query}%`).limit(10)
      ;(data||[]).forEach(r => results.push({ type: 'note', id: r.id, title: r.content.slice(0, 60), content: r.content, created_at: r.created_at }))
    }
    if (!types || types.includes('links')) {
      const { data } = await sb.from('kv_links')
        .select('id,title,url,summary,created_at')
        .eq('user_id', u)
        .or(`title.ilike.%${query}%,url.ilike.%${query}%,summary.ilike.%${query}%`)
        .limit(10)
      ;(data||[]).forEach(r => results.push({ type: 'link', id: r.id, title: r.title || r.url, url: r.url, content: r.summary, created_at: r.created_at }))
    }
    if (!types || types.includes('videos')) {
      const { data: vTitle } = await sb.from('kv_videos')
        .select('id,title,url,description,thumbnail_url,created_at')
        .eq('user_id', u).ilike('title', `%${query}%`).limit(10)
      ;(vTitle||[]).forEach(r => results.push({ type: 'video', id: r.id, title: r.title || r.url, url: r.url, content: r.description, thumbnail_url: r.thumbnail_url, created_at: r.created_at }))

      const { data: segs } = await sb.from('kv_video_segments')
        .select('id,video_id,start_time,end_time,text,kv_videos!inner(title,url,thumbnail_url,created_at)')
        .eq('user_id', u).ilike('text', `%${query}%`).limit(30)
      ;(segs||[]).forEach(r => results.push({
        type: 'video_segment',
        id: `seg-${r.id}`,
        video_id: r.video_id,
        title: r.kv_videos?.title || r.kv_videos?.url,
        url: r.kv_videos?.url,
        thumbnail_url: r.kv_videos?.thumbnail_url,
        content: r.text,
        start_time: r.start_time,
        end_time: r.end_time,
        created_at: r.kv_videos?.created_at,
      }))
    }
    return { results, mode: 'text' }
  },
}
