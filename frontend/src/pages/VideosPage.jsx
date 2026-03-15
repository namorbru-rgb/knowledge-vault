import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function VideosPage() {
  const [videos, setVideos] = useState([])
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadVideos() }, [])

  async function loadVideos() {
    try {
      const data = await api.getVideos()
      setVideos(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function addVideo(e) {
    e.preventDefault()
    if (!url.trim()) return
    setAdding(true)
    try {
      const video = await api.addVideo(url.trim())
      setVideos(prev => [video, ...prev])
      setUrl('')
    } catch (err) { setError(err.message) }
    finally { setAdding(false) }
  }

  async function deleteVideo(id) {
    if (!confirm('Delete this video?')) return
    await api.deleteVideo(id)
    setVideos(prev => prev.filter(v => v.id !== id))
  }

  const statusColors = { done: 'text-green-400', error: 'text-red-400', processing: 'text-yellow-400', pending: 'text-slate-400' }
  const statusLabels = { done: '✅ Transcribed', error: '❌ Error', processing: '⏳ Processing', pending: '🕐 Pending' }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Videos</h2>

      <form onSubmit={addVideo} className="flex gap-3 mb-8">
        <input type="url" placeholder="YouTube or video URL..." value={url} onChange={e => setUrl(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500" />
        <button type="submit" disabled={adding}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
          {adding ? 'Adding...' : 'Add Video'}
        </button>
      </form>

      {error && <p className="text-red-400 mb-4">{error}</p>}
      {loading ? <p className="text-slate-400">Loading...</p> : (
        <div className="space-y-3">
          {videos.length === 0 && <p className="text-slate-400">No videos yet. Add a YouTube URL above!</p>}
          {videos.map(video => (
            <div key={video.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex gap-4">
              {video.thumbnail_url && <img src={video.thumbnail_url} alt="" className="w-24 h-16 object-cover rounded-lg flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <Link to={`/videos/${video.id}`} className="font-medium text-white hover:text-blue-400 transition-colors block truncate">
                  {video.title || video.url}
                </Link>
                <p className="text-xs text-slate-500 mt-1 truncate">{video.url}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className={`text-xs ${statusColors[video.transcript_status] || 'text-slate-400'}`}>
                    {statusLabels[video.transcript_status] || video.transcript_status}
                  </span>
                  {video.duration_seconds && <span className="text-xs text-slate-500">{Math.floor(video.duration_seconds/60)}m {video.duration_seconds%60}s</span>}
                  <span className="text-xs text-slate-600">{new Date(video.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => deleteVideo(video.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
