// Path-based routing (replaces the legacy #/ hash scheme — no `#` in URLs).
// Centralizes parsing + navigation so every link and redirect stays consistent.

export function navigate(to, { replace = false } = {}) {
  const url = typeof to === 'string' ? to : '/'
  if (replace) window.history.replaceState({}, '', url)
  else window.history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// One-time migration for old bookmarks/shared links (#/solve/x → /solve/x).
// Runs before first parse; uses replaceState so no extra history entry.
export function migrateLegacyHash() {
  try {
    const h = window.location.hash || ''
    const m = h.match(/^#(\/(?:solve|room|review|u|dashboard|auth)(?:\/[\w\-./?=%&]*)?)$|^#\/$/)
    if (!m) return
    const path = m[1] ?? '/'
    window.history.replaceState({}, '', path)
    window.location.hash = ''
  } catch {}
}

export function parseRoute() {
  // OAuth landing takes precedence: GitHub redirects the popup to
  // /auth/callback?code=… (fragments are stripped per OAuth 2.0 RFC).
  const path = window.location.pathname || '/'
  if (path === '/auth/callback') return { name: 'callback' }
  // Public dashboard: renders for everyone (logged-out devices included) so
  // ad units are discoverable without login.
  if (path === '/dashboard') return { name: 'dashboard' }
  // Public ad-verification page: all AADS units statically mounted for
  // network crawlers (no auth, no waterfall delay, no rotation).
  if (path === '/ads-verify') return { name: 'ads-verify' }
  const um = path.match(/^\/u\/([\w-]+)\/?$/)
  if (um) return { name: 'user', username: um[1] }
  const arena = path.match(/^\/room\/([\w-]+)\/arena\/?$/)
  if (arena) return { name: 'arena', code: arena[1] }
  if (path === '/room' || path === '/room/') return { name: 'rooms' }
  const rm = path.match(/^\/room\/([\w-]+)\/?$/)
  if (rm) return { name: 'room', code: rm[1], query: window.location.search ?? '' }
  if (path === '/review' || path === '/review/') return { name: 'review' }
  const m = path.match(/^\/solve\/([\w-]+)\/?$/)
  return m ? { name: 'solve', slug: m[1] } : { name: 'hub' }
}
