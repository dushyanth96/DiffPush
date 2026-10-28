import { useEffect, useRef, useState } from 'react'
import {
  MONDIAD_VERTICAL_BANNER_ID, MONDIAD_DASHBOARD_BANNER_ID, MONDIAD_SIDEBAR_BANNER_ID,
  AD_FILL_TIMEOUT_MS, HYBRID_NETWORK_MS, HYBRID_HOUSE_MS,
  AADS_SQUARE_ID, AADS_INFEED_ID, AADS_RAIL_ID,
  isAdTest, isPresentMode, rescanMondiadSlots, rescanMondiadForPhase, HOUSE_PROMO,
} from '../../data/ads.js'
import { loadDeals, pickDeal } from '../../data/deals.js'

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

// AADS fixed-size units (embeds verified as provided). Static iframe HTML
// only — no document.write, no DOM mutation — so mounting/unmounting is
// always reconciliation-safe (only OUR OWN div is ever removed, and
// banner.js never touches it). Mounted only after Mondiad misses its window.
// `size` is the AADS size token AND the rendered pixel size ('300x250' or
// '160x600'). `capHeight` keeps the tall rail unit from blowing out shorter
// frames — excess clips gracefully at the bottom instead.
export function AadsUnit({ unitId = AADS_SQUARE_ID, size = '300x250', capHeight = false, className = '', hidden = false, onLoad } = {}) {
  const [w, h] = String(size).split('x').map(Number)
  return (
    <div data-aads style={{ width: `${w}px`, maxWidth: '100%', margin: 'auto', zIndex: 99998, maxHeight: capHeight ? '100%' : undefined, overflow: capHeight ? 'hidden' : undefined }} className={`${className}${hidden ? ' hidden' : ''}`}>
      <iframe
        data-aa={unitId}
        src={`https://ad.a-ads.com/${unitId}/?size=${size}`}
        style={{ border: 0, padding: 0, width: `${w}px`, maxWidth: '100%', height: `${h}px`, maxHeight: capHeight ? '100%' : undefined, overflow: 'hidden', display: 'block', margin: 'auto' }}
        title="Advertisement"
        onLoad={onLoad}
      />
    </div>
  )
}

