import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const navItems = [
  { to: '/', label: 'Übersicht', icon: '🏠', exact: true },
  { to: '/videos', label: 'Videos', icon: '🎬' },
  { to: '/links', label: 'Links', icon: '🔗' },
  { to: '/photos', label: 'Fotos', icon: '📷' },
  { to: '/notes', label: 'Notizen', icon: '📝' },
  { to: '/search', label: 'Suche', icon: '🔍' },
  { to: '/settings', label: 'Einstellungen', icon: '⚙️' },
]

export default function Layout({ session }) {
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const closeDrawer = () => setDrawerOpen(false)

  return (
    <div className="min-h-[100dvh] bg-slate-900 md:flex">
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-slate-800/95 backdrop-blur border-b border-slate-700 px-4 h-14 pt-[env(safe-area-inset-top)]">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Menü öffnen"
          className="p-2 -ml-2 rounded-lg text-slate-200 hover:bg-slate-700 active:bg-slate-600"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-white truncate">🗄️ KnowledgeVault</h1>
      </header>

      {drawerOpen && (
        <div
          onClick={closeDrawer}
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-64 md:w-56
          bg-slate-800 border-r border-slate-700 flex flex-col
          transform transition-transform duration-200 ease-out
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        `}
      >
        <div className="p-4 border-b border-slate-700 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white">🗄️ KnowledgeVault</h1>
            <p className="text-xs text-slate-400 mt-1 truncate">{session?.user?.email}</p>
          </div>
          <button
            onClick={closeDrawer}
            aria-label="Menü schliessen"
            className="md:hidden p-1 -mr-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={closeDrawer}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            ← Abmelden
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto pb-[env(safe-area-inset-bottom)]">
        <Outlet />
      </main>
    </div>
  )
}
