const paths = {
  home: ['m3 10 9-7 9 7', 'M5 9v12h14V9', 'M9 21v-8h6v8'],
  knowledge: ['M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z', 'M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h3z'],
  health: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z', 'M4 12h4l2-4 4 8 2-4h4'],
  documents: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M8 13h8M8 17h5'],
  family: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M16 3a4 4 0 0 1 0 8', 'M22 21v-2a4 4 0 0 0-3-3.9'],
  videos: ['M3 5h13v14H3z', 'm16 10 5-3v10l-5-3'],
  links: ['M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2', 'M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2'],
  photos: ['M3 3h18v18H3z', 'm3 17 6-6 4 4 3-3 5 5'],
  notes: ['M12 3H4v18h16v-8', 'm10 14 1-4L19 2l3 3-8 8z'],
  search: ['m21 21-5-5'],
  voice: ['M9 3a3 3 0 0 1 6 0v9a3 3 0 0 1-6 0z', 'M5 10v2a7 7 0 0 0 14 0v-2', 'M12 19v3M8 22h8'],
  settings: ['M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1'],
  arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
  moon: ['M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z'],
  sun: ['M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5'],
}
export default function HubIcon({ name, className = '' }) {
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {(paths[name] || paths.home).map((d, i) => <path d={d} key={i} />)}
    {name === 'family' && <circle cx="9" cy="7" r="4" />}
    {name === 'search' && <circle cx="10.5" cy="10.5" r="6.5" />}
    {['settings', 'sun'].includes(name) && <circle cx="12" cy="12" r="4" />}
    {name === 'photos' && <circle cx="8" cy="7" r="1" />}
  </svg>
}
