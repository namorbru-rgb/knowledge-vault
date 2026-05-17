// Versionsverlauf: neueste Einträge zuerst.
// Die Versionsnummer (v1, v2, …) wird automatisch aus der Reihenfolge
// abgeleitet — neue Einträge einfach oben anfügen, dann zählt die App
// die Version hoch.
export const changelog = [
  {
    date: '2026-05-17',
    title: 'Frisches Design & Hellmodus',
    changes: [
      'Komplett überarbeiteter Look mit Inter-Schrift, feineren Rundungen und sanften Schatten',
      'Neuer Hellmodus — Umschalter unten in der Seitenleiste (bzw. oben rechts auf dem Handy)',
      'Theme-Wahl wird gespeichert; folgt zu Beginn der System-Einstellung',
      'Status- und Akzentfarben passen sich jetzt an Hell/Dunkel an',
    ],
  },
  {
    date: '2026-05-17',
    title: 'Versionsverlauf, Mobile-Fixes & Auto-Retry',
    changes: [
      'Versionsverlauf rechts oben auf der Übersicht',
      'Video-Detailansicht bricht auf dem iPhone nicht mehr aus',
      'Fehlgeschlagene Transkriptionen werden automatisch bis zu 3× wiederholt',
      'Facebook-Share-Links (facebook.com/share/…) werden vor dem Download aufgelöst',
      'Optionaler Cookie-Support für yt-dlp (Reels & private FB-Videos)',
    ],
  },
  {
    date: '2026-05-17',
    title: 'Familien-Login',
    changes: [
      'Kein manueller Login mehr — App meldet sich automatisch mit dem Familienkonto an',
    ],
  },
  {
    date: '2026-04-21',
    title: 'Sprach-Chat mit Paperclip',
    changes: [
      'Neue Seite /voice mit Web Speech API + Claude',
      'Kontinuierliche Spracherkennung, optionales Wake-Word "Paperclip"',
      'Antworten werden laut vorgelesen',
    ],
  },
]
