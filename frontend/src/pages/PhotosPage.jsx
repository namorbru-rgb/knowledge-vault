import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'

export default function PhotosPage() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  useEffect(() => { loadPhotos() }, [])

  async function loadPhotos() {
    try { setPhotos(await api.getPhotos()) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function handleUpload(e) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of files) {
      try {
        const fd = new FormData()
        fd.append('photo', file)
        const photo = await api.uploadPhoto(fd)
        setPhotos(prev => [photo, ...prev])
      } catch (err) { setError(err.message) }
    }
    setUploading(false)
    e.target.value = ''
  }

  async function deletePhoto(id) {
    if (!confirm('Dieses Foto löschen?')) return
    await api.deletePhoto(id)
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Fotos</h2>
      <div className="mb-8">
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
          {uploading ? 'Wird hochgeladen...' : '📷 Fotos hochladen'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      {loading ? <p className="text-slate-400">Lädt...</p> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.length === 0 && <p className="text-slate-400 col-span-full">Noch keine Fotos. Lade welche hoch!</p>}
          {photos.map(photo => (
            <div key={photo.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden group">
              {photo.public_url ? (
                <img src={photo.public_url} alt={photo.filename} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-slate-700 flex items-center justify-center text-4xl">📷</div>
              )}
              <div className="p-3">
                <p className="text-sm text-white truncate">{photo.filename}</p>
                {photo.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{photo.description}</p>}
                {photo.objects_detected && photo.objects_detected.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {photo.objects_detected.slice(0, 4).map(obj => (
                      <span key={obj} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">{obj}</span>
                    ))}
                  </div>
                )}
                <div className="flex justify-between items-center mt-2">
                  <span className={`text-xs ${photo.status === 'done' ? 'text-green-400' : photo.status === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {photo.status === 'done' ? '✅' : photo.status === 'error' ? '❌' : '⏳'}
                  </span>
                  <button onClick={() => deletePhoto(photo.id)} className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
