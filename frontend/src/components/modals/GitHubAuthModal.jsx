import React, { useState } from 'react'
import { Github, KeyRound, X } from 'lucide-react'

export function GitHubAuthModal({ github, onClose }) {
  const [pat, setPat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [retried, setRetried] = useState(false)

  const retryStored = async () => {
    setBusy(true)
    setError(null)
    try {
      await github.retry()
      setRetried(true)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const oauth = async () => {
    setBusy(true)
    setError(null)
    try {
      const url = await github.loginUrl()
      const popup = window.open(url, 'builtdiff-oauth', 'width=600,height=700,popup=1')
      if (!popup) throw new Error('Popup blocked — allow popups or use a PAT below.')
      // Exchange happens via redirect back to /auth/callback which postMessages the code.
      let gotCode = false
      const onMsg = async (e) => {
        if (e.origin !== window.location.origin || e.data?.type !== 'builtdiff:oauth-code') return
        gotCode = true
        window.removeEventListener('message', onMsg)
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/auth/github/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: e.data.code }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.detail ?? 'Exchange failed')
          await github.connect(data.access_token)
          onClose()
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy(false)
        }
      }
      window.addEventListener('message', onMsg)
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer)
          window.removeEventListener('message', onMsg)
          setBusy(false)
          if (!gotCode) setError('Popup closed before finishing — allow popups for this site, then try again.')
        }
      }, 500)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const usePat = async () => {
    const t = pat.trim()
    if (!t) return
    setBusy(true)
    setError(null)
    try {
      await github.connect(t)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-label="Connect GitHub">
      <div className="card w-full max-w-md p-6 !bg-popover" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Github size={18} className="text-slate-100" />
          <h2 className="text-[15px] font-bold text-slate-100">Connect GitHub</h2>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-200"><X size={16} /></button>
        </div>
        <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">
          Solves auto-commit to <span className="font-mono text-slate-200">your/builtdiff-solutions</span> — real green squares, plus cross-device sync via <span className="font-mono text-slate-200">.builtdiff/tracker.json</span>.
        </p>
        <button onClick={oauth} disabled={busy} className="btn-emerald w-full mt-4 h-10 rounded-md text-[14px] font-semibold disabled:opacity-60">
          {busy ? 'Waiting for GitHub…' : 'Authorize with GitHub'}
        </button>
        {error && (
          <>
            <p className="mt-2 text-[12px] text-diff-rose">{error}</p>
            {github.token && !retried && (
              <button onClick={retryStored} disabled={busy} className="btn-ghost w-full mt-2 h-9 rounded-md text-[13px] text-slate-200 disabled:opacity-50">
                Retry with stored token (no new popup)
              </button>
            )}
          </>
        )}
        <div className="flex items-center gap-2 my-4">
          <span className="flex-1 h-px bg-border" /><span className="text-[11px] text-slate-500">or paste a fine-grained PAT</span><span className="flex-1 h-px bg-border" />
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1 flex items-center gap-1.5 bg-surface hairline rounded-md h-10 px-3">
            <KeyRound size={14} className="text-slate-600 shrink-0" />
            <input
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              type="password"
              placeholder="github_pat_…"
              className="w-full bg-transparent outline-none font-mono text-[12px] text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <button onClick={usePat} disabled={busy || !pat.trim()} className="btn-ghost px-4 h-10 rounded-md text-[13px] font-medium text-slate-200 disabled:opacity-50">
            Save
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Your token never leaves this browser except to talk to GitHub through your own backend. Revoke anytime.</p>
      </div>
    </div>
  )
}
