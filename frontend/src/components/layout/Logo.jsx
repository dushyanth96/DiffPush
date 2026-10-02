import React from 'react'

// The BuiltDiff mark: wordmark closed by an emerald square —
// the green square every solve plants.
export function Logo({ textClass = 'text-[17px]' }) {
  return (
    <span className="flex items-baseline shrink-0" aria-label="BuiltDiff">
      <span className={`font-bold tracking-tight text-slate-100 leading-none ${textClass}`}>Builtdiff</span>
      <span className="ml-[4px] inline-block w-1.5 h-1.5 bg-emerald-500" aria-hidden="true" />
    </span>
  )
}
