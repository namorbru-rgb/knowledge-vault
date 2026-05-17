// Hellmodus / Dunkelmodus.
// Setzt die Klasse `dark` auf <html>, sodass Tailwind-Variants greifen,
// und merkt die Wahl in localStorage. Default = System-Voreinstellung.

const STORAGE_KEY = 'kv.theme'

export function getStoredTheme() {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

export function getInitialTheme() {
  const stored = getStoredTheme()
  if (stored === 'light' || stored === 'dark') return stored
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export function setTheme(theme) {
  applyTheme(theme)
  try { localStorage.setItem(STORAGE_KEY, theme) } catch {}
}

// Sofort-Anwendung beim Modul-Import, damit kein Flash erfolgt.
if (typeof document !== 'undefined') applyTheme(getInitialTheme())
