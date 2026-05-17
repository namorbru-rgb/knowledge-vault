import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function VideoDetailPage() {
  const { id } = useParams()
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.getVideo(id).then(setVideo).catch(console.error).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-8 text-muted">Lädt...</div>
  if (!video) return <div className="p-8 text-red-600 dark:text-red-400">Video nicht gefunden</div>

  const filteredSegments = (video.segments || []).filter(s =>
    !search || s.text.toLowerCase().includes(search.toLowerCase())
  )

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <Link to="/videos" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 text-sm mb-4 block">← Zurück zu Videos</Link>

      <div className="bg-surface rounded-xl p-4 sm:p-6 border border-line mb-6">
        <div className="flex gap-3 sm:gap-4">
          {video.thumbnail_url && <img src={video.thumbnail_url} alt="" className="w-20 h-14 sm:w-32 sm:h-20 object-cover rounded-lg flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-fg break-words">{video.title}</h2>
            <a href={video.url} target="_blank" rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 text-xs sm:text-sm mt-1 block truncate">{video.url}</a>
            {video.description && <p className="text-muted text-xs sm:text-sm mt-2 line-clamp-3 break-words">{video.description}</p>}
            <div className="flex gap-4 mt-3 flex-wrap">
              {video.duration_seconds && <span className="text-xs text-subtle">{Math.floor(video.duration_seconds/60)}m {video.duration_seconds%60}s</span>}
              <span className="text-xs text-subtle capitalize">{video.transcript_status}</span>
            </div>
          </div>
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
