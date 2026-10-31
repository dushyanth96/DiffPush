import React from 'react'

import { Repeat, Check, HardDriveDownload } from 'lucide-react'
import { navigate } from '../../data/route.js'
import { InfoTip } from '../layout/InfoTip.jsx'
import { BOX_INTERVALS } from '../../hooks/useTracker.js'
import { BackupModal } from '../modals/BackupModal.jsx'
function Ring({ pct }) {  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#1E293B" strokeWidth="6" />
      <circle
        cx="32" cy="32" r={r} fill="none" stroke="#10B981" strokeWidth="6"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="32" textAnchor="middle" dy="0.35em" fill="#E6EAF2" fontSize="13" fontWeight="700" fontFamily="JetBrains Mono, monospace">
        {pct > 0 && pct < 1 ? '<1' : Math.round(pct)}%
      </text>
    </svg>
  )
}

const cardLabel = 'text-[11px] font-semibold tracking-wide text-slate-500 uppercase'

function enableRecallReminders() {
  if (!('Notification' in window)) return
  Notification.requestPermission().catch(() => {})
}

function SquareStrip({ squares = {} }) {
  const days = []
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    days.push({ key, count: squares[key] ?? 0, isToday: i === 0 })
  }
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-1.5">
        <p className={cardLabel}>14-Day Farm</p>
        <p className="font-mono text-[10px] text-slate-500">{days.filter((d) => d.count > 0).length}/14 active</p>
      </div>
      <div className="flex gap-[3px] justify-center">
        {days.map((d) => (
          <div
            key={d.key}
            title={`${d.key}: ${d.count} solve${d.count === 1 ? '' : 's'}${d.isToday && d.count === 0 ? ' — keep the streak alive!' : ''}`}
            className={`w-4 h-4 rounded-sm flex items-center justify-center ${
              d.count > 0
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : d.isToday
                  ? 'border border-diff-amber/70 animate-pulse bg-transparent'
                  : 'bg-[#0D111A] border border-white/10'
            }`}
          >
            {d.count > 0 && d.isToday && <Check size={10} strokeWidth={4} className="text-[#04120C]" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MasterProgressCard({ tracker }) {
  const completion = tracker.getCompletionStats()
  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        <Ring pct={completion.percentage} />
        <div className="min-w-0">
          <p className={cardLabel}>Master Progress</p>
          <p className="font-mono text-[16px] font-semibold text-slate-100 mt-1 tnum">
            {completion.totalSolved} / 369 <span className="text-slate-500 font-normal">Solved</span>
          </p>
          <p className="text-[12px] text-slate-500">Each one a green square on your GitHub</p>
        </div>
      </div>
      <SquareStrip squares={tracker.dailySquares} />
      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
        {[
          ['Easy', completion.easySolved, 120, '#10B981'],
          ['Medium', completion.medSolved, 172, '#F59E0B'],
          ['Hard', completion.hardSolved, 77, '#F43F5E'],
        ].map(([label, val, max, color]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-500 w-12 shrink-0">{label}</span>
            <div className="flex-1 h-1 rounded-full bg-[#1A2333] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${max ? (val / max) * 100 : 0}%`, background: color }} />
            </div>
            <span className="font-mono text-[10px] text-slate-500 tnum w-14 text-right shrink-0">{val}/{max}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RecallCard({ tracker }) {
  const due = tracker.getDueCards().length
  return (
    <div className="card p-4 flex flex-col justify-between">
      <div>
        <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">Spaced Repetition</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[16px] font-semibold text-slate-100 tnum">
          {due} <span className="font-normal text-slate-400">Due for Recall</span>
          <InfoTip label="recall intervals">
            Solved problems enter a Leitner queue. Boxes resurface after {BOX_INTERVALS[1]}/{BOX_INTERVALS[2]}/{BOX_INTERVALS[3]}/{BOX_INTERVALS[4]}/{BOX_INTERVALS[5]} days.
            Rating 1 resets to Box 1 (+0 DIFF), 2 advances one box (+250), 3 jumps two (+500). “Due” means the next review date has passed.
          </InfoTip>
        </p>
        <p className="text-[12px] text-slate-500">Reviews auto-scheduled at 1/3/7/14/30 days</p>
      </div>
      <button onClick={() => navigate('/review')} className="btn-ghost mt-3 flex items-center justify-center gap-1.5 h-8 rounded-md text-[13px] font-medium text-slate-200">
        <Repeat size={14} /> Start Recall Drill
      </button>
      <button onClick={enableRecallReminders} className="mt-1.5 w-full text-center font-mono text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
        Remind me when cards are due
      </button>
    </div>
  )
}

export function SafetyCard({ tracker }) {
  const [backupOpen, setBackupOpen] = React.useState(false)
  const solved = tracker.getCompletionStats().totalSolved
  return (
    <div className="card p-4 flex flex-col justify-between">
      <div>
        <p className="text-[11px] font-semibold text-slate-400">Progress Safety</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-diff-emerald inline-block" />
          Saved on this device only
        </p>
        <p className="text-[12px] text-slate-500 mt-0.5">
          Clearing site data erases {solved} solved problem{solved === 1 ? '' : 's'} and the recall queue. Export a backup first.
        </p>
      </div>
      <button
        onClick={() => setBackupOpen(true)}
        className="btn-ghost mt-3 flex items-center justify-center gap-1.5 h-8 rounded-md text-[13px] font-medium text-slate-200"
      >
        <HardDriveDownload size={14} /> Backup &amp; restore
      </button>
      {backupOpen && <BackupModal tracker={tracker} onClose={() => setBackupOpen(false)} />}
    </div>
  )
}
