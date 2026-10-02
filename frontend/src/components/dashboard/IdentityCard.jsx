import React from 'react'
import { Github, Snowflake } from 'lucide-react'

export function IdentityCard({ tracker, github }) {
  const tier = tracker.getTier(tracker.stats.diffScore)
  const span = tier.next ? tier.next.min - tier.min : 1
  const into = tier.next ? Math.min(1, Math.max(0, 1 - tier.toNext / span)) : 1
  const avatar = github?.profile?.avatar_url
  const login = github?.profile?.login

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        {avatar ? (
          <img src={avatar} alt={login} width={40} height={40} className="w-10 h-10 rounded-full object-cover hairline shrink-0" />
        ) : (
          <span className="w-10 h-10 rounded-full bg-raised hairline flex items-center justify-center shrink-0">
            <Github size={18} className="text-slate-500" />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-mono text-[16px] font-bold text-slate-100 leading-tight tnum">
            {tracker.stats.diffScore.toLocaleString()} <span className="text-[11px] font-medium text-slate-500">DIFF</span>
          </p>
          {login && <p className="font-mono text-[11px] text-slate-500 truncate">@{login}</p>}
          <span
            className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-bold tracking-wide border"
            style={{ color: tier.color, borderColor: `${tier.color}55`, background: `${tier.color}14` }}
          >
            {tier.name.toUpperCase()}
          </span>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between font-mono text-[10px] text-slate-500 mb-1">
          <span>{tier.next ? `Next: ${tier.next.name}` : 'Max tier reached'}</span>
          {tier.next && <span>{tier.toNext.toLocaleString()} to go</span>}
        </div>
        <div className="h-1.5 rounded-full bg-[#1A2333] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${into * 100}%`, background: tier.color }} />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
        <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400" title="Banked at every 7-day streak — auto-covers one missed day">
          <Snowflake size={12} className="text-sky-300" /> {tracker.freezes ?? 0} freeze{(tracker.freezes ?? 0) === 1 ? '' : 's'}
        </span>
        {tracker.goal && (
          <span className="ml-auto font-mono text-[11px] text-slate-500">{tracker.goal}</span>
        )}
      </div>
    </div>
  )
}
