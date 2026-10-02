import React, { useMemo } from 'react'
import { CalendarCheck, Users, BadgeCheck, BarChart3 } from 'lucide-react'
import { getDailyChallenge } from '../../data/daily.js'

export function ArenaCard({ github }) {
  const login = github?.profile?.login
  const openCert = () => {
    if (login) window.location.hash = `#/u/${login}`
    else window.dispatchEvent(new CustomEvent('builtdiff:connect'))
  }
  return (
    <div className="card p-4">
      <h3 className="text-[11px] font-semibold text-slate-400">Prove & Compete</h3>
      <div className="mt-2.5 space-y-1.5">
        <button
          onClick={() => { window.location.hash = '#/room' }}
          className="btn-ghost w-full flex items-center gap-2 px-3 h-9 rounded-md text-[13px] text-slate-200"
        >
          <Users size={14} className="text-diff-emerald" /> Study Room
        </button>
        <button
          onClick={openCert}
          className="btn-ghost w-full flex items-center gap-2 px-3 h-9 rounded-md text-[13px] text-slate-200"
        >
          <BadgeCheck size={14} className="text-diff-emerald" /> {login ? 'My Certificate' : 'Verify Me'}
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('builtdiff:report'))}
          className="btn-ghost w-full flex items-center gap-2 px-3 h-9 rounded-md text-[13px] text-slate-200"
        >
          <BarChart3 size={14} className="text-diff-emerald" /> Week in Review
        </button>
      </div>
    </div>
  )
}

export function DailyChallengeCard({ tracker }) {
  const challenge = useMemo(() => {
    try { return getDailyChallenge() } catch { return null }
  }, [])
  if (!challenge) return null
  const done = tracker.isSolved(challenge.id)
  return (
    <div className="card p-4 border-diff-emerald/30">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
        <CalendarCheck size={12} className="text-diff-emerald" /> Today's Challenge
        <span className="ml-auto font-mono text-[10px] text-slate-500">{challenge.challengeDate.slice(5)}</span>
      </p>
      <p className="mt-2 text-[14px] font-semibold text-slate-100 leading-snug">{challenge.canonicalTitle}</p>
      <p className="text-[12px] text-slate-500 mt-0.5">{challenge.challengeDifficulty} · same problem for everyone today</p>
      <a
        href={`#/solve/${challenge.id}`}
        className={`${done ? 'btn-ghost text-slate-300' : 'btn-emerald'} mt-3 flex items-center justify-center h-9 rounded-md text-[13px] font-semibold`}
      >
        {done ? 'Solved — review it' : 'Take the challenge'}
      </a>
    </div>
  )
}

