import React, { useMemo } from 'react'
import { getTopics, getByTopic } from '../../data/curriculum.js'

export function TopicRadar({ tracker }) {
  const rows = useMemo(() => {
    try {
      return getTopics().map((t) => {
        const ps = getByTopic(t.id)
        const solved = ps.filter((p) => tracker.isSolved(p.id)).length
        return { ...t, solved, total: ps.length, pct: ps.length ? (solved / ps.length) * 100 : 0 }
      })
    } catch {
      return []
    }
  }, [tracker.solvedMap])

  const started = rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct)
  const strongest = started.slice(0, 2)
  const weakest = started.length ? started[started.length - 1] : null

  return (
    <div className="card p-4">
      <h3 className="text-[11px] font-semibold text-slate-400">
        <span className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full bg-diff-violet align-middle" />
        Topic Radar
      </h3>
      {started.length === 0 ? (
        <p className="mt-2 text-[12px] text-slate-500 leading-relaxed">Solve your first problem to light up the radar.</p>
      ) : (
        <div className="mt-2.5 space-y-2">
          {strongest.map((r) => (
            <RadarRow key={r.id} name={r.name} solved={r.solved} total={r.total} pct={r.pct} strong />
          ))}
          {weakest && !strongest.includes(weakest) && (
            <RadarRow name={weakest.name} solved={weakest.solved} total={weakest.total} pct={weakest.pct} />
          )}
          {weakest && strongest.includes(weakest) && started.length > 2 && (
            <RadarRow name={started[2].name} solved={started[2].solved} total={started[2].total} pct={started[2].pct} />
          )}
          <p className="font-mono text-[10px] text-slate-500 pt-0.5">
            {weakest ? `Next session: push ${weakest.name} past ${Math.round(weakest.pct)}%` : 'Keep the streak alive.'}
          </p>
        </div>
      )}
    </div>
  )
}

function RadarRow({ name, solved, total, pct, strong }) {
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1">
        <span className={strong ? 'text-diff-emerald font-medium' : 'text-diff-amber font-medium'}>{name}</span>
        <span className="font-mono text-slate-500">{solved}/{total} · {Math.round(pct)}%</span>
      </div>
      <div className="h-1 rounded-full bg-[#1A2333] overflow-hidden">
        <div className={`h-full rounded-full ${strong ? 'bg-diff-emerald' : 'bg-diff-amber'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
