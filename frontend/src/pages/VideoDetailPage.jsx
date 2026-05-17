import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { colorClass } from './SettingsPage'
import { PersonBadge } from '../components/PersonFilter'

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}
function faviconFor(url) {
  const d = getDomain(url)
  return d ? `https://www.google.com/s2/favicons?domain=${d}&sz=128` : ''
}
function fallbackPreview(url) {
  return url ? `https://api.microlink.io/?url=${encodeURIComponent(url)}&embed=image.url` : ''
}

export default function VideoDetailPage() {
  const { id } = useParams()
  const [video, setVideo] = useState(null)
  const [categories, setCategories] = useState([])
  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editPerson, setEditPerson] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(0)
  const [previewBroken, setPreviewBroken] = useState(false)

  useEffect(() => {
    Promise.all([api.getVideo(id), api.getCategories(), api.getPersons()])
      .then(([v, cs, ps]) => {
        setVideo(v); setCategories(cs); setPersons(ps)
        setEditTitle(v?.title || '')
        setEditNotes(v?.notes || '')
        setEditCategory(v?.category_id || '')
        setEditPerson(v?.person_id || '')
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-muted">Lädt...</div>
  if (!video) return <div className="p-8 text-red-600 dark:text-red-400">Video nicht gefunden</div>

  const category = categories.find(c => c.id === video.category_id)
  const person = persons.find(p => p.id === video.person_id)
  const previewUrl = video.thumbnail_url || (!previewBroken && fallbackPreview(video.url)) || ''
  const favicon = faviconFor(video.url)
  const filteredSegments = (video.segments || []).filter(s =>
    !search || s.text.toLowerCase().includes(search.toLowerCase())
  )

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  async function save() {
    setSaving(true)
    try {
      const updated = await api.updateVideo(video.id, {
        title: editTitle.trim() || video.url,
        notes: editNotes.trim() || null,
        category_id: editCategory || null,
        person_id: editPerson || null,
      })
      setVideo(v => ({ ...v, ...updated }))
      setSavedAt(Date.now())
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const dirty =
    (editTitle.trim() || video.url) !== (video.title || video.url) ||
    (editNotes.trim() || null) !== (video.notes || null) ||
    (editCategory || null) !== (video.category_id || null) ||
    (editPerson || null) !== (video.person_id || null)

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto">
      <Link to="/videos" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm mb-4 block">← Zurück zu Videos</Link>

      <div className="bg-surface border border-line rounded-2xl overflow-hidden mb-6">
        <a href={video.url} target="_blank" rel="noopener noreferrer"
          className="block relative aspect-[16/9] bg-app overflow-hidden">
          {previewUrl ? (
            <img src={previewUrl} alt="" loading="lazy" onError={() => setPreviewBroken(true)}
              className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-5xl">🎬</div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center gap-2">
            {favicon && <img src={favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" />}
            <span className="text-xs text-white truncate">{getDomain(video.url)}</span>
            {video.duration_seconds && (
              <span className="ml-auto text-xs text-white bg-black/40 px-2 py-0.5 rounded">
                {Math.floor(video.duration_seconds/60)}m {video.duration_seconds%60}s
              </span>
            )}
          </div>
        </a>

        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-muted mb-1">Titel</label>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              placeholder="Titel des Videos"
              className="w-full bg-app border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500" />
            <a href={video.url} target="_blank" rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-xs mt-1 block truncate">{video.url}</a>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-muted mb-1">Notiz</label>
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={4}
              placeholder="Eigene Gedanken, Stichworte, was im Video wichtig ist…"
              className="w-full bg-app border border-line rounded-lg px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:border-blue-500 resize-y" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted mb-1">Kategorie</label>
              <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                className="w-full bg-app border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500">
                <option value="">— keine —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-muted mb-1">Person</label>
              <select value={editPerson} onChange={e => setEditPerson(e.target.value)}
                className="w-full bg-app border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500">
                <option value="">— keine —</option>
                {persons.map(p => <option key={p.id} value={p.id}>{p.emoji || '👤'} {p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {category && (
                <span className={`px-2 py-0.5 rounded-full text-xs border ${colorClass(category.color)}`}>{category.name}</span>
              )}
              <PersonBadge person={person} />
              <span className="text-xs text-subtle capitalize">{video.transcript_status}</span>
            </div>
            <button onClick={save} disabled={!dirty || saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Wird gespeichert…' : 'Speichern'}
            </button>
          </div>
          {savedAt > 0 && Date.now() - savedAt < 4000 && (
            <p className="text-xs text-green-600 dark:text-green-400">Gespeichert.</p>
          )}
          {video.transcript_error && (
            <p className="text-xs text-red-600 dark:text-red-400 break-words">
              Transkriptions-Fehler: {video.transcript_error}
            </p>
          )}
        </div>
      </div>

      {video.segments && video.segments.length > 0 && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-4">
            <h3 className="font-semibold text-fg">Transkript ({video.segments.length} Abschnitte)</h3>
            <input type="text" placeholder="Transkript durchsuchen..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-auto bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:border-blue-500" />
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredSegments.map(seg => (
              <div key={seg.id} className={`flex gap-3 p-3 rounded-lg ${search && seg.text.toLowerCase().includes(search.toLowerCase()) ? 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700/50' : 'bg-surface border border-line'}`}>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-mono whitespace-nowrap pt-0.5">{formatTime(seg.start_time)}</span>
                <p className="text-sm text-fg">{seg.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {video.transcript_status === 'pending' && (
        <div className="bg-surface border border-line rounded-xl p-6 text-center">
          <p className="text-muted">⏳ Transkript wird verarbeitet...</p>
          <p className="text-xs text-subtle mt-2">Dies kann je nach Videolänge einige Minuten dauern.</p>
        </div>
      )}
    </div>
  )
}
