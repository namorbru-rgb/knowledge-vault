import { useEffect, useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { getInitialTheme, setTheme } from '../lib/theme'
import PersonSwitcher from './PersonSwitcher'

const navItems = [
  { to: '/', label: 'Übersicht', icon: '🏠', exact: true },
  { to: '/videos', label: 'Videos', icon: '🎬' },
  { to: '/links', label: 'Links', icon: '🔗' },
  { to: '/photos', label: 'Fotos', icon: '📷' },
  { to: '/notes', label: 'Notizen', icon: '📝' },
  { to: '/search', label: 'Suche', icon: '🔍' },
  { to: '/voice', label: 'Sprach-Chat', icon: '🎙️' },
  { to: '/settings', label: 'Einstellungen', icon: '⚙️' },
]

export default function Layout({ session }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [theme, setThemeState] = useState(() => getInitialTheme())
  const closeDrawer = () => setDrawerOpen(false)

  useEffect(() => { setTheme(theme) }, [theme])

  function toggleTheme() {
    setThemeState(t => t === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="min-h-[100dvh] bg-app md:flex">
      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-surface/90 backdrop-blur-md border-b border-line px-4 h-14 pt-[env(safe-area-inset-top)]">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Menü öffnen"
          className="p-2 -ml-2 rounded-lg text-fg hover:bg-elevated active:bg-hover"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-fg truncate tracking-tight">🗄️ KnowledgeVault</h1>
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
          className="ml-auto p-2 -mr-2 rounded-lg text-muted hover:text-fg hover:bg-elevated"
          title={theme === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
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
          fixed md:static inset-y-0 left-0 z-50 w-64 md:w-60
          bg-surface border-r border-line flex flex-col shadow-card md:shadow-none
          transform transition-transform duration-200 ease-out
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        `}
      >
        <div className="p-4 border-b border-line flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-fg tracking-tight">🗄️ KnowledgeVault</h1>
            <p className="text-xs text-muted mt-1 truncate">Familien-Archiv</p>
          </div>
          <button
            onClick={closeDrawer}
            aria-label="Menü schliessen"
            className="md:hidden p-1 -mr-1 rounded-lg text-muted hover:text-fg hover:bg-elevated"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-3 pt-3">
          <PersonSwitcher onSelect={closeDrawer} />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              onClick={closeDrawer}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-muted hover:bg-elevated hover:text-fg'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-line">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-elevated hover:text-fg transition-colors"
            title={theme === 'dark' ? 'Zu Hellmodus wechseln' : 'Zu Dunkelmodus wechseln'}
          >
            <span className="flex items-center gap-3">
              <span className="text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
              {theme === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
            </span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto pb-[env(safe-area-inset-bottom)]">
        <Outlet />
      </main>
    </div>
  )
}
