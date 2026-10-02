import React, { useEffect, useRef, useState } from 'react'
import { MONDIAD_VERTICAL_BANNER_ID, AD_FILL_TIMEOUT_MS } from '../../data/ads.js'
import { MONDIAD_TAG_URL, AADS_TAG_URL, HOUSE_PROMO, loadAdTag } from '../../data/ads.js'

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

function HousePromo({ className = '', vertical = false }) {
  return (
    <a
      href={HOUSE_PROMO.url}
      target="_blank"
      rel="sponsored noreferrer"
      className={className}
    >
      {vertical ? (
        <>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600" style={{ writingMode: 'vertical-rl' }}>
            Sponsored
          </span>
          <span className="text-[13px] font-bold text-slate-100 leading-snug" style={{ writingMode: 'vertical-rl' }}>
            {HOUSE_PROMO.title}
          </span>
          <span className="font-mono text-[11px] text-diff-emerald shrink-0" style={{ writingMode: 'vertical-rl' }}>
            {HOUSE_PROMO.cta}
          </span>
        </>
      ) : (
        <>
          <div>
            <p className="text-[13px] font-semibold text-slate-200 leading-snug">{HOUSE_PROMO.title}</p>
            <p className="text-[12px] text-slate-500 mt-1 leading-snug">{HOUSE_PROMO.body}</p>
          </div>
          <div className="font-mono text-[11px] text-diff-emerald">{HOUSE_PROMO.cta}</div>
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
      <p className={`eyebrow ${fitHeight ? 'mb-1.5 shrink-0' : 'mb-2'}`}>PARTNER SPONSOR</p>
      <div
        ref={frameRef}
        className={`mx-auto overflow-hidden rounded-md bg-raised hairline w-full ${fitHeight
          ? 'flex-1 min-h-[60px] max-h-[250px] sm:max-w-[300px]'
          : 'h-[50px] max-w-[320px] sm:h-[250px] sm:max-w-[300px]'}`}
        style={{ contain: 'layout' }}
        aria-label="Sponsor"
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

// Vertical banner for the collapsed coach rail (160x600 class). Serves the
// Mondiad AI-chat banner slot: head-loaded banner.js fills div[data-mndbanid].
// Fallback-safe: polls for an injected creative; if the slot stays empty
// (blocked, timed out, no fill), swaps to the static house promo instead.
// The wrapper reserves min-height so neither outcome shifts layout.
export function VerticalAdSlot() {
  // null = checking, true = network creative live, false = house fallback
  const [live, setLive] = useState(null)
  const slotRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let poll = 0
    let giveUp = 0
    const node = () => slotRef.current
    const isFilled = () => {
      try {
        const n = node()
        return !!n && n.querySelector('iframe, img, ins, a, video, canvas') !== null
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
    return () => { cancelled = true; stop() }
  }, [])

  return (
    <div className="card p-2 w-full h-full min-h-0 flex flex-col" style={{ contain: 'layout' }} aria-label="Sponsor">
      <p className="eyebrow text-center mb-1.5 shrink-0">PARTNER</p>
      <div className="flex-1 min-h-[140px] rounded-md bg-raised hairline overflow-hidden flex flex-col items-center justify-between gap-3 py-4">
        {live === false
          ? <HousePromo vertical />
          : <div ref={slotRef} data-mndbanid={MONDIAD_VERTICAL_BANNER_ID} className="w-full h-full min-h-[120px]" />}
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
      aria-label="Sponsor"
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
