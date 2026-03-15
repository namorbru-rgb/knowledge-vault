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

  if (loading) return <div className="p-8 text-slate-400">Lädt...</div>
  if (!video) return <div className="p-8 text-red-400">Video nicht gefunden</div>

  const filteredSegments = (video.segments || []).filter(s =>
    !search || s.text.toLowerCase().includes(search.toLowerCase())
  )

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-8">
      <Link to="/videos" className="text-blue-400 hover:text-blue-300 text-sm mb-4 block">← Zurück zu Videos</Link>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-6">
        <div className="flex gap-4">
          {video.thumbnail_url && <img src={video.thumbnail_url} alt="" className="w-32 h-20 object-cover rounded-lg flex-shrink-0" />}
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{video.title}</h2>
            <a href={video.url} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm mt-1 block truncate">{video.url}</a>
            {video.description && <p className="text-slate-400 text-sm mt-2 line-clamp-3">{video.description}</p>}
            <div className="flex gap-4 mt-3">
              {video.duration_seconds && <span className="text-xs text-slate-500">{Math.floor(video.duration_seconds/60)}m {video.duration_seconds%60}s</span>}
              <span className="text-xs text-slate-500 capitalize">{video.transcript_status}</span>
            </div>
          </div>
        </div>
      </div>

      {video.segments && video.segments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Transkript ({video.segments.length} Abschnitte)</h3>
            <input type="text" placeholder="Transkript durchsuchen..." value={search} onChange={e => setSearch(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredSegments.map(seg => (
              <div key={seg.id} className={`flex gap-3 p-3 rounded-lg ${search && seg.text.toLowerCase().includes(search.toLowerCase()) ? 'bg-yellow-900/30 border border-yellow-700/50' : 'bg-slate-800 border border-slate-700'}`}>
                <span className="text-xs text-blue-400 font-mono whitespace-nowrap pt-0.5">{formatTime(seg.start_time)}</span>
                <p className="text-sm text-slate-300">{seg.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {video.transcript_status === 'pending' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <p className="text-slate-400">⏳ Transkript wird verarbeitet...</p>
          <p className="text-xs text-slate-500 mt-2">Dies kann je nach Videolänge einige Minuten dauern.</p>
        </div>
      )}
    </div>
  )
}
