import { useEffect, useMemo, useState, useRef } from 'react'
import { api } from '../lib/api'
import { getActivePersonId } from '../lib/person'
import PersonFilter, { PersonBadge } from '../components/PersonFilter'

export default function PhotosPage() {
  const [photos, setPhotos] = useState([])
  const [persons, setPersons] = useState([])
  const [filterPersonId, setFilterPersonId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [ph, ps] = await Promise.all([api.getPhotos(), api.getPersons()])
      setPhotos(ph); setPersons(ps)
    } catch (err) { setError(err.message) }
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
        const photo = await api.uploadPhoto(fd, getActivePersonId())
        setPhotos(prev => [photo, ...prev])
      } catch (err) { setError(err.message) }
    }
    setUploading(false)
    e.target.value = ''
  }

  const personsById = useMemo(() => Object.fromEntries(persons.map(p => [p.id, p])), [persons])
  const filteredPhotos = useMemo(() => {
    if (!filterPersonId) return photos
    if (filterPersonId === 'none') return photos.filter(p => !p.person_id)
    return photos.filter(p => p.person_id === filterPersonId)
  }, [photos, filterPersonId])

  async function deletePhoto(id) {
    if (!confirm('Dieses Foto löschen?')) return
    await api.deletePhoto(id)
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-fg mb-4 sm:mb-6">Fotos</h2>
      <div className="mb-6">
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
          {uploading ? 'Wird hochgeladen...' : '📷 Fotos hochladen'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>
      {error && <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>}
      <PersonFilter persons={persons} value={filterPersonId} onChange={setFilterPersonId} />
      {loading ? <p className="text-muted">Lädt...</p> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPhotos.length === 0 && <p className="text-muted col-span-full">Keine Fotos in dieser Auswahl.</p>}
          {filteredPhotos.map(photo => (
            <div key={photo.id} className="bg-surface border border-line rounded-xl overflow-hidden group">
              {photo.public_url ? (
                <img src={photo.public_url} alt={photo.filename} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-elevated flex items-center justify-center text-4xl">📷</div>
              )}
              <div className="p-3">
                <p className="text-sm text-fg truncate">{photo.filename}</p>
                {photo.description && <p className="text-xs text-muted mt-1 line-clamp-2">{photo.description}</p>}
                {photo.objects_detected && photo.objects_detected.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {photo.objects_detected.slice(0, 4).map(obj => (
                      <span key={obj} className="px-1.5 py-0.5 bg-elevated text-fg text-xs rounded">{obj}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs ${photo.status === 'done' ? 'text-green-600 dark:text-green-400' : photo.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                    {photo.status === 'done' ? '✅' : photo.status === 'error' ? '❌' : '⏳'}
                  </span>
                  <PersonBadge person={personsById[photo.person_id]} />
                  <button onClick={() => deletePhoto(photo.id)} className="ml-auto text-subtle hover:text-red-600 dark:text-red-400 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
