import React from 'react'
import { Lock } from 'lucide-react'

const VIEWS = [
  { id: 'curriculum', label: 'Core Curriculum', locked: false },
  { id: 'companies', label: 'Company Prep', locked: false },
  { id: 'marketplace', label: 'Marketplace', locked: true },
]

export function ViewSwitcher({ active, onChange }) {
  return (
    <div className="flex items-center gap-1 border-b border-white/10" role="tablist" aria-label="Primary views">
      {VIEWS.map((v) => {
        const isActive = active === v.id
        return (
          <button
            key={v.id}
            role="tab"
            aria-selected={isActive}
            disabled={v.locked}
            onClick={() => !v.locked && onChange(v.id)}
            className={`relative flex items-center gap-1.5 px-4 h-10 text-[13px] font-medium transition-colors ${
              isActive ? 'text-slate-100' : v.locked ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {v.label}
            {v.locked && (
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-slate-600">
                <Lock size={10} /> Soon
              </span>
            )}
            {isActive && <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-diff-emerald" />}
          </button>
        )
      })}
    </div>
  )
}
