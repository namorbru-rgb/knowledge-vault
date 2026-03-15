import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function NotesPage() {
  const [notes, setNotes] = useState([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadNotes() }, [])

  async function loadNotes() {
    try { setNotes(await api.getNotes()) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function addNote(e) {
    e.preventDefault()
    if (!content.trim()) return
    setAdding(true)
    try {
      const note = await api.addNote(content.trim())
      setNotes(prev => [note, ...prev])
      setContent('')
    } catch (err) { setError(err.message) }
    finally { setAdding(false) }
  }

  async function saveEdit(id) {
    const note = await api.updateNote(id, editContent)
    setNotes(prev => prev.map(n => n.id === id ? note : n))
    setEditing(null)
  }

  async function deleteNote(id) {
    if (!confirm('Delete this note?')) return
    await api.deleteNote(id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-6">Notes</h2>
      <form onSubmit={addNote} className="mb-8">
        <textarea placeholder="Write a note..." value={content} onChange={e => setContent(e.target.value)} rows={4}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none" />
        <button type="submit" disabled={adding || !content.trim()}
          className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
          {adding ? 'Saving...' : 'Add Note'}
        </button>
      </form>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      {loading ? <p className="text-slate-400">Loading...</p> : (
        <div className="space-y-4">
          {notes.length === 0 && <p className="text-slate-400">No notes yet. Write your first note!</p>}
          {notes.map(note => (
            <div key={note.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              {editing === note.id ? (
                <div>
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => saveEdit(note.id)} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg">Save</button>
                    <button onClick={() => setEditing(null)} className="px-4 py-1.5 bg-slate-700 text-slate-300 text-sm rounded-lg">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-slate-200 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-slate-600">{new Date(note.created_at).toLocaleString()}</span>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditing(note.id); setEditContent(note.content) }}
                        className="text-slate-500 hover:text-blue-400 transition-colors text-sm">✏️</button>
                      <button onClick={() => deleteNote(note.id)} className="text-slate-500 hover:text-red-400 transition-colors text-sm">🗑️</button>
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
