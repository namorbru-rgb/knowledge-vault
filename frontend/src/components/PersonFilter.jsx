// Filter-Chips zum Eingrenzen einer Liste auf eine Person.
// value = null  → "Alle"
// value = 'none' → nur Einträge ohne Person
// value = uuid  → nur Einträge dieser Person

export default function PersonFilter({ persons, value, onChange }) {
  if (!persons || persons.length === 0) return null
  const chip = (active) =>
    `px-3 py-1 rounded-full text-xs border transition-colors ${
      active
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-surface text-muted border-line hover:bg-elevated hover:text-fg'
    }`
  return (
    <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
      <button className={chip(!value)} onClick={() => onChange(null)}>👥 Alle</button>
      {persons.map(p => (
        <button key={p.id} className={chip(value === p.id)} onClick={() => onChange(p.id)}>
          <span className="mr-1">{p.emoji || '👤'}</span>{p.name}
        </button>
      ))}
      <button className={chip(value === 'none')} onClick={() => onChange('none')}>Ohne</button>
    </div>
  )
}

export function PersonBadge({ person }) {
  if (!person) return null
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-elevated text-muted border border-line">
      <span>{person.emoji || '👤'}</span>{person.name}
    </span>
  )
}
