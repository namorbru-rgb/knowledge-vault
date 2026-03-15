import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function LinksPage() {
  const [links, setLinks] = useState([])
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadLinks() }, [])

  async function loadLinks() {
    try { setLinks(await api.getLinks()) }
    catch (err) { setError(err.message) }
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

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Links</h2>
      <form onSubmit={addLink} className="flex gap-3 mb-8">
        <input type="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500" />
        <button type="submit" disabled={adding}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
          {adding ? 'Wird gespeichert...' : 'Link speichern'}
        </button>
      </form>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      {loading ? <p className="text-slate-400">Lädt...</p> : (
        <div className="grid md:grid-cols-2 gap-4">
          {links.length === 0 && <p className="text-slate-400">Noch keine Links. Ersten URL oben speichern!</p>}
          {links.map(link => (
            <div key={link.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <a href={link.url} target="_blank" rel="noopener noreferrer"
                  className="font-medium text-white hover:text-blue-400 transition-colors line-clamp-2 flex-1 mr-2">
                  {link.title || link.url}
                </a>
                <button onClick={() => deleteLink(link.id)} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">🗑️</button>
              </div>
              {link.summary && <p className="text-sm text-slate-400 mt-2 line-clamp-3">{link.summary}</p>}
              {link.tags && link.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {link.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-blue-900/40 text-blue-300 text-xs rounded-full">{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 mt-3">
                <span className={`text-xs ${link.status === 'done' ? 'text-green-400' : link.status === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {link.status === 'done' ? '✅' : link.status === 'error' ? '❌' : '⏳'} {link.status === 'done' ? 'Fertig' : link.status === 'error' ? 'Fehler' : 'Verarbeitung'}
                </span>
                <span className="text-xs text-slate-600">{new Date(link.created_at).toLocaleDateString('de-DE')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
