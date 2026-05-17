import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { getActivePersonId } from '../lib/person'
import PersonFilter, { PersonBadge } from '../components/PersonFilter'

export default function NotesPage() {
  const [notes, setNotes] = useState([])
  const [persons, setPersons] = useState([])
  const [filterPersonId, setFilterPersonId] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [ns, ps] = await Promise.all([api.getNotes(), api.getPersons()])
      setNotes(ns); setPersons(ps)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function addNote(e) {
    e.preventDefault()
    if (!content.trim()) return
    setAdding(true)
    try {
      const note = await api.addNote(content.trim(), null, getActivePersonId())
      setNotes(prev => [note, ...prev])
      setContent('')
    } catch (err) { setError(err.message) }
    finally { setAdding(false) }
  }

  const personsById = useMemo(() => Object.fromEntries(persons.map(p => [p.id, p])), [persons])
  const filteredNotes = useMemo(() => {
    if (!filterPersonId) return notes
    if (filterPersonId === 'none') return notes.filter(n => !n.person_id)
    return notes.filter(n => n.person_id === filterPersonId)
  }, [notes, filterPersonId])

  async function saveEdit(id) {
    const note = await api.updateNote(id, editContent)
    setNotes(prev => prev.map(n => n.id === id ? note : n))
    setEditing(null)
  }

  async function deleteNote(id) {
    if (!confirm('Diese Notiz löschen?')) return
    await api.deleteNote(id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-fg mb-4 sm:mb-6">Notizen</h2>
      <form onSubmit={addNote} className="mb-6">
        <textarea placeholder="Notiz schreiben..." value={content} onChange={e => setContent(e.target.value)} rows={4}
          className="w-full bg-surface border border-line rounded-lg px-4 py-3 text-fg placeholder:text-muted focus:outline-none focus:border-blue-500 resize-none" />
        <button type="submit" disabled={adding || !content.trim()}
          className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
          {adding ? 'Wird gespeichert...' : 'Neue Notiz'}
        </button>
      </form>
      {error && <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>}
      <PersonFilter persons={persons} value={filterPersonId} onChange={setFilterPersonId} />
      {loading ? <p className="text-muted">Lädt...</p> : (
        <div className="space-y-4">
          {filteredNotes.length === 0 && <p className="text-muted">Keine Notizen in dieser Auswahl.</p>}
          {filteredNotes.map(note => (
            <div key={note.id} className="bg-surface border border-line rounded-xl p-4">
              {editing === note.id ? (
                <div>
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4}
                    className="w-full bg-elevated border border-line rounded-lg px-3 py-2 text-fg focus:outline-none focus:border-blue-500 resize-none" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => saveEdit(note.id)} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">Speichern</button>
                    <button onClick={() => setEditing(null)} className="px-4 py-1.5 bg-elevated text-fg text-sm rounded-lg">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-fg whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-subtle">{new Date(note.created_at).toLocaleString('de-DE')}</span>
                      <PersonBadge person={personsById[note.person_id]} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(note.id); setEditContent(note.content) }}
                        className="text-subtle hover:text-blue-600 dark:text-blue-400 transition-colors text-sm">✏️</button>
                      <button onClick={() => deleteNote(note.id)} className="text-subtle hover:text-red-600 dark:text-red-400 transition-colors text-sm">🗑️</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
