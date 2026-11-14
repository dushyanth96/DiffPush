import React, { useEffect, useRef, useState } from 'react'
import { X, Download, Share2, Loader2 } from 'lucide-react'
import { getTier } from '../../hooks/useTracker.js'
import { track } from '../../lib/analytics.js'

// Canvas-rendered progress card (1080x1080 — IG/X/WhatsApp friendly).
// Same-origin /logo.png keeps the canvas untainted, so toBlob works.
const W = 1080
const H = 1080

async function drawCard({ solved, streak, diffScore, percentage, handle }) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // background
  ctx.fillStyle = '#07090E'
  ctx.fillRect(0, 0, W, H)
  // subtle emerald atmosphere (matches the landing hero)
  const glow = ctx.createRadialGradient(W - 120, 140, 40, W - 120, 140, 640)
  glow.addColorStop(0, 'rgba(16,185,129,0.16)')
  glow.addColorStop(1, 'rgba(16,185,129,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // border
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 2
  ctx.strokeRect(28, 28, W - 56, H - 56)

  // logo (optional — never blocks the render)
  await new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 72, 72, 72, 72)
      resolve()
    }
    img.onerror = resolve
    img.src = '/logo.png'
  })

  ctx.fillStyle = '#E6EAF2'
  ctx.font = '700 30px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('DiffPush', 160, 112)
  ctx.fillStyle = '#7D8B9F'
  ctx.font = '500 20px ui-monospace, monospace'
  ctx.fillText(handle ? `@${handle} · diffpush.pages.dev` : 'diffpush.pages.dev', 160, 140)

  // headline
  ctx.fillStyle = '#E6EAF2'
  ctx.font = '800 76px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(`${streak} days of DSA`, 72, 300)
  ctx.fillStyle = '#10B981'
  ctx.fillText('built different.', 72, 388)

  // stat blocks
  const stats = [
    { v: String(solved), l: 'PROBLEMS SOLVED' },
    { v: `${percentage}%`, l: 'A2Z SHEET' },
    { v: streak > 0 ? `${streak}` : '0', l: 'DAY STREAK' },
    { v: diffScore.toLocaleString(), l: 'DIFF SCORE' },
  ]
  const boxY = 500
  const boxW = (W - 144 - 3 * 24) / 4
  stats.forEach((s, i) => {
    const x = 72 + i * (boxW + 24)
    ctx.fillStyle = '#0D111A'
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath()
      ctx.roundRect(x, boxY, boxW, 190, 14)
      ctx.fill()
      ctx.stroke()
    } else {
      ctx.fillRect(x, boxY, boxW, 190)
      ctx.strokeRect(x, boxY, boxW, 190)
    }
    ctx.fillStyle = i === 2 ? '#FBBF24' : '#10B981'
    ctx.font = '800 52px ui-monospace, monospace'
    ctx.fillText(s.v, x + 24, boxY + 92)
    ctx.fillStyle = '#7D8B9F'
    ctx.font = '600 15px ui-sans-serif, system-ui, sans-serif'
    ctx.fillText(s.l, x + 24, boxY + 136)
  })

  // tier strip
  const tier = getTier(diffScore)
  ctx.fillStyle = '#7D8B9F'
  ctx.font = '600 22px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('CURRENT TIER', 72, 800)
  ctx.fillStyle = tier.color ?? '#10B981'
  ctx.font = '800 44px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(tier.name, 72, 852)

  // footer
  ctx.fillStyle = '#3B4658'
  ctx.font = '500 20px ui-monospace, monospace'
  ctx.fillText('Free forever · 369 problems · zero cost', 72, H - 72)

  return canvas
}

export function ShareCardModal({ stats, streak, diffScore, handle, onClose }) {
  const [dataUrl, setDataUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const urlRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    drawCard({ solved: stats.totalSolved, streak, diffScore, percentage: stats.percentage, handle })
      .then((canvas) => {
        if (cancelled) return
        const url = canvas.toDataURL('image/png')
        setDataUrl(url)
        track('share_card', {})
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  const download = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'diffpush-progress.png'
    a.click()
  }

  const shareNative = async () => {
    if (!dataUrl) return
    setBusy(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'diffpush-progress.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My DiffPush progress' })
      } else {
        download()
      }
    } catch { /* user cancelled */ }
    setBusy(false)
  }

  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`I've solved ${stats.totalSolved} DSA problems with a ${streak}-day streak on DiffPush — free forever.\n\nhttps://diffpush.pages.dev`)}`

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-card-title"
      onClick={onClose}
    >
      <div className="card w-full max-w-md p-5 !bg-popover max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Share2 size={15} className="text-diff-emerald" />
          <h2 id="share-card-title" className="text-[15px] font-bold text-slate-100">Share your progress</h2>
          <button onClick={onClose} aria-label="Close share dialog" className="ml-auto text-slate-500 hover:text-slate-200 shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 rounded-lg overflow-hidden hairline bg-[#07090E]">
          {dataUrl ? (
            <img src={dataUrl} alt="DiffPush progress card" className="w-full block" />
          ) : (
            <div className="aspect-square flex items-center justify-center font-mono text-[12px] text-slate-600">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={download} disabled={!dataUrl} className="btn-emerald h-10 rounded-md text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
            <Download size={14} /> Download PNG
          </button>
          <button onClick={shareNative} disabled={!dataUrl || busy} className="btn-ghost h-10 rounded-md text-[13px] font-medium text-slate-200 flex items-center justify-center gap-2 disabled:opacity-40">
            <Share2 size={14} /> {busy ? 'Sharing…' : 'Share…'}
          </button>
        </div>
        <a
          href={tweet}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost w-full h-10 rounded-md text-[13px] font-medium text-slate-200 mt-2 flex items-center justify-center gap-2"
        >
          Post to X / Twitter
        </a>
        <p className="text-[11px] text-slate-600 mt-2.5">No account data is included — just counts and the tier name.</p>
      </div>
    </div>
  )
}
