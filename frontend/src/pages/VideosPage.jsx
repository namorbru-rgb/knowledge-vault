import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { colorClass } from './SettingsPage'
import { getActivePersonId } from '../lib/person'
import PersonFilter, { PersonBadge } from '../components/PersonFilter'

function fallbackPreview(url) {
  return url ? `https://api.microlink.io/?url=${encodeURIComponent(url)}&embed=image.url` : ''
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// "241K views · 4.8K reactions" und Co. — yt-dlp setzt sowas bei
// Facebook-Videos als Title. Erkennen wir, damit displayTitle() auf
// die Beschreibung (= eigentlicher Caption-Text) ausweichen kann.
function looksLikeStats(t) {
  if (!t) return false
  return /^\d+([\.,]\d+)?\s*[KMB]?\s*(views?|aufrufe)\b/i.test(t) ||
         /\breactions?\b|\breaktionen\b/i.test(t)
}

// Liefert einen lesbaren Titel: bevorzugt einen echten vom Worker,
// sonst die erste Zeile der Beschreibung, sonst "domain — pfad-slug".
function displayTitle(video) {
  const t = (video.title || '').trim()
  const desc = (video.description || '').trim()
  if (t && t !== video.url && !looksLikeStats(t)) return t

  if (desc) {
    const firstLine = desc.split(/\r?\n/).map(l => l.trim()).find(Boolean)
    if (firstLine) return firstLine.slice(0, 120)
  }

  const d = getDomain(video.url)
  if (!d) return video.url
  try {
    const p = new URL(video.url).pathname.replace(/\/+$/, '')
    if (!p || p === '/') return d
    const last = p.split('/').filter(Boolean).pop() || ''
    const slug = decodeURIComponent(last).replace(/[-_]/g, ' ').slice(0, 60)
    return slug ? `${d} — ${slug}` : d
  } catch { return d }
}

export default function VideosPage() {
  const [videos, setVideos] = useState([])
  const [persons, setPersons] = useState([])
  const [categories, setCategories] = useState([])
  const [filterPersonId, setFilterPersonId] = useState(null)
  const [brokenPreviews, setBrokenPreviews] = useState(() => new Set())
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [vids, pers, cats] = await Promise.all([
        api.getVideos().catch(err => { setError(err.message); return [] }),
        api.getPersons().catch(() => []),
        api.getCategories().catch(() => []),
      ])
      setVideos(vids); setPersons(pers); setCategories(cats)
    } finally { setLoading(false) }
  }

  const personsById = useMemo(() => Object.fromEntries(persons.map(p => [p.id, p])), [persons])
  const categoriesById = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])
  const filteredVideos = useMemo(() => {
    if (!filterPersonId) return videos
    if (filterPersonId === 'none') return videos.filter(v => !v.person_id)
    return videos.filter(v => v.person_id === filterPersonId)
  }, [videos, filterPersonId])

  async function addVideo(e) {
    e.preventDefault()
    if (!url.trim()) return
    setAdding(true)
    try {
      const video = await api.addVideo(url.trim(), null, getActivePersonId())
      setVideos(prev => [video, ...prev])
      setUrl('')
    } catch (err) { setError(err.message) }
    finally { setAdding(false) }
  }

  async function deleteVideo(id) {
    if (!confirm('Dieses Video löschen?')) return
    await api.deleteVideo(id)
    setVideos(prev => prev.filter(v => v.id !== id))
  }

  const statusColors = { done: 'text-green-600 dark:text-green-400', error: 'text-red-600 dark:text-red-400', processing: 'text-yellow-600 dark:text-yellow-400', pending: 'text-muted' }
  const statusLabels = { done: '✅ Transkribiert', error: '❌ Fehler', processing: '⏳ Wird verarbeitet', pending: '🕐 Ausstehend' }

  function statusLabel(v) {
    const base = statusLabels[v.transcript_status] || v.transcript_status
    if (v.transcript_status === 'pending' && v.transcript_retry_count > 0) {
      return `🔁 Erneuter Versuch ${v.transcript_retry_count + 1}/3`
    }
    return base
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-fg mb-4 sm:mb-6">Videos</h2>

      <form onSubmit={addVideo} className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6 sm:mb-8">
        <input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off"
          placeholder="YouTube- oder Video-URL…" value={url} onChange={e => setUrl(e.target.value)}
          className="flex-1 bg-surface border border-line rounded-lg px-4 py-3 text-fg placeholder:text-muted focus:outline-none focus:border-blue-500" />
        <button type="submit" disabled={adding}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors whitespace-nowrap">
          {adding ? 'Wird hinzugefügt…' : 'Video hinzufügen'}
        </button>
      </form>

      {error && <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>}
      <PersonFilter persons={persons} value={filterPersonId} onChange={setFilterPersonId} />
      {loading ? <p className="text-muted">Lädt...</p> : (
        <div className="space-y-3">
          {filteredVideos.length === 0 && <p className="text-muted">Keine Videos in dieser Auswahl.</p>}
          {filteredVideos.map(video => {
            const previewUrl = video.thumbnail_url
              || (!brokenPreviews.has(video.id) ? fallbackPreview(video.url) : '')
            return (
            <div key={video.id} className="bg-surface border border-line rounded-xl p-4 flex gap-4">
              <div className="w-24 h-16 rounded-lg overflow-hidden bg-elevated flex-shrink-0 flex items-center justify-center text-2xl">
                {previewUrl ? (
                  <img src={previewUrl} alt="" loading="lazy"
                    onError={() => setBrokenPreviews(prev => { const n = new Set(prev); n.add(video.id); return n })}
                    className="w-full h-full object-cover" />
                ) : '🎬'}
              </div>
              <div className="flex-1 min-w-0">
                <Link to={`/videos/${video.id}`} className="font-medium text-fg hover:text-blue-600 dark:text-blue-400 transition-colors block truncate">
                  {displayTitle(video)}
                </Link>
                {video.title && video.title !== video.url && (
                  <p className="text-xs text-subtle mt-1 truncate">{video.url}</p>
                )}
                <div className="flex items-center gap-2 sm:gap-4 mt-2 flex-wrap">
                  <span className={`text-xs ${statusColors[video.transcript_status] || 'text-muted'}`} title={video.transcript_error || ''}>
                    {statusLabel(video)}
                  </span>
                  <PersonBadge person={personsById[video.person_id]} />
                  {categoriesById[video.category_id] && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${colorClass(categoriesById[video.category_id].color)}`}>
                      {categoriesById[video.category_id].name}
                    </span>
                  )}
                  {video.duration_seconds && <span className="text-xs text-subtle">{Math.floor(video.duration_seconds/60)}m {video.duration_seconds%60}s</span>}
                  <span className="text-xs text-subtle">{new Date(video.created_at).toLocaleDateString('de-DE')}</span>
                </div>
              </div>
              <button onClick={() => deleteVideo(video.id)} className="text-subtle hover:text-red-600 dark:text-red-400 transition-colors p-1">🗑️</button>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
