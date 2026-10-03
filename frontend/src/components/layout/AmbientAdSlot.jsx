import React, { useEffect, useRef, useState } from 'react'
import { MONDIAD_VERTICAL_BANNER_ID, MONDIAD_DASHBOARD_BANNER_ID, MONDIAD_SIDEBAR_BANNER_ID, AD_FILL_TIMEOUT_MS, rescanMondiadSlots } from '../../data/ads.js'
import { MONDIAD_TAG_URL, AADS_TAG_URL, HOUSE_PROMO, loadAdTag } from '../../data/ads.js'
import { loadDeals, pickDeal } from '../../data/deals.js'

// Three-stage ad adapter shared by every slot:
//   mondiad (live tag) → aads (house tag) → static house promo.
// Each stage gets one shot with a hard timeout; any failure collapses to the
// next stage. The frame box is always reserved (contain:layout) so a network
// failure never causes layout shift.

function useAdStage() {
  const [stage, setStage] = useState('house')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (MONDIAD_TAG_URL) {
        // Mondiad renders into #mondiad-slot when its tag loads.
        const el = document.getElementById('mondiad-slot')
        if (el && (await loadAdTag({ url: MONDIAD_TAG_URL, slotEl: el, renderedSelector: '[data-mondiad-rendered]' }))) {
          if (!cancelled) setStage('mondiad')
          return
        }
      }
      if (AADS_TAG_URL) {
        const el = document.getElementById('aads-slot')
        if (el && (await loadAdTag({ url: AADS_TAG_URL, slotEl: el, renderedSelector: '[data-aads-rendered]' }))) {
          if (!cancelled) setStage('aads')
          return
        }
      }
      if (!cancelled) setStage('house')
    })()
    return () => { cancelled = true }
  }, [])
  return stage
}

