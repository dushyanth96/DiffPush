import React, { useEffect, useState } from 'react'
import { zc } from '../../zerocost.js'

export function ZerocostAd({ placementId = 'inline', className = '' }) {
  const [ad, setAd] = useState(null)

  useEffect(() => {
    let cancelled = false
    zc.ads.requestAd(placementId)
      .then((a) => {
        if (cancelled || !a) return
        setAd(a)
        zc.track.impression(a.id, placementId).catch(() => {})
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [placementId])

  if (!ad) return null

  const onClick = async () => {
    try { await zc.track.click(ad.id, placementId) } catch {}
    if (ad.landing_url) window.open(ad.landing_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className={`rounded-md border border-white/8 bg-surface/60 px-3 py-2 flex items-center gap-3 ${className}`}
      role="complementary"
      aria-label="Sponsored"
    >
      {ad.image_url && (
        <img src={ad.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" loading="lazy" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-mono uppercase tracking-wider text-slate-600">Sponsored</p>
        <p className="text-[12px] font-medium text-slate-200 truncate">{ad.title}</p>
        {ad.description && <p className="text-[11px] text-slate-500 line-clamp-1">{ad.description}</p>}
      </div>
      {ad.cta_text && (
        <button
          onClick={onClick}
          className="shrink-0 px-2.5 h-7 rounded-md text-[11px] font-medium text-diff-emerald border border-diff-emerald/30 hover:bg-diff-emerald/10 transition-colors"
        >
          {ad.cta_text}
        </button>
      )}
    </div>
  )
}
