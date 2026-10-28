import React, { useEffect } from 'react'
import { Github, UserRound, X } from 'lucide-react'

export function GuestPromptModal({ onClose, onSignIn }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-prompt-title"
      onClick={onClose}
    >
      <div className="card w-full max-w-md p-6 !bg-popover" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-raised hairline flex items-center justify-center text-diff-emerald shrink-0">
            <UserRound size={17} />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Guest session</p>
            <h2 id="guest-prompt-title" className="text-[15px] font-bold text-slate-100 mt-1">Continue as guest?</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close and continue as guest"
            className="ml-auto text-slate-500 hover:text-slate-200 shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-[13px] text-slate-400 mt-3 leading-relaxed">
          Progress is saved on this device. Sign in to auto-commit accepted solutions to GitHub and keep your grid in sync across devices.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={onClose} autoFocus className="btn-emerald w-full h-10 rounded-md text-[14px] font-semibold">
            Continue in guest mode
          </button>
          <button onClick={onSignIn} className="btn-ghost w-full h-10 rounded-md text-[13px] font-medium text-slate-200 inline-flex items-center justify-center gap-2">
            <Github size={15} /> Sign in with GitHub
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">You can connect GitHub anytime from the dashboard.</p>
      </div>
    </div>
  )
}
