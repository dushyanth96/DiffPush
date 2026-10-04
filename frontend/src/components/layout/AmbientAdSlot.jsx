import React, { useEffect, useRef, useState } from 'react'
import { MONDIAD_VERTICAL_BANNER_ID, MONDIAD_DASHBOARD_BANNER_ID, MONDIAD_SIDEBAR_BANNER_ID, AD_FILL_TIMEOUT_MS, HYBRID_NETWORK_MS, HYBRID_HOUSE_MS, AADS_SQUARE_ID, AADS_INFEED_ID, AADS_RAIL_ID, AADS_DELAY_MS, isAdTest, rescanMondiadSlots } from '../../data/ads.js'
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
    if (isAdTest()) return undefined // ad-test mode: AADS only, zero Mondiad traffic
    const t = setTimeout(rescanMondiadSlots, 0)
    return () => clearTimeout(t)
  }, [])
}

// AADS units (embeds verified as provided). Static iframe HTML only — no
// document.write, no DOM mutation — so mounting/unmounting is always
// reconciliation-safe (only OUR OWN div is ever removed, and banner.js never
// touches it). Served as the middle waterfall stage: Mondiad → AADS → house.
// `adaptive` = fluid unit (sidebar / in-feed); `skyscraper` = fixed 160x600
// for the coach rail, capped to the frame so short viewports clip gracefully.
export function AadsUnit({ unitId = AADS_SQUARE_ID, layout = 'adaptive', className = '', hidden = false, onLoad } = {}) {
  if (layout === 'skyscraper') {
    return (
      <div data-aads style={{ width: '160px', maxWidth: '100%', margin: 'auto', zIndex: 99998, maxHeight: '100%', overflow: 'hidden' }} className={`${className}${hidden ? ' hidden' : ''}`}>
        <iframe
          data-aa={unitId}
          src={`https://ad.a-ads.com/${unitId}/?size=160x600&background_color=131A26&title_color=E6EAF2&title_hover_color=10B981&text_color=94A3B8&link_color=10B981&link_hover_color=34D399`}
          style={{ border: 0, padding: 0, width: '160px', maxWidth: '100%', height: '600px', maxHeight: '100%', overflow: 'hidden', display: 'block', margin: 'auto' }}
          title="Advertisement"
          onLoad={onLoad}
        />
      </div>
    )
  }
  return (
    <div data-aads style={{ width: '100%', margin: 'auto', position: 'relative', zIndex: 99998 }} className={`${className}${hidden ? ' hidden' : ''}`}>
      <iframe
        data-aa={unitId}
        src={`https://acceptable.a-ads.com/${unitId}/?size=Adaptive&background_color=131A26&title_color=E6EAF2&title_hover_color=10B981&text_color=94A3B8&link_color=10B981&link_hover_color=34D399`}
        style={{ border: 0, padding: 0, width: '70%', height: 'auto', overflow: 'hidden', display: 'block', margin: 'auto' }}
        title="Advertisement"
        onLoad={onLoad}
      />
    </div>
  )
}

