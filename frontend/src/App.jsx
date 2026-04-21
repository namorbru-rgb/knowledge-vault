import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { setAuthToken } from './lib/api'
import LoginPage from './pages/LoginPage'
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

function ProtectedRoute({ children, session }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) setAuthToken(session.access_token)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session)
      if (session) setAuthToken(session.access_token)
      else setAuthToken(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-lg">Loading...</div>
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute session={session}>
          <Layout session={session} />
        </ProtectedRoute>
      }>
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
    </Routes>
  )
}
