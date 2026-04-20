import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { colorClass } from './SettingsPage'

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return '' }
}

function faviconFor(url) {
  const d = getDomain(url)
  return d ? `https://www.google.com/s2/favicons?domain=${d}&sz=128` : ''
}

function previewImageFor(url) {
  if (!url) return ''
  return `https://api.microlink.io/?url=${encodeURIComponent(url)}&embed=image.url`
}

function displayTitle(link) {
  if (link.title && link.title.trim() && link.title.trim() !== link.url) return link.title
  const d = getDomain(link.url)
  if (!d) return link.url
  const path = (() => {
    try {
      const p = new URL(link.url).pathname.replace(/\/+$/, '')
      if (!p || p === '/') return ''
      const last = p.split('/').filter(Boolean).pop() || ''
      return decodeURIComponent(last).replace(/[-_]/g, ' ').slice(0, 60)
    } catch { return '' }
  })()
  return path ? `${d} — ${path}` : d
}

function statusLabel(status) {
  if (status === 'done') return { icon: '✅', text: 'Fertig', cls: 'text-green-400' }
  if (status === 'error') return { icon: '❌', text: 'Fehler', cls: 'text-red-400' }
  return { icon: '⏳', text: 'Verarbeitung', cls: 'text-yellow-400' }
}

export default function LinksPage() {
  const [links, setLinks] = useState([])
  const [categories, setCategories] = useState([])
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [brokenImages, setBrokenImages] = useState(() => new Set())
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [ls, cs] = await Promise.all([api.getLinks(), api.getCategories()])
      setLinks(ls)
      setCategories(cs)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function addLink(e) {
    e.preventDefault()
    if (!url.trim()) return
    setAdding(true)
    try {
      const link = await api.addLink(url.trim())
      setLinks(prev => [link, ...prev])
      setUrl('')
    } catch (err) { setError(err.message) }
    finally { setAdding(false) }
  }

  async function deleteLink(id) {
    if (!confirm('Diesen Link löschen?')) return
    await api.deleteLink(id)
    setLinks(prev => prev.filter(l => l.id !== id))
  }

  function startEdit(link) {
    setEditingId(link.id)
    setEditTitle(link.title || '')
    setEditNotes(link.notes || '')
    setEditCategory(link.category_id || '')
  }

  async function saveEdit(link) {
    setSaving(true)
    try {
      const updated = await api.updateLink(link.id, {
        title: editTitle.trim() || null,
        notes: editNotes.trim() || null,
        category_id: editCategory || null,
      })
      setLinks(prev => prev.map(l => l.id === link.id ? updated : l))
      setEditingId(null)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const markBroken = (id) => {
    setBrokenImages(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  const categoryById = Object.fromEntries(categories.map(c => [c.id, c]))

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-4 sm:mb-6">Links</h2>

      <form onSubmit={addLink} className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6 sm:mb-8">
        <input
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={adding}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          {adding ? 'Wird gespeichert…' : 'Link speichern'}
        </button>
      </form>

      {error && <p className="text-red-400 mb-4">{error}</p>}

      {loading ? (
        <p className="text-slate-400">Lädt…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {links.length === 0 && (
            <p className="text-slate-400 col-span-full">
              Noch keine Links. Ersten URL oben speichern!
            </p>
          )}

          {links.map(link => {
            const title = displayTitle(link)
            const domain = getDomain(link.url)
            const favicon = faviconFor(link.url)
            const preview = brokenImages.has(link.id) ? null : previewImageFor(link.url)
            const s = statusLabel(link.status)
            const category = link.category_id ? categoryById[link.category_id] : null
            const isEditing = editingId === link.id

            return (
              <article
                key={link.id}
                className="group bg-slate-800 border border-slate-700 rounded-xl overflow-hidden flex flex-col hover:border-slate-600 transition-colors"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative aspect-[16/9] bg-slate-900 overflow-hidden"
                >
                  {preview && (
                    <img
                      src={preview}
                      alt=""
                      loading="lazy"
                      onError={() => markBroken(link.id)}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  {!preview && favicon && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <img src={favicon} alt="" className="w-16 h-16 opacity-70" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center gap-2">
                    {favicon && <img src={favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" />}
                    <span className="text-xs text-slate-200 truncate">{domain}</span>
                    {category && (
                      <span className={`ml-auto px-2 py-0.5 rounded-full text-xs border ${colorClass(category.color)}`}>
                        {category.name}
                      </span>
                    )}
                  </div>
                </a>

                <div className="p-4 flex-1 flex flex-col">
                  {!isEditing ? (
                    <>
                      <div className="flex justify-between items-start gap-2">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-white hover:text-blue-400 transition-colors line-clamp-2 flex-1 break-words"
                        >
                          {title}
                        </a>
                        <div className="flex flex-shrink-0 gap-1">
                          <button
                            onClick={() => startEdit(link)}
                            aria-label="Bearbeiten"
                            className="text-slate-500 hover:text-blue-400 transition-colors p-1"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteLink(link.id)}
                            aria-label="Löschen"
                            className="text-slate-600 hover:text-red-400 transition-colors p-1"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {link.notes && (
                        <p className="text-sm text-slate-200 mt-2 whitespace-pre-wrap break-words">{link.notes}</p>
                      )}

                      {link.summary && !link.notes && (
                        <p className="text-sm text-slate-400 mt-2 line-clamp-3">{link.summary}</p>
                      )}

                      {link.tags && link.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {link.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-blue-900/40 text-blue-300 text-xs rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-auto pt-3">
                        <span className={`text-xs ${s.cls}`}>{s.icon} {s.text}</span>
                        <span className="text-xs text-slate-600">
                          {new Date(link.created_at).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-slate-400">Titel</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        placeholder={displayTitle(link)}
                        className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />

                      <label className="text-xs text-slate-400 mt-1">Bemerkung</label>
                      <textarea
                        value={editNotes}
                        onChange={e => setEditNotes(e.target.value)}
                        rows={4}
                        placeholder="Eigene Notiz zum Link…"
                        className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
                      />

                      <label className="text-xs text-slate-400 mt-1">Kategorie</label>
                      {categories.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          Noch keine Kategorien. <Link to="/settings" className="text-blue-400 hover:text-blue-300">In den Einstellungen anlegen</Link>.
                        </p>
                      ) : (
                        <select
                          value={editCategory}
                          onChange={e => setEditCategory(e.target.value)}
                          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="">– keine –</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}

                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => saveEdit(link)}
                          disabled={saving}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                        >
                          {saving ? 'Speichert…' : 'Speichern'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
