import React, { useMemo, useState } from 'react'
import { Building2 } from 'lucide-react'
import companies from '../../data/companies.json'
import { getProblemMeta } from '../../data/curriculum.js'
import { ProblemRow } from './CurriculumDirectory.jsx'

export function CompanyView({ tracker }) {
  const [active, setActive] = useState(companies[0].id)
  const company = companies.find((c) => c.id === active) ?? companies[0]

  const items = useMemo(() => {
    const out = []
    for (const id of company.problems) {
      try {
        const meta = getProblemMeta(id)
        if (meta) out.push(meta)
      } catch {}
    }
    return out
  }, [company])

  const solved = items.filter((p) => tracker.isSolved(p.id)).length

  return (
    <div>
      <div className="card p-4 mb-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <Building2 size={12} className="text-diff-emerald" /> Company Prep · hand-picked from public interview reports
        </p>
        <div className="flex gap-1.5 mt-3 overflow-x-auto">
          {companies.map((c) => {
            const cSolved = c.problems.filter((id) => tracker.isSolved(id)).length
            const on = c.id === active
            return (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`shrink-0 px-3 h-9 rounded-md text-[13px] font-medium transition-colors ${on ? 'bg-raised text-slate-100 hairline' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {c.name} <span className="font-mono text-[11px] text-slate-500">{cSolved}/{c.problems.length}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold tracking-tight text-slate-100">{company.name} — Core {company.problems.length}</p>
          <p className="text-[12px] text-slate-500 mt-0.5">{company.blurb}</p>
          <div className="mt-2 h-1.5 rounded-full bg-[#1A2333] overflow-hidden">
            <div className="h-full bg-diff-emerald rounded-full" style={{ width: `${items.length ? (solved / items.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="px-2 py-1">
          {items.map((p) => <ProblemRow key={p.id} p={p} tracker={tracker} />)}
        </div>
      </div>
    </div>
  )
}
