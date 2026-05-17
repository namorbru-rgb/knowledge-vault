import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { getApiKey, setApiKey, getModel, setModel } from '../lib/claude'

const colorOptions = [
  { id: 'blue', label: 'Blau', cls: 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50' },
  { id: 'green', label: 'Grün', cls: 'bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700/50' },
  { id: 'purple', label: 'Lila', cls: 'bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/50' },
  { id: 'orange', label: 'Orange', cls: 'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700/50' },
  { id: 'red', label: 'Rot', cls: 'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/50' },
  { id: 'slate', label: 'Grau', cls: 'bg-elevated text-fg border-line' },
]
export const colorClass = (id) => (colorOptions.find(c => c.id === id) || colorOptions[0]).cls

const emojiOptions = ['👤','👩','👨','👧','👦','🧑','👵','👴','🐶','🐱']

export default function SettingsPage() {
  const [categories, setCategories] = useState([])
  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('blue')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('blue')
  const [newPersonName, setNewPersonName] = useState('')
  const [newPersonEmoji, setNewPersonEmoji] = useState('👤')
  const [newPersonColor, setNewPersonColor] = useState('blue')
  const [editingPersonId, setEditingPersonId] = useState(null)
  const [editPersonName, setEditPersonName] = useState('')
  const [editPersonEmoji, setEditPersonEmoji] = useState('👤')
  const [editPersonColor, setEditPersonColor] = useState('blue')
  const [claudeKey, setClaudeKey] = useState(() => getApiKey())
  const [claudeModel, setClaudeModel] = useState(() => getModel())
  const [keySaved, setKeySaved] = useState(false)

  useEffect(() => { load() }, [])

  async function addPerson(e) {
    e.preventDefault()
    if (!newPersonName.trim()) return
    try {
      const p = await api.addPerson(newPersonName.trim(), newPersonColor, newPersonEmoji)
      setPersons(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))
      setNewPersonName(''); setNewPersonEmoji('👤'); setNewPersonColor('blue')
    } catch (err) { setError(err.message) }
  }
  function startEditPerson(p) {
    setEditingPersonId(p.id); setEditPersonName(p.name)
    setEditPersonEmoji(p.emoji || '👤'); setEditPersonColor(p.color || 'blue')
  }
  async function savePerson() {
    try {
      const updated = await api.updatePerson(editingPersonId, {
        name: editPersonName.trim(), emoji: editPersonEmoji, color: editPersonColor,
      })
      setPersons(prev => prev.map(p => p.id === editingPersonId ? updated : p).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingPersonId(null)
    } catch (err) { setError(err.message) }
  }
  async function removePerson(id) {
    if (!confirm('Person löschen? Bestehende Einträge bleiben erhalten, verlieren aber die Zuordnung.')) return
    try {
      await api.deletePerson(id)
      setPersons(prev => prev.filter(p => p.id !== id))
    } catch (err) { setError(err.message) }
  }

  function saveClaudeSettings(e) {
    e.preventDefault()
    setApiKey(claudeKey.trim())
    setModel(claudeModel.trim() || 'claude-sonnet-4-6')
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2000)
  }

  async function load() {
    try {
      const [cats, pers] = await Promise.all([api.getCategories(), api.getPersons()])
      setCategories(cats); setPersons(pers)
    } catch (err) { setError(err.message) }
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
      <h2 className="text-2xl font-bold text-fg mb-4 sm:mb-6">Einstellungen</h2>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-fg mb-3">Sprach-Assistent</h3>
        <p className="text-sm text-muted mb-4">
          Für den Sprach-Chat (Paperclip) brauchst Du einen eigenen Anthropic-API-Key.
          Er wird ausschliesslich lokal in deinem Browser gespeichert.
        </p>
        <form onSubmit={saveClaudeSettings} className="bg-surface border border-line rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-sm text-fg mb-2">Anthropic API Key</label>
            <input
              type="password"
              autoComplete="off"
              placeholder="sk-ant-…"
              value={claudeKey}
              onChange={e => setClaudeKey(e.target.value)}
              className="w-full bg-app border border-line rounded-lg px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-fg mb-2">Modell</label>
            <input
              type="text"
              placeholder="claude-sonnet-4-6"
              value={claudeModel}
              onChange={e => setClaudeModel(e.target.value)}
              className="w-full bg-app border border-line rounded-lg px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-subtle mt-1">Empfohlen: claude-sonnet-4-6 (Standard), alternativ claude-haiku-4-5-20251001 für schneller/günstiger.</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
              Speichern
            </button>
            {keySaved && <span className="text-sm text-green-600 dark:text-green-400">Gespeichert.</span>}
          </div>
        </form>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-fg mb-3">Personen</h3>
        <p className="text-sm text-muted mb-4">
          Familienmitglieder, denen Du Wissen zuordnen kannst. Beim Speichern eines Eintrags
          wird automatisch die in der Seitenleiste ausgewählte Person verwendet.
        </p>

        <form onSubmit={addPerson} className="bg-surface border border-line rounded-xl p-4 mb-6">
          <label className="block text-sm text-fg mb-2">Neue Person</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={newPersonEmoji}
              onChange={e => setNewPersonEmoji(e.target.value)}
              className="bg-app border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500"
              aria-label="Emoji"
            >
              {emojiOptions.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input
              type="text"
              placeholder="z. B. Mama, Papa, Lea…"
              value={newPersonName}
              onChange={e => setNewPersonName(e.target.value)}
              className="flex-1 bg-app border border-line rounded-lg px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:border-blue-500"
            />
            <select
              value={newPersonColor}
              onChange={e => setNewPersonColor(e.target.value)}
              className="bg-app border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500"
            >
              {colorOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
              Hinzufügen
            </button>
          </div>
        </form>

        {loading ? (
          <p className="text-muted">Lädt…</p>
        ) : persons.length === 0 ? (
          <p className="text-muted">Noch keine Personen angelegt.</p>
        ) : (
          <ul className="space-y-2">
            {persons.map(p => (
              <li key={p.id} className="bg-surface border border-line rounded-xl p-3">
                {editingPersonId === p.id ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select value={editPersonEmoji} onChange={e => setEditPersonEmoji(e.target.value)}
                      className="bg-app border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500">
                      {emojiOptions.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <input type="text" value={editPersonName} onChange={e => setEditPersonName(e.target.value)}
                      className="flex-1 bg-app border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500" />
                    <select value={editPersonColor} onChange={e => setEditPersonColor(e.target.value)}
                      className="bg-app border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500">
                      {colorOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={savePerson} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Speichern</button>
                      <button onClick={() => setEditingPersonId(null)} className="px-3 py-2 bg-elevated hover:bg-hover text-fg rounded-lg text-sm">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm border inline-flex items-center gap-2 ${colorClass(p.color)}`}>
                      <span>{p.emoji || '👤'}</span> {p.name}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => startEditPerson(p)} className="text-sm text-muted hover:text-fg">Bearbeiten</button>
                      <button onClick={() => removePerson(p.id)} className="text-sm text-subtle hover:text-red-600 dark:text-red-400">Löschen</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-fg mb-3">Kategorien</h3>
        <p className="text-sm text-muted mb-4">
          Kategorien kannst Du beim Bearbeiten eines Links zuweisen.
        </p>

        <form onSubmit={addCategory} className="bg-surface border border-line rounded-xl p-4 mb-6">
          <label className="block text-sm text-fg mb-2">Neue Kategorie</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="z. B. Rezepte, Reisen, Arbeit…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 bg-app border border-line rounded-lg px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:border-blue-500"
            />
            <select
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
              className="bg-app border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500"
            >
              {colorOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
              Hinzufügen
            </button>
          </div>
        </form>

        {error && <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>}

        {loading ? (
          <p className="text-muted">Lädt…</p>
        ) : categories.length === 0 ? (
          <p className="text-muted">Noch keine Kategorien angelegt.</p>
        ) : (
          <ul className="space-y-2">
            {categories.map(cat => (
              <li key={cat.id} className="bg-surface border border-line rounded-xl p-3">
                {editingId === cat.id ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 bg-app border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500"
                    />
                    <select
                      value={editColor}
                      onChange={e => setEditColor(e.target.value)}
                      className="bg-app border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500"
                    >
                      {colorOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Speichern</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-2 bg-elevated hover:bg-hover text-fg rounded-lg text-sm">Abbrechen</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm border ${colorClass(cat.color)}`}>{cat.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(cat)} className="text-sm text-muted hover:text-fg">Bearbeiten</button>
                      <button onClick={() => removeCategory(cat.id)} className="text-sm text-subtle hover:text-red-600 dark:text-red-400">Löschen</button>
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
