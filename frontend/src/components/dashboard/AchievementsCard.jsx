import React, { useState } from 'react'
import { Medal, Lock, ChevronDown, ChevronRight } from 'lucide-react'
import { ACHIEVEMENTS } from '../../hooks/useTracker.js'

export function AchievementsCard({ tracker }) {
  const have = new Set(tracker.achievements)
  const [open, setOpen] = useState(false)
  const all = Object.entries(ACHIEVEMENTS)
  return (
    <div className="card p-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-1.5 text-left" aria-expanded={open}>
        {open
          ? <ChevronDown size={13} className="text-slate-500 shrink-0" />
          : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
        <span className="text-[11px] font-semibold text-slate-400">Achievements</span>
        <span className="font-mono text-[10px] text-slate-500 ml-auto">{have.size}/{all.length}</span>
      </button>
      {/* collapsed: 2x4 badge grid, big and legible */}
      {!open && (
        <div className="mt-2.5 grid grid-cols-4 gap-2">
          {all.map(([id, a]) => {
            const got = have.has(id)
            return (
              <div key={id} title={got ? `${a.name} — ${a.desc}` : `Locked: ${a.name} — ${a.desc}`} className="flex flex-col items-center gap-1 py-1">
                {got
                  ? <Medal size={22} className="text-diff-amber" />
                  : <Lock size={18} className="text-slate-700" />}
                <p className={`text-[10px] font-medium leading-tight text-center ${got ? 'text-slate-300' : 'text-slate-600'}`}>{a.name}</p>
              </div>
            )
          })}
        </div>
      )}
      {open && (
        <div className="mt-2.5 space-y-1.5">
          {all.map(([id, a]) => {
            const got = have.has(id)
            return (
              <div key={id} className="flex items-center gap-2">
                {got
                  ? <Medal size={13} className="text-diff-amber shrink-0" />
                  : <Lock size={12} className="text-slate-700 shrink-0" />}
                <div className="min-w-0">
                  <p className={`text-[12px] font-medium leading-tight ${got ? 'text-slate-200' : 'text-slate-600'}`}>{a.name}</p>
                  <p className="text-[11px] text-slate-600 leading-tight truncate">{a.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