// Hybrid slot engine. The house promo is the default paint; Mondiad is given
// the entire network window to render. The AADS iframe is mounted at the
// network→house boundary, and only when Mondiad never rendered, so AADS is
// never requested speculatively. A late Mondiad fill never reclaims a slot
// that has already fallen through to AADS.
//
// Options:
//   network={false} → in-house only, no paid requests at all.
//   mondiad={false} → AADS owns each network window (no Mondiad, no wait).
// Returns refs + visibility flags. Components only toggle classNames or
// mount/unmount OUR OWN AADS div — the Mondiad div mounts once and is never
// reconciled, so the tag tearing it down can't break React.
function useHybridSlot({ network = true, mondiad = true, networkMs = HYBRID_NETWORK_MS, houseMs = HYBRID_HOUSE_MS, mondiadId = '' } = {}) {
  const frameRef = useRef(null)
  const slotRef = useRef(null)
  const present = isPresentMode()
  const testMode = !present && isAdTest()
  const enabled = network && !present
  const phase = useHybridPhase(enabled, networkMs, houseMs)

  // 'house' until Mondiad proves it filled; 'aads' only after the deadline.
  const [source, setSource] = useState(testMode ? 'aads' : 'house')
  const [mondiadFilled, setMondiadFilled] = useState(false)
  const [aadsMounted, setAadsMounted] = useState(testMode)
  const [aadsLoaded, setAadsLoaded] = useState(false)
  const mondiadRef = useRef(false)
  const firstPhase = useRef(true)

  // Mondiad fill poll (zero timers/requests when Mondiad is disabled):
  // slot-div content, demo placeholders, or tag-swapped foreign nodes. Own
  // nodes are marked (data-mndbanid / data-house / data-aads); the AADS
  // iframe is excluded here (it has its own check). Fast cadence first, then
  // 2s maintenance that corrects both ways.
  useEffect(() => {
    if (!enabled || !mondiad || testMode) return undefined
    let cancelled = false
    const checkMondiad = () => {
      try {
        const f = frameRef.current
        if (!f) return false
        if (f.querySelector('iframe:not([data-aa]), img, ins, video, canvas')) return true
        const slot = f.querySelector('div[data-mndbanid]')
        if (slot && (slot.childElementCount > 0 || slot.innerHTML.trim())) return true
        for (const child of f.children) {
          if (child.hasAttribute('data-mndbanid') || child.hasAttribute('data-house') || child.hasAttribute('data-aads')) continue
          // banner.js strips data-mndbanid from its own (unfilled) div; an
          // empty unmarked div is NOT a creative. Only count foreign nodes
          // that actually carry content.
          if (child.childElementCount > 0 || child.textContent.trim()) return true
        }
        return false
      } catch { return false }
    }
    const tick = () => {
      if (cancelled) return
      const filled = checkMondiad()
      mondiadRef.current = filled
      setMondiadFilled(filled)
    }
    tick()
    let poll = setInterval(tick, 500)
    const slowDown = setTimeout(() => {
      if (cancelled) return
      clearInterval(poll)
      poll = setInterval(tick, 2000)
    }, AD_FILL_TIMEOUT_MS)
    return () => { cancelled = true; clearInterval(poll); clearTimeout(slowDown) }
  }, [enabled, mondiad, testMode])

  // banner.js either strips data-mndbanid or removes the node outright when
  // it cannot fill. Re-attach + re-tag OUR node at the start of every network
  // window so the next rescan can target it again. React never unmounts this
  // node, so imperative re-insertion is safe (and prevents a detached node
  // from blocking future Mondiad impressions).
  const restoreMondiadSlot = () => {
    try {
      const el = slotRef.current
      const frame = frameRef.current
      if (!el || !frame) return
      if (!el.isConnected) frame.prepend(el)
      if (mondiadId && el.getAttribute('data-mndbanid') !== mondiadId) el.setAttribute('data-mndbanid', mondiadId)
    } catch {}
  }

  // Rotation boundary. Entering a network window resets to the house default
  // and asks Mondiad for a fresh creative. Leaving it is the 60s deadline:
  // if Mondiad never rendered, the AADS iframe mounts now (first request);
  // otherwise the house promo simply takes its turn.
  useEffect(() => {
    if (!enabled) return
    if (phase === 'network') {
      setSource(testMode ? 'aads' : (mondiad ? 'house' : 'aads'))
      mondiadRef.current = false
      setMondiadFilled(false)
      setAadsMounted(testMode || !mondiad)
      setAadsLoaded(false)
      if (!testMode && mondiad) {
        restoreMondiadSlot()
        if (firstPhase.current) {
          firstPhase.current = false
          rescanMondiadSlots()
        } else {
          rescanMondiadForPhase()
        }
      }
    } else if (mondiad && !mondiadRef.current) {
      setSource('aads')
      setAadsMounted(true)
      setAadsLoaded(false)
    } else {
      setSource('house')
      setAadsMounted(false)
    }
  }, [phase, enabled, mondiad, testMode])

  // Mondiad priority inside its own window only. Once the slot has fallen
  // through to AADS a later fill is ignored (deterministic waterfall).
  useEffect(() => {
    if (!mondiad || testMode || phase !== 'network' || !mondiadFilled) return
    setSource('mondiad')
  }, [mondiad, testMode, phase, mondiadFilled])

  // AADS serving: iframe onLoad, or assume-served after 8s (bounded exposure).
  useEffect(() => {
    if (!aadsMounted || aadsLoaded) return undefined
    const t = setTimeout(() => setAadsLoaded(true), 8000)
    return () => clearTimeout(t)
  }, [aadsMounted, aadsLoaded])

  const showMondiad = mondiad && !testMode && phase === 'network' && source === 'mondiad' && mondiadFilled
  const showAads = aadsMounted && aadsLoaded && !showMondiad
  return {
    frameRef, slotRef, showMondiad, showAads, aadsMounted, showHouse: !showMondiad && !showAads,
    markAadsLoaded: () => setAadsLoaded(true),
  }
}

