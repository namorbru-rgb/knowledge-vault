import { changelog } from '../lib/changelog'

export default function ChangelogModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="bg-surface border border-line rounded-2xl w-full max-w-lg my-8 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line">
          <h2 className="text-lg sm:text-xl font-bold text-fg">Versionsverlauf</h2>
          <button onClick={onClose}
            className="text-muted hover:text-fg text-2xl leading-none px-2"
            aria-label="Schliessen">×</button>
        </div>
        <div className="p-4 sm:p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {changelog.map((entry, i) => {
            const version = `v${changelog.length - i}`
            return (
              <div key={i} className="border-l-2 border-blue-500/60 pl-4">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-600 text-white text-xs font-semibold tracking-tight">
                    {version}
                  </span>
                  <h3 className="font-semibold text-fg text-sm sm:text-base">{entry.title}</h3>
                  <span className="text-xs text-subtle">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {entry.changes.map((c, j) => (
                    <li key={j} className="text-sm text-fg flex gap-2">
                      <span className="text-blue-600 dark:text-blue-400 flex-shrink-0">•</span>
                      <span className="break-words">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
