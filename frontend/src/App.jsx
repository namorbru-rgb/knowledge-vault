import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { setAuthToken } from './lib/api'
import DashboardPage from './pages/DashboardPage'
import VideosPage from './pages/VideosPage'
import VideoDetailPage from './pages/VideoDetailPage'
import LinksPage from './pages/LinksPage'
import PhotosPage from './pages/PhotosPage'
import NotesPage from './pages/NotesPage'
import SearchPage from './pages/SearchPage'
import SettingsPage from './pages/SettingsPage'
import VoicePage from './pages/VoicePage'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import HubPage from './pages/HubPage'
import HealthPage from './pages/HealthPage'
import DocumentsPage from './pages/DocumentsPage'
import FamilyPage from './pages/FamilyPage'
import PasswordSettings from './components/PasswordSettings'
import OwnPasswordRenewal from './components/OwnPasswordRenewal'
import KnowledgeOAuthAuthorize from './pages/KnowledgeOAuthAuthorize'


export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [recovery,setRecovery]=useState(false)
  const [renewal,setRenewal]=useState('idle')

  useEffect(() => {
    let cancelled = false

    async function ensureSession() {
      const { data: { session: existing } } = await supabase.auth.getSession()
      if (cancelled) return
      if (existing) {
        setSession(existing)
        setAuthToken(existing.access_token)
        setLoading(false)
        return
      }
      setLoading(false)
    }

    ensureSession().catch(() => { if (!cancelled) { setAuthError('Anmeldung konnte nicht geladen werden.'); setLoading(false) } })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if(event==='PASSWORD_RECOVERY')setRecovery(true)
      setSession(s)
      if (s) setAuthToken(s.access_token)
      else setAuthToken(null)
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!session?.user?.id) { setRenewal('idle'); return }
    setRenewal('checking')
    supabase.functions.invoke('family-admin', { body:{ action:'own-reset-status' } })
      .then(({data,error}) => {
        if (!cancelled) setRenewal(!error && data?.required === true ? 'required' : 'idle')
      })
      .catch(() => { if (!cancelled) setRenewal('idle') })
    return () => { cancelled=true }
  }, [session?.user?.id])

  if (window.location.hash.startsWith('#/oauth-authorize?')) return <KnowledgeOAuthAuthorize />

  if (loading) return (
    <div className="min-h-screen bg-app flex items-center justify-center">
      <div className="text-muted text-lg">Verbinde…</div>
    </div>
  )

  if (!session) return <LoginPage initialError={authError} />
  if (recovery) return <main className="hub-page"><PasswordSettings onDone={()=>setRecovery(false)}/></main>
  if (renewal === 'checking') return <div className="min-h-screen bg-app flex items-center justify-center"><div className="text-muted text-lg">Prüfe Anmeldung…</div></div>
  if (renewal === 'required') return <OwnPasswordRenewal onDone={()=>setRenewal('idle')} />

  return (
    <Routes>
      <Route path="/" element={<Layout key={session.user.id} session={session} />}>
        <Route index element={<HubPage />} />
        <Route path="knowledge" element={<DashboardPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="family" element={<FamilyPage />} />
        <Route path="videos" element={<VideosPage />} />
        <Route path="videos/:id" element={<VideoDetailPage />} />
        <Route path="links" element={<LinksPage />} />
        <Route path="photos" element={<PhotosPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="voice" element={<VoicePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
