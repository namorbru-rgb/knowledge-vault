// Aktive Person (Familienmitglied), unter der neue Einträge gespeichert werden.
// Persistiert in localStorage. Listener informieren UI über Wechsel.

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'kv.activePersonId'
const listeners = new Set()

export function getActivePersonId() {
  try { return localStorage.getItem(STORAGE_KEY) || null } catch { return null }
}

export function setActivePersonId(id) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {}
  listeners.forEach(fn => fn(id))
}

export function useActivePerson(persons) {
  const [id, setIdState] = useState(getActivePersonId)
  useEffect(() => {
    const fn = (newId) => setIdState(newId)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])
  const active = persons?.find(p => p.id === id) || null
  return [active, (nextId) => setActivePersonId(nextId)]
}
