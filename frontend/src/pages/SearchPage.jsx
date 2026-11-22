import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

const typeIcons = { video: '🎬', video_segment: '🎬', link: '🔗', photo: '📷', note: '📝' }
const typeColors = {
  video: 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  video_segment: 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  link: 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  photo: 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  note: 'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
}
const typeLabels = { video: 'Video', video_segment: 'Transkript', link: 'Link', photo: 'Foto', note: 'Notiz' }

function typeLink(result) {
  if (result.type === 'video') return `/videos/${result.id}`
  if (result.type === 'video_segment') return `/videos/${result.video_id}#transkript-${result.id}`
  if (result.type === 'link') return null
  if (result.type === 'photo') return '/photos'
  if (result.type === 'note') return '/notes'
  return null
}

function formatTime(seconds) {
  if (seconds == null) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(false)

  async function search(text, offset = 0) {
    setLoading(true)
    setError(false)
    if (!offset) {
      setSubmittedQuery(text)
      setResults([])
      setHasMore(false)
    }
    try {
      const data = await api.search(text, undefined, offset)
      setResults(previous => offset ? [...previous, ...data.results] : data.results)
      setHasMore(data.has_more)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function doSearch(event) {
    event.preventDefault()
    if (!loading && query.trim()) search(query.trim())
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-fg mb-4 sm:mb-6">Volltextsuche</h2>

      <form onSubmit={doSearch} className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-6 sm:mb-8">
        <input
          type="search"
          aria-label="Suchbegriffe"
          maxLength={200}
          placeholder="Wissen durchsuchen…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 bg-surface border border-line rounded-lg px-4 py-3 text-fg placeholder:text-muted focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          {loading ? '…' : 'Suchen'}
        </button>
      </form>

      {submittedQuery && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-muted text-sm">
              {results.length} {hasMore ? "angezeigte Treffer" : "Treffer"}
            </p>
          </div>
          {error && <p role="alert" className="mb-4 text-red-600">Die Suche ist gerade fehlgeschlagen. Bitte erneut versuchen.</p>}
          {results.length === 0 && !loading && !error && (
            <p className="text-muted">Keine Treffer für «{submittedQuery}»</p>
          )}
          <div className="space-y-3">
            {results.map(r => {
              const key = `${r.type}-${r.id}`
              const link = typeLink(r)
              const linkHref = r.type === 'link' ? r.url : null
              const content = (
                <div className="bg-surface border border-line rounded-xl p-4 hover:border-line transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-0.5 ${typeColors[r.type] || ''}`}>
                      {typeIcons[r.type]} {typeLabels[r.type] || r.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-fg truncate">{r.title || 'Ohne Titel'}</p>
                      {r.type === 'video_segment' && r.start_time != null && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-mono mt-0.5">@ {formatTime(r.start_time)}</p>
                      )}
                      {r.content && <p className="text-sm text-muted mt-1 line-clamp-3">{r.content}</p>}
                    </div>
                  </div>
                </div>
              )
              if (link) return <Link key={key} to={link}>{content}</Link>
              if (linkHref) return <a key={key} href={linkHref} target="_blank" rel="noopener noreferrer">{content}</a>
              return <div key={key}>{content}</div>
            })}
          </div>
          {hasMore && (
            <button type="button" disabled={loading} onClick={() => search(submittedQuery, results.length)}
              className="mt-4 rounded-lg border border-line px-4 py-2 text-fg disabled:opacity-50">
              {loading ? 'Lädt …' : 'Weitere Treffer'}
            </button>
          )}
        </div>
      )}

      {!submittedQuery && (
        <div className="text-center py-16">
          <p className="text-muted">Durchsucht Transkripte, Videos, gespeicherte Artikel, Fototexte und Notizen.</p>
          <p className="text-subtle text-sm mt-2">Setze eine Wortfolge in Anführungszeichen, um sie als Phrase zu suchen.</p>
        </div>
      )}
    </div>
  )
}