// Hybrid rotation: network ads own the slot for HYBRID_NETWORK_MS, then the
// in-house promo takes over for HYBRID_HOUSE_MS, then the cycle repeats.
// Returns the current phase ('network' | 'house'); disabled slots sit on
// 'house'. Phase flips only toggle classNames — reconciliation-safe.
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
// tag tearing down the slot node can't break reconciliation.
export function VerticalAdSlot({ network = true, mondiad = true, networkMs, houseMs } = {}) {
  const { frameRef, slotRef, showMondiad, showAads, aadsMounted, showHouse, markAadsLoaded } = useHybridSlot({ network, mondiad, networkMs, houseMs, mondiadId: MONDIAD_VERTICAL_BANNER_ID })

  return (
    <div data-ad className="card p-2 w-full h-full min-h-0 flex flex-col" style={{ contain: 'layout' }} aria-label="Partner picks">
      <p className="eyebrow text-center mb-1.5 shrink-0">PARTNER PICKS</p>
      <div ref={frameRef} className="flex-1 min-h-[140px] rounded-md bg-raised hairline overflow-hidden flex flex-col items-center justify-between gap-3 py-4">
        <div ref={slotRef} data-mndbanid={MONDIAD_VERTICAL_BANNER_ID} className={`w-full h-full min-h-[120px]${showMondiad ? '' : ' hidden'}`} />
        {aadsMounted ? (
          <AadsUnit unitId={AADS_RAIL_ID} size="160x600" capHeight onLoad={markAadsLoaded} hidden={!showAads} />
        ) : null}
        <div data-house="1" className={showHouse ? 'contents' : 'hidden'}>
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
  const { frameRef, slotRef, showMondiad, showAads, aadsMounted, showHouse, markAadsLoaded } = useHybridSlot({ network, mondiad, networkMs, houseMs, mondiadId: MONDIAD_DASHBOARD_BANNER_ID })

  return (
    <div
      ref={frameRef}
      data-ad
      className="mx-auto overflow-hidden rounded-md bg-surface hairline h-[50px] w-full max-w-[320px] sm:h-[90px] sm:max-w-[728px] my-1"
      style={{ contain: 'layout' }}
      aria-label="Partner picks"
    >
      <div ref={slotRef} data-mndbanid={MONDIAD_DASHBOARD_BANNER_ID} className={`w-full h-full flex items-center justify-center${showMondiad ? '' : ' hidden'}`} />
      {aadsMounted ? (
        <AadsUnit unitId={AADS_INFEED_ID} size="728x90" onLoad={markAadsLoaded} hidden={!showAads} className="w-full h-full flex items-center justify-center" />
      ) : null}
      <div data-house="1" className={showHouse ? 'contents' : 'hidden'}>
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
// network={false} for in-house-only placement.
export function SidebarBannerSlot({ network = true, mondiad = true, networkMs, houseMs } = {}) {
  const { frameRef, slotRef, showMondiad, showAads, aadsMounted, showHouse, markAadsLoaded } = useHybridSlot({ network, mondiad, networkMs, houseMs, mondiadId: MONDIAD_SIDEBAR_BANNER_ID })

  return (
    <div data-ad className="card p-3">
      <p className="eyebrow mb-2">PARTNER PICKS</p>
      <div
        ref={frameRef}
        className="mx-auto overflow-hidden rounded-md bg-raised hairline w-full h-[50px] max-w-[320px] sm:h-[250px] sm:max-w-[300px]"
        style={{ contain: 'layout' }}
        aria-label="Partner picks"
      >
        <div ref={slotRef} data-mndbanid={MONDIAD_SIDEBAR_BANNER_ID} className={`w-full h-full${showMondiad ? '' : ' hidden'}`} />
        {aadsMounted ? (
          <AadsUnit unitId={AADS_SQUARE_ID} onLoad={markAadsLoaded} hidden={!showAads} className="w-full h-full flex items-center justify-center" />
        ) : null}
        <div data-house="1" className={showHouse ? 'contents' : 'hidden'}>
          <HousePromo category="desk" className="hidden sm:flex flex-col items-center justify-center text-center gap-1.5 p-3 h-full" />
          <HousePromo category="desk" className="flex sm:hidden items-center justify-center h-full px-3 gap-2" />
        </div>
      </div>
    </div>
  )
}
