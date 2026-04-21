// Minimaler Claude-API-Client für den Browser.
// API-Key liegt lokal im localStorage – kein Server nötig (passt zu GitHub Pages).

const KEY_STORAGE = 'kv_anthropic_key'
const MODEL_STORAGE = 'kv_claude_model'
const DEFAULT_MODEL = 'claude-sonnet-4-6'

export function getApiKey() {
  try { return localStorage.getItem(KEY_STORAGE) || '' } catch { return '' }
}
export function setApiKey(key) {
  try { localStorage.setItem(KEY_STORAGE, key || '') } catch {}
}
export function getModel() {
  try { return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL } catch { return DEFAULT_MODEL }
}
export function setModel(model) {
  try { localStorage.setItem(MODEL_STORAGE, model || DEFAULT_MODEL) } catch {}
}

// messages: [{ role: 'user' | 'assistant', content: string }]
export async function chat(messages, { system, maxTokens = 1024, signal } = {}) {
  const key = getApiKey()
  if (!key) throw new Error('Kein Anthropic-API-Key hinterlegt (Einstellungen → Sprach-Assistent).')

  const body = {
    model: getModel(),
    max_tokens: maxTokens,
    messages,
  }
  if (system) body.system = system

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Claude-API Fehler ${res.status}: ${err || res.statusText}`)
  }
  const data = await res.json()
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
  return text
}
