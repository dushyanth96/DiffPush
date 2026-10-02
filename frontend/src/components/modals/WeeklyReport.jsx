import React from 'react'
import { X, Copy, Check } from 'lucide-react'
import { getTopics, getByTopic } from '../../data/curriculum.js'

// Weekly report: fully client-side share card. No fabricated numbers —
// every figure derives from dailySquares / solvedMap / streak.
export function WeeklyReport({ tracker, onClose }) {
  const [copied, setCopied] = React.useState(false)
  const now = Date.now()
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000).toISOString().slice(0, 10)
    days.push({ date: d, count: tracker.dailySquares[d] ?? 0 })
  }
  const solves = days.reduce((s, d) => s + d.count, 0)
  const active = days.filter((d) => d.count > 0).length

  let weakest = null
  try {
    const rows = getTopics().map((t) => {
      const ps = getByTopic(t.id)
      const s = ps.filter((p) => tracker.isSolved(p.id)).length
      return { name: t.name, pct: ps.length ? (s / ps.length) * 100 : 0 }
    }).filter((r) => r.pct > 0).sort((a, b) => a.pct - b.pct)
    weakest = rows[0] ?? null
  } catch { weakest = null }

  const text = `My DiffPush week: ${solves} solves across ${active}/7 days, ${tracker.stats.currentStreak}-day streak, ${tracker.stats.diffScore.toLocaleString()} DIFF${weakest ? `. Next target: ${weakest.name}.` : '.'}`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-label="Week in review">
      <div className="card w-full max-w-md p-6 !bg-popover" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-slate-100">Week in review</h2>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-200"><X size={16} /></button>
        </div>
        <div className="mt-4 flex gap-[3px]">
          {days.map((d) => (
            <div key={d.date} className="flex-1">
              <div className={`h-8 rounded ${d.count > 0 ? 'bg-emerald-500' : 'bg-[#1A2333]'}`} title={`${d.date}: ${d.count}`} />
              <p className="mt-1 text-center font-mono text-[10px] text-slate-500">{d.date.slice(5)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ['SOLVES', String(solves)],
            ['ACTIVE DAYS', `${active}/7`],
            ['STREAK', `${tracker.stats.currentStreak}d`],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface hairline rounded-md p-2.5 text-center">
              <p className="font-mono text-[16px] font-bold text-slate-100 tnum">{value}</p>
              <p className="font-mono text-[10px] text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        {weakest && <p className="mt-3 text-[12px] text-slate-400">Next target: <span className="text-slate-200 font-medium">{weakest.name}</span> ({Math.round(weakest.pct)}% — lowest started topic).</p>}
        <button onClick={copy} className="btn-ghost mt-4 w-full flex items-center justify-center gap-1.5 h-9 rounded-md text-[13px] text-slate-200">
          {copied ? <Check size={14} className="text-diff-emerald" /> : <Copy size={14} />} {copied ? 'Copied — post it' : 'Copy week summary'}
        </button>
      </div>
    </div>
  )
}
