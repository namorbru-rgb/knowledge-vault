import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useActivePerson } from '../lib/person'

// Dropdown zum Wechseln der aktiven Person.
// Lädt Personen-Liste, zeigt aktuelle Auswahl, ermöglicht Wechsel.
// Wenn keine Person vorhanden: Hinweis + Link in die Einstellungen.

export default function PersonSwitcher({ onSelect }) {
  const [persons, setPersons] = useState([])
  const [active, setActive] = useActivePerson(persons)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => { api.getPersons().then(setPersons).catch(console.error) }, [])

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function pick(id) {
    setActive(id)
    setOpen(false)
    onSelect?.()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated hover:bg-hover text-sm text-fg transition-colors"
        title="Aktive Person wechseln"
      >
        <span className="text-base">{active?.emoji || '👤'}</span>
        <span className="truncate flex-1 text-left">
          {active?.name || (persons.length === 0 ? 'Personen anlegen…' : 'Alle')}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1 z-20 bg-surface border border-line rounded-lg shadow-card overflow-hidden">
          <button
            onClick={() => pick(null)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-elevated flex items-center gap-2 ${!active ? 'text-fg font-medium' : 'text-muted'}`}
          >
            <span>👥</span> Alle
          </button>
          {persons.map(p => (
            <button
              key={p.id}
              onClick={() => pick(p.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-elevated flex items-center gap-2 ${active?.id === p.id ? 'text-fg font-medium' : 'text-muted'}`}
            >
              <span>{p.emoji || '👤'}</span> {p.name}
            </button>
          ))}
          <Link
            to="/settings"
            onClick={() => { setOpen(false); onSelect?.() }}
            className="block px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-elevated border-t border-line"
          >
            {persons.length === 0 ? '➕ Personen anlegen' : '⚙️ Personen verwalten'}
          </Link>
        </div>
      )}
    </div>
  )
}
