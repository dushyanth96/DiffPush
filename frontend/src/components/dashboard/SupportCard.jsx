import React from 'react'
import { Coffee, HeartHandshake } from 'lucide-react'
import { SUPPORT_LINKS } from '../../data/support.js'

// Sidebar support card: lives at the bottom of the rail, below utility cards.
// Ghost-style buttons (no brand-color blocks) to respect the obsidian system.
export function SupportCard() {
  return (
    <div className="card p-4">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
        <HeartHandshake size={12} className="text-diff-rose" /> Fuel the grind
      </h3>
      <p className="mt-1.5 text-[12px] text-slate-500 leading-snug">Free forever. Server bills aren't.</p>
      <div className="mt-2.5">
        <a
          href={SUPPORT_LINKS.chai}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost w-full flex items-center gap-2 px-3 h-9 rounded-md text-[13px] text-slate-200"
          title="For India — pay via UPI"
        >
          <Coffee size={14} className="text-orange-400" /> Buy me a Chai <span className="ml-auto font-mono text-[10px] text-slate-500">UPI</span>
        </a>
      </div>
    </div>
  )
}