// Live deal for fallback slots: resolves once from the cached sheet feed.
// Safe inside the crash-safe frames — the tag never touches our promo nodes,
// so async content swaps here can't break reconciliation.
function useDeal(category) {
  const [deal, setDeal] = useState(null)
  useEffect(() => {
    let cancelled = false
    loadDeals()
      .then((items) => { if (!cancelled) setDeal(pickDeal(items, category)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [category])
  return deal
}

// Sleek obsidian affiliate card: tag pill, title, 1-line description,
// direct EarnKaro button. Matches the dark theme; never collapses — if the
// feed is unreachable pickDeal falls back to the hardcoded combo1.
function DealCard({ deal, className = '', vertical = false }) {
  if (vertical) {
    return (
      <a href={deal.earnkaro_link} target="_blank" rel="noopener sponsored" className={`flex flex-col items-center justify-center text-center gap-1.5 h-full overflow-y-auto px-1 py-1 ${className}`} title={deal.title}>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-diff-amber border border-diff-amber/30 rounded px-1 py-px shrink-0">
          [{deal.tag}]
        </span>
        <span className="text-[12px] font-bold text-slate-100 leading-snug break-words">
          {deal.title}
        </span>
        <span className="font-mono text-[11px] text-diff-emerald shrink-0">
          View Deal on Flipkart ↗
        </span>
      </a>
    )
  }
  return (
    <a href={deal.earnkaro_link} target="_blank" rel="noopener sponsored" className={className} title={deal.title}>
      <div className="min-w-0 flex flex-col items-center text-center gap-1 my-auto max-h-full overflow-y-auto">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-diff-amber border border-diff-amber/30 rounded px-1 py-px shrink-0">
          [{deal.tag}]
        </span>
        <p className="text-[13px] font-semibold text-slate-200 leading-snug break-words truncate sm:whitespace-normal">{deal.title}</p>
        <p className="hidden sm:block text-[12px] text-slate-500 leading-snug break-words">{deal.description}</p>
      </div>
      <div className="font-mono text-[11px] text-diff-emerald shrink-0 my-auto">View Deal on Flipkart ↗</div>
    </a>
  )
}

function HousePromo({ className = '', vertical = false, category = '' }) {
  const deal = useDeal(category)
  if (deal) return <DealCard deal={deal} className={className} vertical={vertical} />
  return (
    <a
      href={HOUSE_PROMO.url}
      target="_blank"
      rel="sponsored noreferrer"
      className={className}
    >
      {vertical ? (
        <span className="flex flex-col items-center justify-center text-center gap-1.5 h-full overflow-y-auto px-1 py-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">
            Sponsored
          </span>
          <span className="text-[12px] font-bold text-slate-100 leading-snug break-words">
            {HOUSE_PROMO.title}
          </span>
          <span className="font-mono text-[11px] text-diff-emerald shrink-0">
            {HOUSE_PROMO.cta}
          </span>
        </span>
      ) : (
        <>
          <div className="flex flex-col items-center text-center gap-1 my-auto">
            <p className="text-[13px] font-semibold text-slate-200 leading-snug break-words">{HOUSE_PROMO.title}</p>
            <p className="text-[12px] text-slate-500 leading-snug break-words">{HOUSE_PROMO.body}</p>
          </div>
          <div className="font-mono text-[11px] text-diff-emerald shrink-0 my-auto">{HOUSE_PROMO.cta}</div>
        </>
      )}
    </a>
  )
}

// Zero-CLS sponsor slot: the outer frame always reserves exact space
// (300x250 desktop, 320x50 mobile) with contain:layout — live or fallback.
// pass fitHeight to let the frame take a 70/30 parent split instead.
export function AmbientAdSlot({ fitHeight = false }) {
  const frameRef = useRef(null)
  const stage = useAdStage()

  return (
    <div className={`card p-3 ${fitHeight ? 'h-full min-h-0 flex flex-col' : ''}`}>
      <p className={`eyebrow ${fitHeight ? 'mb-1.5 shrink-0' : 'mb-2'}`}>PARTNER PICKS</p>
      <div
        ref={frameRef}
        className={`mx-auto overflow-hidden rounded-md bg-raised hairline w-full ${fitHeight
          ? 'flex-1 min-h-[60px] max-h-[250px] sm:max-w-[300px]'
          : 'h-[50px] max-w-[320px] sm:h-[250px] sm:max-w-[300px]'}`}
        style={{ contain: 'layout' }}
        aria-label="Partner picks"
      >
        {stage === 'mondiad' && <div id="mondiad-slot" className="w-full h-full" />}
        {stage === 'aads' && <div id="aads-slot" className="w-full h-full" />}
        {stage === 'house' && (
          <>
            <HousePromo className="hidden sm:flex flex-col justify-between p-3 h-full" />
            <HousePromo className="flex sm:hidden items-center justify-center h-full px-3 gap-2" />
          </>
        )}
      </div>
    </div>
  )
}

// Queues a Mondiad tag rescan now that this slot's div is in the DOM.
// Every data-mndbanid slot calls this on mount (the rescan itself fires
// at most once per page load — see rescanMondiadSlots).
function useMondiadRescan() {
  useEffect(() => {
    const t = setTimeout(rescanMondiadSlots, 0)
    return () => clearTimeout(t)
  }, [])
}

// Polls the ad frame for an injected creative. The ref sits on the FRAME,
// not the slot div: banner.js mutates/removes div[data-mndbanid] behind
// React's back, so that node must never be reconciled (conditionally
// unmounting it throws removeChild NotFoundError and blanks the page).
// Detection is content-based, not tag-based: anything the tag renders
// counts — real creatives (iframe/img/ins/video/canvas), demo-mode testing
// placeholders (plain elements/text), or a replacement node the tag swaps
// in beside our own. Our own nodes are marked (data-mndbanid / data-house)
// so a foreign node is unambiguous signal. Note: `a` is excluded from the
// creative selector — our always-mounted fallback promo contains a link.
function useMondiadFill(frameRef) {
  // null = checking, true = network creative live, false = house fallback
  const [live, setLive] = useState(null)
  useEffect(() => {
    let cancelled = false
    let poll = 0
    let giveUp = 0
    const isFilled = () => {
      try {
        const f = frameRef.current
        if (!f) return false
        if (f.querySelector('iframe, img, ins, video, canvas')) return true
        const slot = f.querySelector('div[data-mndbanid]')
        if (slot && (slot.childElementCount > 0 || slot.innerHTML.trim())) return true
        for (const child of f.children) {
          if (!child.hasAttribute('data-mndbanid') && !child.hasAttribute('data-house')) return true
        }
        return false
      } catch { return false }
    }
    const stop = () => { clearInterval(poll); clearTimeout(giveUp) }
    if (isFilled()) { setLive(true); return }
    poll = setInterval(() => {
      if (cancelled) return
      if (isFilled()) { stop(); if (!cancelled) setLive(true) }
    }, 500)
    giveUp = setTimeout(() => {
      stop()
      if (!cancelled) setLive((v) => (v === true ? v : false))
    }, AD_FILL_TIMEOUT_MS)
    // Maintenance watch: a true latched on tag residue (empty wrapper,
    // tracking pixel) that later disappears must fall back instead of
    // sticking on a blank frame. Real creatives stay visible, so they
    // are unaffected. Class toggles only — reconciliation-safe.
    const watch = setInterval(() => {
      if (cancelled) return
      try {
        const f = frameRef.current
        if (f && !isFilled()) setLive((v) => (v === true ? false : v))
      } catch {}
    }, 2000)
    return () => { cancelled = true; stop(); clearInterval(watch) }
  }, [frameRef])
  return live
}

// Vertical banner for the collapsed coach rail (160x600 class). Serves the
// Mondiad AI-chat banner slot: head-loaded banner.js fills div[data-mndbanid].
// Crash-safe by construction: after initial mount React only toggles
// classNames inside the frame — it never inserts/removes nodes there, so the
// tag tearing down the slot node can't break reconciliation (that used to
// throw removeChild NotFoundError and blank the page). The wrapper reserves
// min-height so neither outcome shifts layout.
export function VerticalAdSlot() {
  const frameRef = useRef(null)
  const live = useMondiadFill(frameRef)
  useMondiadRescan()

  return (
    <div className="card p-2 w-full h-full min-h-0 flex flex-col" style={{ contain: 'layout' }} aria-label="Partner picks">
      <p className="eyebrow text-center mb-1.5 shrink-0">PARTNER PICKS</p>
      <div ref={frameRef} className="flex-1 min-h-[140px] rounded-md bg-raised hairline overflow-hidden flex flex-col items-center justify-between gap-3 py-4">
        <div data-mndbanid={MONDIAD_VERTICAL_BANNER_ID} className={`w-full h-full min-h-[120px]${live === true ? '' : ' hidden'}`} />
        <div data-house="1" className={live === true ? 'hidden' : 'contents'}>
          <HousePromo vertical category="productivity" />
        </div>
      </div>
    </div>
  )
}

// In-feed Mondiad leaderboard for the dashboard curriculum list.
// Serves MONDIAD_DASHBOARD_BANNER_ID: head-loaded banner.js fills
// div[data-mndbanid]. Same crash-safe contract as VerticalAdSlot — the slot
// div mounts once and is never reconciled; the fallback promo is always
// mounted and only toggled via className. Fixed frame, zero layout shift.
export function DashboardBannerSlot() {
  const frameRef = useRef(null)
  const live = useMondiadFill(frameRef)
  useMondiadRescan()

  return (
    <div
      ref={frameRef}
      className="mx-auto overflow-hidden rounded-md bg-surface hairline h-[50px] w-full max-w-[320px] sm:h-[90px] sm:max-w-[728px] my-1"
      style={{ contain: 'layout' }}
      aria-label="Partner picks"
    >
      <div data-mndbanid={MONDIAD_DASHBOARD_BANNER_ID} className={`w-full h-full flex items-center justify-center${live === true ? '' : ' hidden'}`} />
      <div data-house="1" className={live === true ? 'hidden' : 'contents'}>
        <HousePromo category="productivity" className="hidden sm:flex items-center justify-center gap-3 h-full px-4" />
        <HousePromo category="productivity" className="flex sm:hidden items-center justify-center h-full px-3 gap-2" />
      </div>
    </div>
  )
}

// Sidebar Mondiad banner for the dashboard command-center rail.
// Serves MONDIAD_SIDEBAR_BANNER_ID: head-loaded banner.js fills
// div[data-mndbanid]. Same frame as AmbientAdSlot (300x250 desktop,
// 320x50 mobile, contain:layout) and same crash-safe contract — the slot div
// mounts once and is never reconciled; the fallback promo is always mounted
// and only toggled via className.
export function SidebarBannerSlot() {
  const frameRef = useRef(null)
  const live = useMondiadFill(frameRef)
  useMondiadRescan()

  return (
    <div className="card p-3">
      <p className="eyebrow mb-2">PARTNER PICKS</p>
      <div
        ref={frameRef}
        className="mx-auto overflow-hidden rounded-md bg-raised hairline w-full h-[50px] max-w-[320px] sm:h-[250px] sm:max-w-[300px]"
        style={{ contain: 'layout' }}
        aria-label="Partner picks"
      >
        <div data-mndbanid={MONDIAD_SIDEBAR_BANNER_ID} className={`w-full h-full${live === true ? '' : ' hidden'}`} />
        <div data-house="1" className={live === true ? 'hidden' : 'contents'}>
          <HousePromo category="desk" className="hidden sm:flex flex-col items-center justify-center text-center gap-1.5 p-3 h-full" />
          <HousePromo category="desk" className="flex sm:hidden items-center justify-center h-full px-3 gap-2" />
        </div>
      </div>
    </div>
  )
}

// Slim leaderboard variant for in-feed placement (728x90 desktop, 320x50 mobile).
// Same zero-CLS contract (contain:layout, fixed frame) and same 3-stage fallback.
export function SlimAdSlot() {
  const stage = useAdStage()
  return (
    <div
      className="mx-auto overflow-hidden rounded-md bg-surface hairline h-[50px] w-full max-w-[320px] sm:h-[90px] sm:max-w-[728px] my-1"
      style={{ contain: 'layout' }}
      aria-label="Partner picks"
    >
      {stage === 'mondiad' && <div id="mondiad-slot" className="w-full h-full" />}
      {stage === 'aads' && <div id="aads-slot" className="w-full h-full" />}
      {stage === 'house' && (
        <>
          <HousePromo className="hidden sm:flex items-center justify-center gap-3 h-full px-4" />
          <HousePromo className="flex sm:hidden items-center justify-center h-full px-3 gap-2" />
        </>
      )}
    </div>
  )
}
