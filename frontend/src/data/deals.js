// Live affiliate deals feed (Google Sheet via OpenSheet) for ad fallback slots.
// When Mondiad doesn't fill, slots render a curated student perk card from
// this feed instead of the static house promo. Memory + sessionStorage cache
// (6h TTL); any failure resolves to the hardcoded combo1 so slots never
// collapse or look broken.
const DEALS_URL = 'https://opensheet.elk.sh/1jTl7fTQ3xbdgbubisDoaE83dD1nB0YJ9TqlW0surtSk/flipkart_products'
const CACHE_KEY = 'builtdiff:deals:v1'
const TTL_MS = 6 * 3600 * 1000

// Hardcoded fallback: local copy of combo1 (always available offline).
export const FALLBACK_DEAL = {
  id: 'combo1',
  category: 'productivity',
  title: 'Self Help Bestseller Combo: Atomic Habits + Psychology of Money (Set of 2 Books)',
  tag: 'Focus Combo',
  description: 'Master habit-building and financial wisdom with this combo - essential mindset books for career and life success',
  store: 'Flipkart',
  earnkaro_link: 'https://fktr.in/dwiMOXH',
  is_active: 'TRUE',
}

let memCache = null // { at, items }
let inflight = null

function readSession() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items)) return null
    return parsed
  } catch { return null }
}

function writeSession(entry) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry)) } catch {}
}

function sanitize(items) {
  if (!Array.isArray(items)) return []
  return items.filter((d) => d
    && String(d.is_active ?? '').toUpperCase() === 'TRUE'
    && String(d.earnkaro_link ?? '').trim()
    && String(d.title ?? '').trim())
    .map((d) => ({
      id: String(d.id ?? ''),
      category: String(d.category ?? '').trim().toLowerCase(),
      title: String(d.title ?? '').trim(),
      tag: String(d.tag ?? '').trim() || 'Student Pick',
      description: String(d.description ?? '').trim(),
      store: String(d.store ?? '').trim() || 'Flipkart',
      earnkaro_link: String(d.earnkaro_link ?? '').trim(),
    }))
}

export async function loadDeals() {
  const now = Date.now()
  if (memCache && now - memCache.at < TTL_MS && memCache.items.length) return memCache.items
  const sess = readSession()
  if (sess && now - (sess.at ?? 0) < TTL_MS && (sess.items ?? []).length) {
    memCache = { at: sess.at, items: sess.items }
    return sess.items
  }
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch(DEALS_URL)
        if (!res.ok) throw new Error(`deals ${res.status}`)
        const items = sanitize(await res.json())
        if (!items.length) throw new Error('deals empty')
        memCache = { at: Date.now(), items }
        writeSession(memCache)
        return items
      } catch {
        return [FALLBACK_DEAL]
      } finally {
        inflight = null
      }
    })()
  }
  return inflight
}

// Random active deal, optionally restricted to a category ('productivity' |
// 'desk' | 'electronics'). Falls back to any category, then to combo1.
export function pickDeal(items, category) {
  const list = Array.isArray(items) ? items : []
  const cat = String(category ?? '').trim().toLowerCase()
  const pool = (cat && list.some((d) => d.category === cat))
    ? list.filter((d) => d.category === cat)
    : list
  if (!pool.length) return FALLBACK_DEAL
  return pool[Math.floor(Math.random() * pool.length)]
}
