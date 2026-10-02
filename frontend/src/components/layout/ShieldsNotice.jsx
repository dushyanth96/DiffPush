import React, { useEffect, useState } from 'react'
import { ShieldOff, X } from 'lucide-react'
import { MONDIAD_TAG_URL, AADS_TAG_URL } from '../../data/ads.js'

const SESSION_KEY = 'builtdiff:shields-dismissed'

// Shows only when ad networks are configured but unreachable (Brave Shields,
// ad blocker, edu/corporate wifi). Dismissible once per session.
export function ShieldsNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only relevant if at least one network is configured
    if (!MONDIAD_TAG_URL && !AADS_TAG_URL) return
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return
    } catch {}
    // Give the ad slots their full timeout window before concluding "blocked"
    const t = setTimeout(() => setVisible(true), 4000)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
    setVisible(false)
  }

  return (
    <div className="fixed bottom-3 left-3 z-50 max-w-[300px] card !bg-popover p-3 shadow-xl" role="status">
      <div className="flex items-start gap-2">
        <ShieldOff size={14} className="text-diff-amber shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-slate-200">Ads keep BuiltDiff free</p>
          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
            Ad blockers or restricted networks (Brave Shields, edu/corporate wifi) prevent our sponsor ads
            from loading. Allow ads on this site to support the platform — everything else works either way.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-raised transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
