import React from 'react'
import { AadsUnit } from '../layout/AmbientAdSlot.jsx'
import { AADS_SQUARE_ID, AADS_RAIL_ID, AADS_INFEED_ID } from '../../data/ads.js'

// Public ad-verification page for networks (AADS bot checks only the exact
// URL registered per unit — crawlers can't log in, so dashboard/IDE slots
// are invisible to them). Renders every AADS unit statically mounted with
// zero auth, zero waterfall delay, zero rotation: deterministic on first
// paint. One URL covers all units.
export function AdsVerifyPage() {
  return (
    <div className="min-h-screen bg-canvas text-slate-200">
      <div className="max-w-[960px] mx-auto px-4 py-8">
        <p className="font-mono text-[11px] tracking-wider text-diff-emerald">DIFFPUSH · AD VERIFICATION</p>
        <h1 className="mt-1 text-[20px] font-bold text-slate-100">Active ad placements</h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Each unit below is live on this exact page. <a href="/" className="text-diff-emerald hover:underline">← Back to DiffPush</a>
        </p>

        <h2 className="mt-8 text-[14px] font-semibold text-slate-200">Leaderboard · in-feed (dashboard)</h2>
        <div className="mt-2 mx-auto overflow-hidden rounded-md bg-surface hairline w-full max-w-[728px] min-h-[90px] flex items-center justify-center" style={{ contain: 'layout' }}>
          <AadsUnit unitId={AADS_INFEED_ID} size="728x90" />
        </div>

        <h2 className="mt-8 text-[14px] font-semibold text-slate-200">Square · sidebar / IDE</h2>
        <div className="mt-2 mx-auto overflow-hidden rounded-md bg-raised hairline w-full max-w-[300px] min-h-[250px] flex items-center justify-center" style={{ contain: 'layout' }}>
          <AadsUnit unitId={AADS_SQUARE_ID} size="300x250" />
        </div>

        <h2 className="mt-8 text-[14px] font-semibold text-slate-200">Skyscraper · coach rail</h2>
        <div className="mt-2 mx-auto overflow-hidden rounded-md bg-raised hairline w-fit max-w-full flex items-start justify-center" style={{ contain: 'layout' }}>
          <AadsUnit unitId={AADS_RAIL_ID} size="160x600" capHeight={false} />
        </div>
      </div>
    </div>
  )
}
