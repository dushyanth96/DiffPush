import React, { useEffect, useState } from 'react'
import { ArrowLeft, BadgeCheck, ExternalLink } from 'lucide-react'
import { getTier } from '../../hooks/useTracker.js'

function decodeB64(b64) {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

// Verifiable certificate page: reads the PUBLIC repo directly.
// #/u/:username — no backend, no database.
export function CertView({ username, onBack }) {
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`https://api.github.com/users/${username}`).then((r) => {
        if (!r.ok) throw new Error('GitHub user not found')
        return r.json()
      }),
      fetch(`https://api.github.com/repos/${username}/builtdiff-solutions/contents/.builtdiff/tracker.json`).then((r) => {
        if (!r.ok) throw new Error('No public BuiltDiff solutions repo')
        return r.json()
      }).then((j) => JSON.parse(decodeB64(j.content))),
    ])
      .then(([profile, tracker]) => { if (!cancelled) setState({ loading: false, profile, tracker }) })
      .catch((e) => { if (!cancelled) setState({ loading: false, error: e.message }) })
    return () => { cancelled = true }
  }, [username])

  return (
    <div className="pt-16 min-h-screen">
      <div className="border-b border-border bg-canvas px-4 py-2.5">
        <button onClick={onBack} className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-100">
          <ArrowLeft size={15} /> Back to Hub
        </button>
      </div>
      <div className="max-w-[640px] mx-auto px-4 py-10">
        {state.loading ? (
          <div className="card p-10 text-center font-mono text-[13px] text-slate-500">Verifying from public repo…</div>
        ) : state.error ? (
          <div className="card p-10 text-center">
            <p className="text-[15px] font-semibold text-slate-200">Not verifiable yet</p>
            <p className="text-[13px] text-slate-500 mt-1">{state.error} for @{username}.</p>
          </div>
        ) : (
          <CertCard profile={state.profile} tracker={state.tracker} username={username} />
        )}
      </div>
    </div>
  )
}

function CertCard({ profile, tracker, username }) {
  const solves = Object.keys(tracker.solvedMap ?? {}).length
  const pct = Math.round((solves / 369) * 100)
  const tier = getTier(tracker.stats?.diffScore ?? 0)
  const streak = tracker.stats?.currentStreak ?? 0
  return (
    <div className="card p-8 text-center border-diff-emerald/30">
      <BadgeCheck size={32} className="text-diff-emerald mx-auto" />
      <p className="eyebrow mt-3">BuiltDiff certified record</p>
      <div className="mt-2 flex items-center justify-center gap-3">
        <img src={profile.avatar_url} alt={username} width={48} height={48} className="w-12 h-12 rounded-full object-cover hairline" />
        <p className="text-[20px] font-bold tracking-tight text-slate-100">@{username}</p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ['SOLVED', `${solves}/369`],
          ['RANK', tier.name],
          ['STREAK', `${streak}d`],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface hairline rounded-md p-3">
            <p className="font-mono text-[15px] font-bold text-slate-100 tnum">{value}</p>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 h-2 rounded-full bg-[#1A2333] overflow-hidden">
        <div className="h-full bg-diff-emerald rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 font-mono text-[11px] text-slate-500">Verified live from the public repo — attach it to your resume.</p>
      <a href={`https://github.com/${username}/builtdiff-solutions`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[13px] text-diff-emerald hover:underline">
        builtdiff-solutions <ExternalLink size={12} />
      </a>
    </div>
  )
}
