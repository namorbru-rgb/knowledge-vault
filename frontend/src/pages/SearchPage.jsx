import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

const typeIcons = { video: '🎬', video_segment: '🎬', link: '🔗', photo: '📷', note: '📝' }
const typeColors = { video: 'bg-purple-900/40 text-purple-300', video_segment: 'bg-purple-900/40 text-purple-300', link: 'bg-blue-900/40 text-blue-300', photo: 'bg-green-900/40 text-green-300', note: 'bg-orange-900/40 text-orange-300' }
const typeLabels = { video: 'Video', video_segment: 'Video', link: 'Link', photo: 'Foto', note: 'Notiz' }

function typeLink(result) {
  if (result.type === 'video' || result.type === 'video_segment') return `/videos/${result.video_id || result.id}`
  if (result.type === 'link') return null
  if (result.type === 'photo') return '/photos'
  if (result.type === 'note') return '/notes'
  return null
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('')
  const [searched, setSearched] = useState(false)

  async function doSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const data = await api.search(query.trim())
      setResults(data.results || [])
      setMode(data.mode)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Suche</h2>
      <form onSubmit={doSearch} className="flex gap-3 mb-8">
        <input type="text" placeholder="Wissen durchsuchen..." value={query} onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500" />
        <button type="submit" disabled={loading}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
          {loading ? '...' : 'Suchen'}
        </button>
      </form>
      {searched && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-400 text-sm">{results.length} Ergebnisse {mode && <span className="text-slate-600">({mode} Suche)</span>}</p>
          </div>
          {results.length === 0 && !loading && <p className="text-slate-400">Keine Ergebnisse für „{query}"</p>}
          <div className="space-y-3">
            {results.map((r, i) => {
              const link = typeLink(r)
              const linkHref = r.type === 'link' ? r.url : null
              const content = (
                <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-0.5 ${typeColors[r.type] || ''}`}>
                      {typeIcons[r.type]} {typeLabels[r.type] || r.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{r.title || 'Ohne Titel'}</p>
                      {r.content && <p className="text-sm text-slate-400 mt-1 line-clamp-2">{r.content}</p>}
                      {r.similarity && <p className="text-xs text-slate-600 mt-1">{Math.round(r.similarity * 100)}% Übereinstimmung</p>}
                    </div>
                  </div>
                </div>
              )
              if (link) return <Link key={i} to={link}>{content}</Link>
              if (linkHref) return <a key={i} href={linkHref} target="_blank" rel="noopener noreferrer">{content}</a>
              return content
            })}
          </div>
        </div>
      )}
      {!searched && (
        <div className="text-center py-16">
          <p className="text-6xl mb-4">🔍</p>
          <p className="text-slate-400">Alle Videos, Links, Fotos und Notizen durchsuchen</p>
          <p className="text-slate-500 text-sm mt-2">Semantische KI-Suche wenn pgvector aktiviert ist</p>
        </div>
      )}
    </div>
  )
}
