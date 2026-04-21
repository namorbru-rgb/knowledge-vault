// Web Speech API Wrapper: kontinuierliche Spracherkennung + Sprachausgabe.
// Läuft komplett im Browser – keine Server-Infrastruktur nötig.

export function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function isVoiceSupported() {
  return !!getSpeechRecognition() && 'speechSynthesis' in window
}

// Kontinuierlicher Listener: liefert jede abgeschlossene Äusserung (`final`) via onUtterance.
// Dt. als Standardsprache.
export function createListener({ lang = 'de-DE', onUtterance, onInterim, onError, onEnd } = {}) {
  const Ctor = getSpeechRecognition()
  if (!Ctor) throw new Error('SpeechRecognition wird in diesem Browser nicht unterstützt.')

  const rec = new Ctor()
  rec.lang = lang
  rec.continuous = true
  rec.interimResults = true
  rec.maxAlternatives = 1

  let stopped = false
  let restarting = false

  rec.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const text = (result[0]?.transcript || '').trim()
      if (!text) continue
      if (result.isFinal) {
        onUtterance && onUtterance(text)
      } else {
        onInterim && onInterim(text)
      }
    }
  }

  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return
    onError && onError(e.error || 'Unbekannter Fehler')
  }

  rec.onend = () => {
    if (stopped) { onEnd && onEnd(); return }
    // Browser beenden die Erkennung nach einiger Zeit von selbst – automatisch neu starten.
    if (!restarting) {
      restarting = true
      setTimeout(() => { restarting = false; try { rec.start() } catch (_) {} }, 150)
    }
  }

  return {
    start() { stopped = false; try { rec.start() } catch (_) {} },
    stop()  { stopped = true; try { rec.stop() } catch (_) {} },
    abort() { stopped = true; try { rec.abort() } catch (_) {} },
  }
}

// TTS: spricht Text mit der besten verfügbaren Stimme für die Sprache.
let _voicesCache = null
function loadVoices() {
  if (_voicesCache) return _voicesCache
  _voicesCache = window.speechSynthesis.getVoices()
  return _voicesCache
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { _voicesCache = window.speechSynthesis.getVoices() }
}

function pickVoice(lang) {
  const voices = loadVoices()
  if (!voices || voices.length === 0) return null
  const exact = voices.find(v => v.lang?.toLowerCase() === lang.toLowerCase())
  if (exact) return exact
  const base = lang.split('-')[0].toLowerCase()
  return voices.find(v => v.lang?.toLowerCase().startsWith(base)) || null
}

export function speak(text, { lang = 'de-DE', rate = 1, pitch = 1, onEnd, onStart } = {}) {
  if (!('speechSynthesis' in window)) return null
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = lang
  utter.rate = rate
  utter.pitch = pitch
  const voice = pickVoice(lang)
  if (voice) utter.voice = voice
  if (onStart) utter.onstart = onStart
  if (onEnd) utter.onend = onEnd
  // Falls noch was läuft – abbrechen, damit Antworten nicht überlappen.
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
  return utter
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}
