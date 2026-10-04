// Ad network adapter — Mondiad primary, aads fallback, house promo last resort.
// All three stages share the same zero-CLS frame contract (contain:layout,
// fixed dimensions) so a network failure never shifts layout.
//
// Stage 1: Mondiad live tag (set MONDIAD_TAG_URL once the account approves).
// Stage 2: aads house tag (set AADS_TAG_URL; same script-tag pattern).
// Stage 3: static house promo (always works, zero network).
//
// Guardrails: no popunders, no autoplay, sponsored links rel="sponsored
// noreferrer", and every slot reserves its exact box before any network call.

export const MONDIAD_TAG_URL = ''
export const AADS_TAG_URL = ''

// Mondiad banner delivery (head-loaded via index.html):
// banner.js scans for divs carrying a data-mndbanid slot id and fills them.
// The vertical id serves the AI-chat rail slot; the dashboard id serves the
// in-feed leaderboard slot between curriculum banners.
export const MONDIAD_BANNER_JS = 'https://ss.mrmnd.com/banner.js'
export const MONDIAD_VERTICAL_BANNER_ID = '06d8e32a-a0cc-4d2e-a9c5-21b383311e1d'
export const MONDIAD_DASHBOARD_BANNER_ID = '6d706f7b-8c76-402a-8784-1042f90102d4'
export const MONDIAD_SIDEBAR_BANNER_ID = 'bb4e890f-5d15-408f-aea7-353fa89ee5b8'

// AADS adaptive units, one per placement (embeds verified as provided).
// Served as the middle waterfall stage: Mondiad → AADS → house.
export const AADS_SQUARE_ID = '2457407' // sidebar / IDE / arena square (Adaptive)
export const AADS_INFEED_ID = '2457409' // dashboard leaderboard (Adaptive)
export const AADS_RAIL_ID = '2457410' // coach rail (fixed 160x600)
// How long Mondiad gets the slot alone per network phase before AADS mounts.
export const AADS_DELAY_MS = 4000

// How long to wait for a network creative before falling back, per attempt.
export const AD_FILL_TIMEOUT_MS = 3000

// Hybrid rotation cadence: paid network ads show for NETWORK_MS, then the
// in-house (EarnKaro/static) promo takes over for HOUSE_MS, then a fresh
// network impression is requested. 60s/60s balances impression volume
// against viewability and network refresh policies (most tags want >=30s
// between refreshes; higher frequency risks fill penalties).
export const HYBRID_NETWORK_MS = 60000
export const HYBRID_HOUSE_MS = 60000

// Re-triggers the head-loaded Mondiad tag so it picks up slot divs that
// mounted after its initial scan. banner.js scans for div[data-mndbanid]
// once at load and does not observe later DOM mutations, so React-rendered
// slots (which mount after the tag runs) are never filled without this.
// Dashboard slots mount in waves (sidebar immediately, in-feed after the
// manifest fetch), so besides the immediate first scan every mount also
// (re)schedules a trailing scan that picks up later waves. Bounded: at most
// 3 tag executions per page load, scans at least 4s apart. Safe to call
// from every slot on mount.
let mondiadRescans = 0
let lastMondiadRescan = 0
let mondiadRescanTimer = 0

function fireMondiadRescan() {
  mondiadRescans += 1
  lastMondiadRescan = Date.now()
  const script = document.createElement('script')
  script.src = MONDIAD_BANNER_JS
  script.async = true
  script.dataset.mndRescan = String(mondiadRescans)
  document.head.appendChild(script)
}

export function rescanMondiadSlots({ force = false } = {}) {
  try {
    if (!force && mondiadRescans >= 3) return
    if (!force && !(mondiadRescans === 0 || Date.now() - lastMondiadRescan >= 4000)) return
    if (!document.querySelector('div[data-mndbanid]')) return
    fireMondiadRescan()
    if (force) return // rotation-driven: no trailing scan, next cycle rescans
    clearTimeout(mondiadRescanTimer)
    mondiadRescanTimer = setTimeout(() => {
      try {
        if (mondiadRescans >= 3) return
        if (Date.now() - lastMondiadRescan < 4000) return
        if (!document.querySelector('div[data-mndbanid]')) return
        fireMondiadRescan()
      } catch {}
    }, 4500)
  } catch {}
}

export const HOUSE_PROMO = {
  title: 'Deploy Serverless Redis',
  body: 'Get $100 in cloud credits for your side projects.',
  cta: '→ Claim credits',
  url: 'https://example.com/partner-redis',
}

// Which stage is active for this page load. Resolved once, synchronously,
// so the first paint never depends on a network round-trip.
export function adStage() {
  if (MONDIAD_TAG_URL) return 'mondiad'
  if (AADS_TAG_URL) return 'aads'
  return 'house'
}

// Injects a network tag script. Resolves true only when the network signals
// a rendered creative inside the slot; any failure resolves false and the
// caller keeps the static frame. Never rejects, never throws.
export function loadAdTag({ url, slotEl, timeoutMs = 1500, renderedSelector = '[data-ad-rendered]' }) {
  return new Promise((resolve) => {
    if (!url || !slotEl) { resolve(false); return }
    let settled = false
    const done = (ok) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { script.remove() } catch {}
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), timeoutMs)
    const script = document.createElement('script')
    script.src = url
    script.async = true
    script.onload = () => {
      try { done(Boolean(slotEl.querySelector(renderedSelector))) }
      catch { done(false) }
    }
    script.onerror = () => done(false)
    document.head.appendChild(script)
  })
}
