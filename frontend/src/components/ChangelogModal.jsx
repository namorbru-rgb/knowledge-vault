import { changelog } from '../lib/changelog'

export default function ChangelogModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg my-8 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-700">
          <h2 className="text-lg sm:text-xl font-bold text-white">Versionsverlauf</h2>
          <button onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none px-2"
            aria-label="Schliessen">×</button>
        </div>
        <div className="p-4 sm:p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {changelog.map((entry, i) => (
            <div key={i} className="border-l-2 border-blue-500/60 pl-4">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="font-semibold text-white text-sm sm:text-base">{entry.title}</h3>
                <span className="text-xs text-slate-500">{new Date(entry.date).toLocaleDateString('de-DE')}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {entry.changes.map((c, j) => (
                  <li key={j} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-blue-400 flex-shrink-0">•</span>
                    <span className="break-words">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
