import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { family } from '../lib/family'
import { getActivePersonId } from '../lib/person'

const PAGE_SIZE = 36

function safeSource(url) {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null
  } catch { return null }
}

function displayTitle(video) {
  const title = String(video.title || '').trim()
  const description = String(video.description || '').trim()
  const isStats = /\bviews?\b.*\breactions?\b/i.test(title)
  if (title && title !== video.source_url && !isStats) return title
  if (description) return description.split('\n').map(x => x.trim()).find(Boolean)?.slice(0,120) || 'Video'
  try {
    const u = new URL(video.source_url)
    const name = u.pathname.split('/').filter(Boolean).pop()
    return name ? u.hostname + ' · ' + decodeURIComponent(name).replace(/[-_]/g,' ') : u.hostname
  } catch { return 'Video' }
}

export default function VideosPage() {
  const [videos, setVideos] = useState([])
  const [members, setMembers] = useState([])
  const [userId, setUserId] = useState('')
  const [owner, setOwner] = useState('all')
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [url, setUrl] = useState('')
  const [brokenImages, setBrokenImages] = useState(() => new Set())
  const requestNumber = useRef(0)
  const currentUser = useRef('')

  async function fetchVideos(selected = 'all', offset = 0, id = currentUser.current) {
    const requestId = ++requestNumber.current
    setBusy(true)
    setError('')
    try {
      const target = selected === 'all' ? null : selected === 'mine' ? id : selected
      const entries = await family.knowledgeVideos(PAGE_SIZE, offset, target)
      if (requestId !== requestNumber.current) return
      const batch = entries || []
      setVideos(previous => offset ? [...previous, ...batch] : batch)
      setTotal(batch[0]?.total_count ?? (offset ? offset : 0))
    } catch (problem) {
      if (requestId === requestNumber.current) setError(problem.message || 'Videos konnten nicht geladen werden.')
    } finally {
      if (requestId === requestNumber.current) {
        setBusy(false)
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    let current = true
    Promise.all([family.userId(), family.members()]).then(async ([id, list]) => {
      if (!current) return
      setUserId(id)
      currentUser.current = id
      setMembers(list || [])
      await fetchVideos('all',0,id)
    }).catch(problem => {
      if (current) { setError(problem.message || 'Videos nicht verfügbar.'); setLoading(false) }
    })
    return () => { current=false; requestNumber.current++ }
  }, [])

  function chooseOwner(next) {
    setOwner(next)
    setVideos([])
    setTotal(0)
    setNotice('')
    fetchVideos(next,0)
  }

  async function addVideo(event) {
    event.preventDefault()
    if (!url.trim()) return
    setAdding(true)
    setError('')
    try {
      await api.addVideo(url.trim(), null, getActivePersonId())
      setUrl('')
      setNotice('Video hinzugefügt. Die Verarbeitung erfolgt anschliessend.')
      await fetchVideos(owner,0)
    } catch (problem) { setError(problem.message || 'Video konnte nicht hinzugefügt werden.') }
    finally { setAdding(false) }
  }

  async function removeVideo(id) {
    if (!window.confirm('Dieses eigene Video wirklich löschen?')) return
    setBusy(true)
    try {
      await api.deleteVideo(id)
      await fetchVideos(owner,0)
    } catch (problem) { setError(problem.message || 'Löschen fehlgeschlagen.') }
    finally { setBusy(false) }
  }

  const related = members.filter(m => m.user_id !== userId && members.some(own =>
    own.user_id === userId && own.family_id === m.family_id
  )).filter((m,index,all) => all.findIndex(x => x.user_id === m.user_id) === index)
  const selectedName = related.find(m => m.user_id === owner)?.display_name
  const noSharedVideos = owner !== 'mine' && (owner === 'all' || !!selectedName)

  return <div className="hub-page space-y-5">
    <header>
      <h1 className="text-2xl font-bold">Familienvideos</h1>
      <p className="text-muted mt-1">Deine Videos und die von Familienmitgliedern ausdrücklich freigegebenen Videos.</p>
    </header>

    <section className="hub-card space-y-3">
      <h2 className="font-semibold">Wessen Videos möchtest du sehen?</h2>
      <div className="hub-person-picks">
        <button type="button" className={`hub-person-pill ${owner==='all'?'is-selected':''}`}
          aria-pressed={owner==='all'} onClick={()=>chooseOwner('all')}>Alle freigegebenen</button>
        <button type="button" className={`hub-person-pill ${owner==='mine'?'is-selected':''}`}
          aria-pressed={owner==='mine'} onClick={()=>chooseOwner('mine')}>Meine Videos</button>
        {related.map(member => <button type="button" key={member.user_id}
          className={`hub-person-pill ${owner===member.user_id?'is-selected':''}`}
          aria-pressed={owner===member.user_id} onClick={()=>chooseOwner(member.user_id)}>
          {member.display_name}
        </button>)}
      </div>
      {total > 0 && <p className="text-sm text-muted">{total.toLocaleString('de-CH')} Videos in dieser Auswahl</p>}
    </section>

    {error && <p className="hub-feedback-error" role="alert">{error}</p>}
    {notice && <p className="hub-feedback-success" role="status">{notice}</p>}

    <details className="hub-more">
      <summary>Neues Video hinzufügen</summary>
      <form onSubmit={addVideo} className="space-y-3 mt-3">
        <p className="text-sm text-muted">Link zu YouTube oder einer anderen Videoquelle einfügen. Das Video wird in deinem persönlichen Knowledge gespeichert.</p>
        <label className="hub-label">Video-Adresse
          <input type="url" className="hub-input" value={url} onChange={e=>setUrl(e.target.value)}
            placeholder="https://…" required autoCapitalize="none" autoCorrect="off" />
        </label>
        <button className="hub-button" type="submit" disabled={adding}>{adding?'Wird hinzugefügt…':'Video hinzufügen'}</button>
      </form>
    </details>

    {loading ? <p className="text-muted">Videos werden geladen…</p> : <>
      {!busy && videos.length === 0 && <section className="hub-card space-y-3">
        <h2 className="font-semibold">Hier sind noch keine Videos sichtbar</h2>
        {noSharedVideos ? <>
          <p className="text-sm text-muted">
            {selectedName ? `Die Videos von ${selectedName} sind noch nicht für dich sichtbar.`
              : 'In deinem aktuellen Konto liegen keine Videos. Die vorhandenen Familienvideos benötigen zuerst eine Freigabe durch das jeweilige Konto.'}
          </p>
          <p className="text-sm text-muted">
            Dafür im betreffenden Konto unter <strong>Knowledge → Meine Knowledge-Einträge mit der Familie teilen</strong> die Freigabe aktivieren.
            Danach erscheinen die Videos hier automatisch.
          </p>
          <Link to="/knowledge" className="hub-secondary-button">Zu Knowledge und Freigaben</Link>
        </> : <p className="text-sm text-muted">In deinem aktuellen Konto wurden noch keine Videos gespeichert.</p>}
      </section>}

      {videos.length > 0 && <section aria-label="Videoliste" className="space-y-3">
        {videos.map(video => {
          const source = safeSource(video.source_url)
          const own = video.mine
          const title = displayTitle(video)
          const preview = video.thumbnail_url && !brokenImages.has(video.video_id)
          return <article className="hub-card !p-3 sm:!p-4" key={video.video_id}>
            <div className="flex gap-3 items-start">
              <div className="w-24 h-16 rounded-xl bg-elevated shrink-0 flex items-center justify-center overflow-hidden">
                {preview ? <img src={video.thumbnail_url} alt="" loading="lazy"
                  className="w-full h-full object-cover"
                  onError={()=>setBrokenImages(previous => new Set([...previous,video.video_id]))} /> :
                  <span className="text-2xl text-muted">▶</span>}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                {own ? <Link to={`/videos/${video.video_id}`}
                  className="text-fg font-semibold break-words block">{title}</Link> :
                  source ? <a href={source} target="_blank" rel="noopener noreferrer"
                    className="font-semibold text-fg break-words block">{title}</a> :
                  <span className="font-semibold text-fg break-words block">{title}</span>}
                <p className="text-xs text-muted">
                  {video.mine?'Von mir':`Von ${video.owner_name}`}
                  {video.assigned_person && ` · Für ${video.assigned_person}`}
                  {video.created_at && ` · ${new Date(video.created_at).toLocaleDateString('de-CH')}`}
                </p>
                {video.description && <p className="text-xs text-muted break-words line-clamp-2">{video.description}</p>}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {source && !own && <a href={source} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600">Video öffnen ↗</a>}
                  {own && <span className="text-xs text-muted">{video.transcript_status==='done'?'Transkribiert':
                    video.transcript_status==='processing'?'In Verarbeitung':'Gespeichert'}</span>}
                  {own && <button type="button" disabled={busy}
                    className="text-xs text-red-600" onClick={()=>removeVideo(video.video_id)}>Löschen</button>}
                </div>
              </div>
            </div>
          </article>
        })}
        {videos.length < total && <button type="button" disabled={busy}
          className="hub-secondary-button w-full"
          onClick={()=>fetchVideos(owner,videos.length)}>{busy?'Lade weitere Videos…':'Weitere Videos anzeigen'}</button>}
      </section>}
    </>}
  </div>
}
