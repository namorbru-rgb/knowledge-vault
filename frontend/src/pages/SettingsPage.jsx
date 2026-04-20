import { useEffect, useState } from 'react'
import { api } from '../lib/api'

const colorOptions = [
  { id: 'blue', label: 'Blau', cls: 'bg-blue-900/40 text-blue-300 border-blue-700/50' },
  { id: 'green', label: 'Grün', cls: 'bg-green-900/40 text-green-300 border-green-700/50' },
  { id: 'purple', label: 'Lila', cls: 'bg-purple-900/40 text-purple-300 border-purple-700/50' },
  { id: 'orange', label: 'Orange', cls: 'bg-orange-900/40 text-orange-300 border-orange-700/50' },
  { id: 'red', label: 'Rot', cls: 'bg-red-900/40 text-red-300 border-red-700/50' },
  { id: 'slate', label: 'Grau', cls: 'bg-slate-700 text-slate-200 border-slate-600' },
]
export const colorClass = (id) => (colorOptions.find(c => c.id === id) || colorOptions[0]).cls

export default function SettingsPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('blue')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('blue')

  useEffect(() => { load() }, [])

  async function load() {
    try { setCategories(await api.getCategories()) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function addCategory(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const cat = await api.addCategory(newName.trim(), newColor)
      setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setNewColor('blue')
    } catch (err) { setError(err.message) }
  }

  function startEdit(cat) {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color || 'blue')
  }

  async function saveEdit() {
    try {
      const updated = await api.updateCategory(editingId, { name: editName.trim(), color: editColor })
      setCategories(prev => prev.map(c => c.id === editingId ? updated : c).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingId(null)
    } catch (err) { setError(err.message) }
  }

  async function removeCategory(id) {
    if (!confirm('Kategorie löschen? Links verlieren ihre Zuordnung.')) return
    try {
      await api.deleteCategory(id)
      setCategories(prev => prev.filter(c => c.id !== id))
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-4 sm:mb-6">Einstellungen</h2>

      <section>
        <h3 className="text-lg font-semibold text-white mb-3">Kategorien</h3>
        <p className="text-sm text-slate-400 mb-4">
          Kategorien kannst Du beim Bearbeiten eines Links zuweisen.
        </p>

        <form onSubmit={addCategory} className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
          <label className="block text-sm text-slate-300 mb-2">Neue Kategorie</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="z. B. Rezepte, Reisen, Arbeit…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <select
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              {colorOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
              Hinzufügen
            </button>
          </div>
        </form>

        {error && <p className="text-red-400 mb-4">{error}</p>}

        {loading ? (
          <p className="text-slate-400">Lädt…</p>
        ) : categories.length === 0 ? (
          <p className="text-slate-400">Noch keine Kategorien angelegt.</p>
        ) : (
          <ul className="space-y-2">
            {categories.map(cat => (
              <li key={cat.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                {editingId === cat.id ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                    <select
                      value={editColor}
                      onChange={e => setEditColor(e.target.value)}
                      className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      {colorOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Speichern</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm border ${colorClass(cat.color)}`}>{cat.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(cat)} className="text-sm text-slate-400 hover:text-white">Bearbeiten</button>
                      <button onClick={() => removeCategory(cat.id)} className="text-sm text-slate-500 hover:text-red-400">Löschen</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
