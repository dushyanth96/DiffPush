import React, { useEffect } from 'react'
import { Target, Building2, BookOpen } from 'lucide-react'
import { GOALS } from '../../hooks/useTracker.js'

const ICONS = { placements: Target, faang: Building2, core: BookOpen }

// Day-0 goal picker: one choice personalizes the First Blood path.
// "Not now" dismisses for good (goalPrompted) — it never silently picks a
// track, and the picker does not reappear on reload.
export function GoalPicker({ onPick, onSkip }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && onSkip) onSkip() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSkip])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Pick your training goal">
      <div className="card w-full max-w-md p-6 !bg-popover">
        <p className="eyebrow">First, your target</p>
        <h2 className="mt-1.5 text-[18px] font-bold tracking-tight text-slate-100">What are you training for?</h2>
        <p className="mt-1 text-[12px] text-slate-500">Optional — it only reorders the starter problems. You can change it later from the command palette.</p>
        <div className="mt-4 space-y-2">
          {Object.entries(GOALS).map(([id, g]) => {
            const Icon = ICONS[id] ?? Target
            return (
              <button
                key={id}
                onClick={() => onPick(id)}
                className="card card-hover w-full flex items-center gap-3 p-3.5 text-left transition-colors"
              >
                <span className="w-9 h-9 rounded-md bg-raised hairline flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-diff-emerald" />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-slate-100">{g.name}</span>
                  <span className="block text-[12px] text-slate-500">{g.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
        <button
          onClick={onSkip}
          className="mt-3 w-full text-center font-mono text-[12px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          Not now — keep the default starter path
        </button>
      </div>
    </div>
  )
}
