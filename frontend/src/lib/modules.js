// Stable IDs are also the contract for future authorised API/MCP integrations.
export const modules = [
  { id: 'knowledge', label: 'Knowledge', icon: '🗄️', to: '/knowledge', description: 'Videos, Links, Fotos und Notizen' },
  { id: 'health', label: 'Gesundheit', icon: '💚', to: '/health', description: 'Verlauf, Termine und tägliche Einnahmen' },
  { id: 'documents', label: 'Dokumente', icon: '📁', to: '/documents', description: 'Privater Tresor mit gezielten Freigaben' },
  ...['Versicherungen', 'Verträge', 'Finanzen', 'Buchhaltung', 'Steuern', 'Kalender'].map((label, index) => ({ id: ['insurance','contracts','finance','accounting','tax','calendar'][index], label, icon: '○', to: null, description: 'Vorbereitet für eine spätere Erweiterung' })),
]
