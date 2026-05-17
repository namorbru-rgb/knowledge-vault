// Versionsverlauf: neueste Einträge zuerst.
// Neue Einträge bei jeder spürbaren Änderung oben anfügen.
export const changelog = [
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