// Hybrid slot engine: waterfall Mondiad → AADS → in-house, rotating on the
// network/house cadence (defaults HYBRID_NETWORK_MS / HYBRID_HOUSE_MS).
// Options:
//   network={false} → in-house only, no paid requests at all (normal IDE).
//   mondiad={false} → AADS-only network stages, never Mondiad (normal IDE
//     hybrid: mostly in-house with occasional AADS; pair with a short
//     networkMs / long houseMs for house-heavy rotation).
// Returns refs + visibility flags; components only ever toggle classNames or
// mount/unmount OUR OWN AADS div — the Mondiad div mounts once and is never
// reconciled, so the tag tearing it down can't break React.
function useHybridSlot({ network = true, mondiad = true, networkMs = HYBRID_NETWORK_MS, houseMs = HYBRID_HOUSE_MS } = {}) {
  const frameRef = useRef(null)
  const [mondiadFilled, setMondiadFilled] = useState(false)
  const [aadsLoaded, setAadsLoaded] = useState(false)
  // ?adtest=1 skips straight to AADS (deterministic verification, no timers).
  const [source, setSource] = useState(() => (isAdTest() ? 'aads' : 'mondiad')) // 'mondiad' | 'aads'
  const testMode = isAdTest()
  const phase = useHybridPhase(network, networkMs, houseMs)
  const mondiadRef = useRef(false)
  useEffect(() => { mondiadRef.current = mondiadFilled })

  useMondiadRescan()
  // Fresh paid impression at the start of every network phase (Mondiad only;
  // skipped in ad-test mode where AADS mounts immediately and deterministically).
  useEffect(() => {
    if (testMode) return undefined
    if (network && mondiad && phase === 'network') rescanMondiadSlots({ force: true })
  }, [network, mondiad, phase, testMode])
  // New network phase → back to first priority (Mondiad, AADS directly when
  // Mondiad is disabled for this placement, or in ad-test mode).
  useEffect(() => {
    if (phase === 'network') { setSource(testMode ? 'aads' : (mondiad ? 'mondiad' : 'aads')); setAadsLoaded(false) }
  }, [phase, mondiad, testMode])

  // Mondiad fill poll (skipped entirely when Mondiad is disabled for this
  // placement — zero requests, zero timers): slot-div content, demo
  // placeholders, or tag-swapped foreign nodes. Own nodes are marked
  // (data-mndbanid / data-house / data-aads); the AADS iframe is excluded
  // here (it has its own check). Fast cadence first, then 2s maintenance
  // that corrects both ways, so a slow-network fill always wins eventually
  // and teardowns fall back.
  useEffect(() => {
    if (!network || !mondiad || testMode) return undefined
    let cancelled = false
    const checkMondiad = () => {
      try {
        const f = frameRef.current
        if (!f) return false
        if (f.querySelector('iframe:not([data-aa]), img, ins, video, canvas')) return true
        const slot = f.querySelector('div[data-mndbanid]')
        if (slot && (slot.childElementCount > 0 || slot.innerHTML.trim())) return true
        for (const child of f.children) {
          if (!child.hasAttribute('data-mndbanid') && !child.hasAttribute('data-house') && !child.hasAttribute('data-aads')) return true
        }
        return false
      } catch { return false }
    }
    const tick = () => { if (!cancelled) setMondiadFilled(checkMondiad()) }
    tick()
    let poll = setInterval(tick, 500)
    const giveUp = setTimeout(() => {
      if (cancelled) return
      clearInterval(poll)
      poll = setInterval(tick, 2000)
    }, AD_FILL_TIMEOUT_MS)
    return () => { cancelled = true; clearInterval(poll); clearTimeout(giveUp) }
  }, [network, frameRef])

  // Waterfall: Mondiad gets AADS_DELAY_MS alone per network phase, then AADS
  // mounts if the slot div is still empty (skipped when Mondiad disabled —
  // AADS mounts immediately at phase start instead).
  useEffect(() => {
    if (!network || !mondiad || testMode || phase !== 'network' || source !== 'mondiad') return undefined
    const t = setTimeout(() => { if (!mondiadRef.current) setSource('aads') }, AADS_DELAY_MS)
    return () => clearTimeout(t)
  }, [network, mondiad, testMode, phase, source])
  // Mondiad priority: a late fill reclaims the slot even mid-AADS.
  useEffect(() => { if (mondiad && !testMode && mondiadFilled) setSource('mondiad') }, [mondiad, testMode, mondiadFilled])
  // AADS serving: iframe onLoad, or assume-served after 8s (bounded exposure —
  // the rotation rescues the slot, and AADS backfills near-100% anyway).
  useEffect(() => {
    if (!network || phase !== 'network' || source !== 'aads') return undefined
    const t = setTimeout(() => setAadsLoaded(true), 8000)
    return () => clearTimeout(t)
  }, [network, phase, source])

  const inNetwork = network && phase === 'network'
  const showMondiad = mondiad && inNetwork && source === 'mondiad' && mondiadFilled
  const aadsMounted = inNetwork && source === 'aads'
  const showAads = aadsMounted && aadsLoaded
  return {
    frameRef, showMondiad, showAads, aadsMounted,
    markAadsLoaded: () => setAadsLoaded(true),
  }
}

// Hybrid rotation: paid network ads own the slot for HYBRID_NETWORK_MS,
// then the in-house promo takes over for HYBRID_HOUSE_MS, then a fresh
// network impression is requested and the cycle repeats. Returns the
// current phase ('network' | 'house'); disabled slots sit on 'house'.
// Phase flips only toggle classNames — reconciliation-safe by construction.
function useHybridPhase(enabled, networkMs = HYBRID_NETWORK_MS, houseMs = HYBRID_HOUSE_MS) {
  const [phase, setPhase] = useState('network')
  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    let t1 = 0
    let t2 = 0
    const loop = () => {
      t1 = setTimeout(() => {
        if (cancelled) return
        setPhase('house')
        t2 = setTimeout(() => {
          if (cancelled) return
          setPhase('network')
          loop()
        }, houseMs)
      }, networkMs)
    }
    loop()
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2) }
  }, [enabled, networkMs, houseMs])
  return enabled ? phase : 'house'
}

