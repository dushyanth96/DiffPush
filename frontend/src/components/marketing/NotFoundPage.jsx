import React from 'react'
import { useNoIndex } from '../../hooks/useNoIndex.js'
import { navigate } from '../../data/route.js'

// Unknown paths render this instead of silently falling back to the hub, so
// stale/typo'd links are honest about the miss.
export function NotFoundPage() {
  useNoIndex()
  return (
    <div className="min-h-screen bg-canvas text-slate-200 flex flex-col">
      <header className="h-16 px-4 sm:px-5 flex items-center border-b border-border max-w-[1100px] w-full mx-auto">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/') }} className="font-mono text-[14px] font-bold tracking-tight">
          diff<span className="text-diff-emerald">push</span>
        </a>
      </header>
      <main className="flex-1 w-full max-w-[640px] mx-auto px-4 py-20">
        <p className="font-mono text-[11px] tracking-wider text-diff-emerald">ERROR 404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-100">This page never compiled.</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-slate-400">
          The URL doesn't match a problem, room, or dashboard. It may have been mistyped, or the link is from an older version of DiffPush.
        </p>
        <div className="mt-7 flex flex-wrap gap-2">
          <button onClick={() => navigate('/')} className="btn-emerald px-4 h-10 rounded-md text-[13px] font-semibold">
            Go home
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-ghost px-4 h-10 rounded-md text-[13px] font-medium text-slate-200">
            Open dashboard
          </button>
        </div>
      </main>
    </div>
  )
}
