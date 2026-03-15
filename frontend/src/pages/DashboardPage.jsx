import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

const cards = [
  { key: 'videos', label: 'Videos', icon: '🎬', to: '/videos', color: 'from-purple-600 to-purple-800' },
  { key: 'links', label: 'Links', icon: '🔗', to: '/links', color: 'from-blue-600 to-blue-800' },
  { key: 'photos', label: 'Fotos', icon: '📷', to: '/photos', color: 'from-green-600 to-green-800' },
  { key: 'notes', label: 'Notizen', icon: '📝', to: '/notes', color: 'from-orange-600 to-orange-800' },
]

const addLabels = {
  videos: 'Video',
  links: 'Link',
  photos: 'Foto',
  notes: 'Notiz',
}

export default function DashboardPage() {
  const [stats, setStats] = useState({ videos: 0, links: 0, photos: 0, notes: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Übersicht</h2>
      <p className="text-slate-400 mb-8">Dein Wissen auf einen Blick</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <Link key={card.key} to={card.to}
            className={`bg-gradient-to-br ${card.color} rounded-xl p-6 hover:scale-105 transition-transform`}>
            <div className="text-3xl mb-2">{card.icon}</div>
            <div className="text-3xl font-bold text-white">{loading ? '...' : stats[card.key]}</div>
            <div className="text-sm text-white/80 mt-1">{card.label}</div>
          </Link>
        ))}
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="font-semibold text-white mb-4">Schnellzugriff</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map(card => (
            <Link key={card.key} to={card.to}
              className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 hover:text-white transition-colors">
              <span>{card.icon}</span> {addLabels[card.key]} hinzufügen
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
