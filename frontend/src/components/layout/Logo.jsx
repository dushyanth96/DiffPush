import React from 'react'

// The DiffPush mark: logo image + wordmark closed by an emerald square —
// the green square every solve plants.
export function Logo({ textClass = 'text-[17px]' }) {
  return (
    <span className="flex items-center gap-1.5 shrink-0" aria-label="DiffPush">
      <img src="/logo.png" alt="" aria-hidden="true" className="w-6 h-6 rounded-md" />
      <span className={`font-bold tracking-tight text-slate-100 leading-none ${textClass}`}>
        Diff<span className="text-diff-emerald">Push</span>
      </span>
      <span className="ml-[2px] inline-block w-1.5 h-1.5 bg-emerald-500" aria-hidden="true" />
    </span>
  )
}
