// BYOK chat client for the AI coach.
//
// Privacy contract: provider API keys live ONLY in this browser
// (localStorage). Every completion sends the key in request headers for
// that single call; the backend never stores or logs it.
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const LS_PROVIDER = 'builtdiff:llm:provider'
const LS_KEYS = 'builtdiff:llm:keys'
const LS_MODELS = 'builtdiff:llm:models'

const FALLBACK_PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini', models: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'], default: 'gemini-3.8-flash', keyUrl: 'https://aistudio.google.com/apikey', note: 'Free tier — if 3.8 is busy, drop to a lite model' },
  { id: 'groq', label: 'Groq', models: ['llama-3.1-8b-instant', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b'], default: 'llama-3.1-8b-instant', keyUrl: 'https://console.groq.com/keys', note: 'Free tier, very fast inference' },
  { id: 'openrouter', label: 'OpenRouter', models: ['meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free'], default: 'meta-llama/llama-3.3-70b-instruct:free', keyUrl: 'https://openrouter.ai/keys', note: 'Free :free-suffixed models', anyModel: true },
]

// Sanitize a saved model against the (rotating) provider catalog:
// unknown/retired names fall back to the provider default.
export function resolveModel(providers, providerId, saved) {
  const cfg = (providers ?? []).find((p) => p.id === providerId)
  if (!cfg) return ''
  if (cfg.anyModel) return (saved || '').trim() || cfg.default
  return cfg.models.includes(saved) ? saved : cfg.default
}

const readJSON = (k, fb) => {
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? 'null')
    return v && typeof v === 'object' ? v : fb
  } catch { return fb }
}

export async function getProviders() {
  try {
    const r = await fetch(`${API}/api/chat/providers`)
    if (r.ok) {
      const data = await r.json()
      if (Array.isArray(data.providers) && data.providers.length) return data.providers
    }
  } catch { /* backend down — fall back to baked list */ }
  return FALLBACK_PROVIDERS
}

export function getSettings() {
  const provider = localStorage.getItem(LS_PROVIDER) || ''
  return { provider, keys: readJSON(LS_KEYS, {}), models: readJSON(LS_MODELS, {}) }
}

export function saveProvider(provider) {
  try { localStorage.setItem(LS_PROVIDER, provider) } catch {}
}

export function saveKey(provider, key) {
  const keys = readJSON(LS_KEYS, {})
  if (key) keys[provider] = key
  else delete keys[provider]
  try { localStorage.setItem(LS_KEYS, JSON.stringify(keys)) } catch {}
}

export function saveModel(provider, model) {
  const models = readJSON(LS_MODELS, {})
  if (model) models[provider] = model
  else delete models[provider]
  try { localStorage.setItem(LS_MODELS, JSON.stringify(models)) } catch {}
}

// Map a failed completion into { action, message }.
// action: check_key | switch_provider | retry | reconnect | fix_input
export function actionFor(status, detail) {
  const d = String(detail || '')
  const code = d.split('—')[0].trim()
  switch (code) {
    case 'MISSING_KEY':
    case 'INVALID_KEY':
      return { action: 'check_key', message: d }
    case 'RATE_LIMITED':
    case 'SLOW_DOWN':
    case 'NO_CREDITS':
      return { action: 'switch_provider', message: d }
    case 'PROVIDER_UNREACHABLE':
      return { action: 'reconnect', message: d }
    case 'PROVIDER_ERROR':
      return { action: 'switch_provider', message: d }
    case 'UNKNOWN_PROVIDER':
    case 'BAD_MODEL':
      return { action: 'fix_input', message: d }
    default:
      if (status === 429) return { action: 'switch_provider', message: d || 'Rate limited — wait or switch provider.' }
      if (status === 401) return { action: 'check_key', message: d || 'Key rejected — check it in settings.' }
      return { action: 'retry', message: d || 'Coach hiccup — retry.' }
  }
}

export async function askAI({ system, messages, maxTokens = 512 } = {}) {
  const { provider, keys, models } = getSettings()
  const key = (keys[provider] || '').trim()
  if (!provider || !key) {
    const e = new Error('MISSING_KEY — add your own free API key in the coach settings (keys stay in your browser only).')
    e.action = 'check_key'
    throw e
  }
  let res
  try {
    res = await fetch(`${API}/api/chat/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LLM-Provider': provider,
        'X-LLM-Key': key,
      },
      body: JSON.stringify({
        model: models[provider] || '',
        messages: (messages ?? []).slice(-12),
        system: system ?? '',
        max_tokens: maxTokens,
      }),
    })
  } catch {
    const e = new Error('PROVIDER_UNREACHABLE — could not reach the DiffPush server. Check connection and retry.')
    e.action = 'reconnect'
    throw e
  }
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json()).detail || '' } catch { detail = await res.text().catch(() => '') }
    const { action, message } = actionFor(res.status, detail)
    const e = new Error(message)
    e.action = action
    e.status = res.status
    throw e
  }
  const data = await res.json()
  return { reply: data.reply, provider: data.provider, model: data.model }
}

// System prompt grounding the model as a DSA mentor for one problem.
export function buildMentorSystem({ title, tags, hints, optimalTime, optimalSpace, language } = {}) {
  const lines = [
    'You are Diff Mentor, a crisp DSA coach inside the DiffPush tracker.',
    'Rules: never reveal full solutions — give intuition, invariants, and Socratic nudges.',
    'Keep replies under 120 words, plain text, no heavy markdown.',
  ]
  if (title) lines.push(`Problem: ${title}.`)
  if (tags?.length) lines.push(`Tags: ${tags.slice(0, 4).join(', ')}.`)
  if (hints?.length) lines.push(`Known hint: ${hints[0]}.`)
  if (optimalTime || optimalSpace) lines.push(`Target: ${optimalTime ?? '?'} time, ${optimalSpace ?? '?'} space.`)
  if (language && language !== 'python') lines.push(`Student codes in ${language}.`)
  return lines.join('\n')
}
