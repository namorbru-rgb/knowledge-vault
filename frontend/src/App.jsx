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

const SHARED_EMAIL = import.meta.env.VITE_SHARED_USER_EMAIL || ''
const SHARED_PASSWORD = import.meta.env.VITE_SHARED_USER_PASSWORD || ''

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

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
      if (!SHARED_EMAIL || !SHARED_PASSWORD) {
        setAuthError('Geteilte Anmeldedaten fehlen: VITE_SHARED_USER_EMAIL und VITE_SHARED_USER_PASSWORD im Build-Setup setzen.')
        setLoading(false)
        return
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: SHARED_EMAIL,
        password: SHARED_PASSWORD,
      })
      if (cancelled) return
      if (error) {
        setAuthError('Automatische Anmeldung fehlgeschlagen: ' + error.message)
        setLoading(false)
        return
      }
      setSession(data.session)
      if (data.session) setAuthToken(data.session.access_token)
      setLoading(false)
    }

    ensureSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s)
      if (s) setAuthToken(s.access_token)
      else setAuthToken(null)
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-lg">Verbinde…</div>
    </div>
  )

  if (!session) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-red-900/30 border border-red-700/50 text-red-200 rounded-xl p-4 text-sm">
        {authError || 'Keine Verbindung möglich.'}
      </div>
    </div>
  )

  return (
    <Routes>
      <Route path="/" element={<Layout session={session} />}>
        <Route index element={<DashboardPage />} />
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
