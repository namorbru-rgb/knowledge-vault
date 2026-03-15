import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '🏠', exact: true },
  { to: '/videos', label: 'Videos', icon: '🎬' },
  { to: '/links', label: 'Links', icon: '🔗' },
  { to: '/photos', label: 'Photos', icon: '📷' },
  { to: '/notes', label: 'Notes', icon: '📝' },
  { to: '/search', label: 'Search', icon: '🔍' },
]

export default function Layout({ session }) {
  const navigate = useNavigate()
  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }
  return (
    <div className="min-h-screen bg-slate-900 flex">
      <aside className="w-56 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-lg font-bold text-white">🗄️ KnowledgeVault</h1>
          <p className="text-xs text-slate-400 mt-1 truncate">{session?.user?.email}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }>
              <span>{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <button onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            ← Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><Outlet /></main>
    </div>
  )
}
