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
// This id is assigned to the AI-chat vertical banner slot only.
export const MONDIAD_BANNER_JS = 'https://ss.mrmnd.com/banner.js'
export const MONDIAD_VERTICAL_BANNER_ID = '06d8e32a-a0cc-4d2e-a9c5-21b383311e1d'

// How long to wait for a network creative before falling back, per attempt.
export const AD_FILL_TIMEOUT_MS = 3000

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
