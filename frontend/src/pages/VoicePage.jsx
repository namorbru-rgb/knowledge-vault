import { useEffect, useRef, useState } from 'react'
import { createListener, isVoiceSupported, speak, stopSpeaking } from '../lib/voice'
import { chat, getApiKey } from '../lib/claude'

const SYSTEM_PROMPT = `Du bist Paperclip, ein persönlicher Sprach-Assistent des Nutzers.
Du führst ein natürliches, freundliches Gespräch auf Deutsch.
Halte Antworten kurz und gesprochen-klingend (1–3 Sätze), weil sie vorgelesen werden.
Keine Markdown-Formatierung, keine Aufzählungszeichen, keine Emojis.`

const WAKE_WORDS = ['paperclip', 'paperclipp', 'paper clip', 'peperclip']

export default function VoicePage() {
  const [supported] = useState(() => isVoiceSupported())
  const [active, setActive] = useState(false)
  const [requireWake, setRequireWake] = useState(false)
  const [interim, setInterim] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hasKey, setHasKey] = useState(() => !!getApiKey())
  const [messages, setMessages] = useState([]) // [{ role, content, ts }]

  const listenerRef = useRef(null)
  const busyRef = useRef(false)
  const messagesRef = useRef([])
  const requireWakeRef = useRef(false)
  const bottomRef = useRef(null)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { requireWakeRef.current = requireWake }, [requireWake])
  useEffect(() => { busyRef.current = busy }, [busy])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, interim])

  useEffect(() => {
    return () => {
      listenerRef.current?.abort()
      stopSpeaking()
    }
  }, [])

  function extractAfterWake(text) {
    const lower = text.toLowerCase()
    for (const w of WAKE_WORDS) {
      const idx = lower.indexOf(w)
      if (idx !== -1) return text.slice(idx + w.length).replace(/^[\s,.!?:;-]+/, '').trim()
    }
    return null
  }

  async function handleUtterance(rawText) {
    const text = rawText.trim()
    if (!text) return
    // Nichts senden, solange die Antwort läuft – Mikro fängt sonst sich selbst auf.
    if (busyRef.current) return

    let prompt = text
    if (requireWakeRef.current) {
      const extracted = extractAfterWake(text)
      if (!extracted) return // ignorieren, kein Wake-Word
      prompt = extracted
      if (!prompt) return
    }

    setInterim('')
    const userMsg = { role: 'user', content: prompt, ts: Date.now() }
    const nextHistory = [...messagesRef.current, userMsg]
    setMessages(nextHistory)
    setBusy(true)
    setError('')

    try {
      const apiMessages = nextHistory.map(m => ({ role: m.role, content: m.content }))
      const reply = await chat(apiMessages, { system: SYSTEM_PROMPT, maxTokens: 400 })
      const botMsg = { role: 'assistant', content: reply, ts: Date.now() }
      setMessages(prev => [...prev, botMsg])
      speak(reply, {
        lang: 'de-DE',
        onEnd: () => { setBusy(false) },
      })
    } catch (err) {
      setError(err.message || 'Fehler bei der Anfrage.')
      setBusy(false)
    }
  }

  function startCall() {
    setError('')
    if (!getApiKey()) {
      setError('Bitte zuerst in den Einstellungen einen Anthropic-API-Key hinterlegen.')
      return
    }
    try {
      const listener = createListener({
        lang: 'de-DE',
        onUtterance: handleUtterance,
        onInterim: (t) => setInterim(t),
        onError: (e) => setError('Mikrofon-Fehler: ' + e),
      })
      listenerRef.current = listener
      listener.start()
      setActive(true)
    } catch (err) {
      setError(err.message)
    }
  }

  function endCall() {
    listenerRef.current?.abort()
    listenerRef.current = null
    stopSpeaking()
    setActive(false)
    setInterim('')
    setBusy(false)
  }

  function clearChat() {
    setMessages([])
    setInterim('')
    setError('')
  }

  if (!supported) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-4">Sprach-Assistent</h2>
        <div className="bg-red-900/30 border border-red-700/50 text-red-200 rounded-xl p-4">
          Dein Browser unterstützt die Web Speech API leider nicht.
          Getestet funktioniert es aktuell am besten in Chrome/Edge (Desktop und Android).
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto flex flex-col min-h-[calc(100dvh-3.5rem)] md:min-h-[100dvh]">
      <header className="mb-4 sm:mb-6">
        <h2 className="text-2xl font-bold text-white">Sprach-Assistent</h2>
        <p className="text-sm text-slate-400 mt-1">
          Drücke auf „Anruf starten" und sprich einfach drauflos – Paperclip antwortet mit Stimme.
        </p>
      </header>

      {!hasKey && (
        <div className="bg-amber-900/30 border border-amber-700/50 text-amber-200 rounded-xl p-3 mb-4 text-sm">
          Kein Anthropic-API-Key gesetzt. Trage ihn in <strong>Einstellungen</strong> ein, damit der Assistent antworten kann.
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center mb-4">
        {!active ? (
          <button
            onClick={startCall}
            className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full font-semibold flex items-center gap-2"
          >
            <span className="inline-block w-3 h-3 bg-white rounded-full" />
            Anruf starten
          </button>
        ) : (
          <button
            onClick={endCall}
            className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-semibold flex items-center gap-2"
          >
            <span className="inline-block w-3 h-3 bg-white rounded-sm" />
            Auflegen
          </button>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
          <input
            type="checkbox"
            checked={requireWake}
            onChange={e => setRequireWake(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          Nur auf „Paperclip…" reagieren
        </label>

        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="ml-auto text-sm text-slate-400 hover:text-white"
          >
            Verlauf löschen
          </button>
        )}
      </div>

      {active && (
        <div className="mb-3 text-xs text-slate-400 flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${busy ? 'bg-amber-400' : 'bg-green-500 animate-pulse'}`} />
          {busy ? 'Paperclip antwortet…' : 'Mikrofon aktiv – ich höre zu.'}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-200 rounded-xl p-3 mb-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4 overflow-y-auto space-y-3">
        {messages.length === 0 && !interim && (
          <p className="text-slate-500 text-sm text-center py-8">
            Noch keine Unterhaltung. Starte den Anruf und stelle deine erste Frage.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-slate-700 text-slate-100 rounded-bl-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {interim && (
          <div className="flex justify-end">
            <div className="max-w-[85%] px-4 py-2 rounded-2xl rounded-br-sm text-sm italic text-blue-200 bg-blue-600/30 border border-blue-600/40">
              {interim}…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <p className="text-xs text-slate-500 mt-3">
        Spracherkennung & -ausgabe laufen direkt im Browser (Web Speech API). Die Anfragen selbst gehen
        mit deinem eigenen Anthropic-Key an die Claude-API.
      </p>

      {/* Hack: Re-check hasKey bei jeder Navigation hierher */}
      <HasKeyProbe onChange={setHasKey} />
    </div>
  )
}

function HasKeyProbe({ onChange }) {
  useEffect(() => {
    const id = setInterval(() => onChange(!!getApiKey()), 1500)
    return () => clearInterval(id)
  }, [onChange])
  return null
}
