import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { FALLBACK_DEAL, loadDeals, pickDeal } from '../../data/deals.js'

// One mobile-only sticky placement, 60px tall, outside the document flow so it
// can never push content or cover the workspace action bar (editor routes do
// not mount it at all). Dismissal is remembered for the browser session.
export function MobileStickyAd({ onDismiss }) {
  const [deal, setDeal] = useState(FALLBACK_DEAL)

  useEffect(() => {
    let cancelled = false
    loadDeals()
      .then((items) => { if (!cancelled) setDeal(pickDeal(items, 'productivity')) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <aside
      data-ad
      aria-label="Sponsored deal"
      className="lg:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface"
      style={{ height: 60 }}
    >
      <div className="h-full flex items-center gap-1.5 pl-2.5 pr-1">
        <a
          href={deal.earnkaro_link}
          target="_blank"
          rel="noopener sponsored"
          className="min-w-0 flex-1 flex items-center gap-2"
          title={deal.title}
        >
          <span className="shrink-0 max-w-[86px] truncate font-mono text-[9px] uppercase tracking-[0.12em] text-diff-amber border border-diff-amber/30 rounded px-1 py-px">
            {deal.tag}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-medium text-slate-200 leading-tight">{deal.title}</span>
            <span className="block font-mono text-[10px] text-diff-emerald leading-tight">
              View deal on {deal.store} →
            </span>
          </span>
        </a>
        <button
          onClick={onDismiss}
          aria-label="Dismiss sponsored banner"
          className="shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-raised"
        >
          <X size={15} />
        </button>
      </div>
    </aside>
  )
}