// Vertical banner for the collapsed coach rail (160x600 class). Serves the
// Mondiad AI-chat banner slot: head-loaded banner.js fills div[data-mndbanid].
// Crash-safe by construction: after initial mount React only toggles
// classNames inside the frame — it never inserts/removes nodes there, so the
// tag tearing down the slot node can't break reconciliation (that used to
// throw removeChild NotFoundError and blank the page). The wrapper reserves
// min-height so neither outcome shifts layout.
// Pass network={false} for in-house-only placement (normal IDE).
export function VerticalAdSlot({ network = true, mondiad = true, networkMs, houseMs } = {}) {
  const { frameRef, showMondiad, showAads, aadsMounted, markAadsLoaded } = useHybridSlot({ network, mondiad, networkMs, houseMs })

  return (
    <div className="card p-2 w-full h-full min-h-0 flex flex-col" style={{ contain: 'layout' }} aria-label="Partner picks">
      <p className="eyebrow text-center mb-1.5 shrink-0">PARTNER PICKS</p>
      <div ref={frameRef} className="flex-1 min-h-[140px] rounded-md bg-raised hairline overflow-hidden flex flex-col items-center justify-between gap-3 py-4">
        <div data-mndbanid={MONDIAD_VERTICAL_BANNER_ID} className={`w-full h-full min-h-[120px]${showMondiad ? '' : ' hidden'}`} />
        {aadsMounted ? (
          <AadsUnit unitId={AADS_RAIL_ID} layout="skyscraper" onLoad={markAadsLoaded} hidden={!showAads} />
        ) : null}
        <div data-house="1" className={showMondiad || showAads ? 'hidden' : 'contents'}>
          <HousePromo vertical category="productivity" />
        </div>
      </div>
    </div>
  )
}

// In-feed Mondiad leaderboard for the dashboard curriculum list.
// Serves MONDIAD_DASHBOARD_BANNER_ID: head-loaded banner.js fills
// div[data-mndbanid]. Hybrid rotation by default (paid network 60s →
// in-house 60s); pass network={false} for in-house-only placement.
// Same crash-safe contract as VerticalAdSlot — the slot div mounts once
// and is never reconciled; the fallback promo is always mounted and only
// toggled via className. Fixed frame, zero layout shift.
export function DashboardBannerSlot({ network = true, mondiad = true, networkMs, houseMs } = {}) {
  const { frameRef, showMondiad, showAads, aadsMounted, markAadsLoaded } = useHybridSlot({ network, mondiad, networkMs, houseMs })

  return (
    <div
      ref={frameRef}
      className="mx-auto overflow-hidden rounded-md bg-surface hairline h-[50px] w-full max-w-[320px] sm:h-[90px] sm:max-w-[728px] my-1"
      style={{ contain: 'layout' }}
      aria-label="Partner picks"
    >
      <div data-mndbanid={MONDIAD_DASHBOARD_BANNER_ID} className={`w-full h-full flex items-center justify-center${showMondiad ? '' : ' hidden'}`} />
      {aadsMounted ? (
        <AadsUnit unitId={AADS_INFEED_ID} onLoad={markAadsLoaded} hidden={!showAads} className="w-full h-full flex items-center justify-center" />
      ) : null}
      <div data-house="1" className={showMondiad || showAads ? 'hidden' : 'contents'}>
        <HousePromo category="productivity" className="hidden sm:flex items-center justify-center gap-3 h-full px-4" />
        <HousePromo category="productivity" className="flex sm:hidden items-center justify-center h-full px-3 gap-2" />
      </div>
    </div>
  )
}

// Sidebar Mondiad banner for the dashboard command-center rail.
// Serves MONDIAD_SIDEBAR_BANNER_ID: head-loaded banner.js fills
// div[data-mndbanid]. Same frame as AmbientAdSlot (300x250 desktop,
// 320x50 mobile, contain:layout). Hybrid rotation by default; pass
// network={false} for in-house-only placement (normal IDE, arena rail).
export function SidebarBannerSlot({ network = true, mondiad = true, networkMs, houseMs } = {}) {
  const { frameRef, showMondiad, showAads, aadsMounted, markAadsLoaded } = useHybridSlot({ network, mondiad, networkMs, houseMs })

  return (
    <div className="card p-3">
      <p className="eyebrow mb-2">PARTNER PICKS</p>
      <div
        ref={frameRef}
        className="mx-auto overflow-hidden rounded-md bg-raised hairline w-full h-[50px] max-w-[320px] sm:h-[250px] sm:max-w-[300px]"
        style={{ contain: 'layout' }}
        aria-label="Partner picks"
      >
        <div data-mndbanid={MONDIAD_SIDEBAR_BANNER_ID} className={`w-full h-full${showMondiad ? '' : ' hidden'}`} />
        {aadsMounted ? (
          <AadsUnit unitId={AADS_SQUARE_ID} onLoad={markAadsLoaded} hidden={!showAads} className="w-full h-full flex items-center justify-center" />
        ) : null}
        <div data-house="1" className={showMondiad || showAads ? 'hidden' : 'contents'}>
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
