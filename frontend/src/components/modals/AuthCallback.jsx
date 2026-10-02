import React, { useEffect, useState } from 'react'

// Lands at /auth/callback?code=… (path-based: GitHub strips # fragments,
// so the hash route can never receive the OAuth code).
// Forwards the code to the opener, then closes. Programmatic close() can be
// blocked (popup-as-tab, strict browser settings), so after a grace period we
// render a real button — close() from a user gesture always works.
export function AuthCallback() {
  const [state, setState] = useState({ phase: 'working', error: null })

  useEffect(() => {
    const fromSearch = new URLSearchParams(window.location.search).get('code')
    const hash = window.location.hash || ''
    const fromHash = new URLSearchParams(hash.split('?')[1] ?? '').get('code')
    const error = new URLSearchParams(window.location.search).get('error')
    const code = fromSearch ?? fromHash
    if (error || !code) {
      setState({ phase: 'failed', error: error ?? 'No authorization code returned' })
      return
    }
    const msg = { type: 'builtdiff:oauth-code', code }
    if (window.opener) {
      window.opener.postMessage(msg, window.location.origin)
    } else {
      // Full-tab navigation (not a popup): hand the code to this window's
      // own listener if present, then return to the app.
      window.postMessage(msg, window.location.origin)
      setTimeout(() => { window.location.pathname = '/' }, 800)
      return
    }

    const tryClose = () => {
      if (window.opener && !window.closed) {
        try { window.close() } catch {}
      }
    }
    tryClose()
    const t1 = setTimeout(tryClose, 400)
    // Still here after 1.5s → close() was blocked; hand control to the user.
    const t2 = setTimeout(() => setState({ phase: 'done', error: null }), 1500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className="pt-16 max-w-md mx-auto px-4 py-10">
      <div className="card p-8 text-center">
        {state.phase === 'working' && (
          <p className="font-mono text-[13px] text-slate-500">Finishing GitHub sign-in…</p>
        )}
        {state.phase === 'done' && (
          <>
            <p className="text-[14px] font-semibold text-diff-emerald">Signed in — back to BuiltDiff</p>
            <p className="text-[12px] text-slate-500 mt-1">This window didn't close itself.</p>
            <button onClick={() => window.close()} className="btn-emerald mt-4 px-5 h-10 rounded-md text-[14px] font-semibold">
              Close this window
            </button>
          </>
        )}
        {state.phase === 'failed' && (
          <>
            <p className="text-[14px] font-semibold text-diff-rose">Sign-in failed</p>
            <p className="font-mono text-[12px] text-slate-500 mt-1">{state.error}</p>
            <button onClick={() => window.close()} className="btn-ghost mt-4 px-5 h-10 rounded-md text-[13px] text-slate-200">
              Close this window
            </button>
          </>
        )}
      </div>
    </div>
  )
}
