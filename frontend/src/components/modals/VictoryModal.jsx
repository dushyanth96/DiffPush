import React, { useEffect, useMemo, useState } from 'react'
import { Check, Share2, ArrowRight, Code2, ChevronUp, Trophy, Medal, Search, Star } from 'lucide-react'
import { getByTopic } from '../../data/curriculum.js'
import { REPO_URL } from '../../data/repo.js'

function useCountUp(target, ms = 900) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms)
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return val
}

const LANG_KEY = 'builtdiff:lang-votes:v2'
// base = community floor, +1 applied live when you vote. `roadmap` marks
// languages already promised in the workspace selector.
const LANG_BASE = [
  { id: 'rust', label: 'Rust', base: 214, roadmap: true },
  { id: 'go', label: 'Go', base: 186, roadmap: true },
  { id: 'typescript', label: 'TypeScript', base: 167, roadmap: true },
  { id: 'csharp', label: 'C#', base: 143, roadmap: true },
  { id: 'kotlin', label: 'Kotlin', base: 131, roadmap: true },
  { id: 'sql', label: 'SQL', base: 119, roadmap: false },
  { id: 'zig', label: 'Zig', base: 97, roadmap: false },
  { id: 'swift', label: 'Swift', base: 84, roadmap: false },
  { id: 'ruby', label: 'Ruby', base: 76, roadmap: true },
  { id: 'php', label: 'PHP', base: 69, roadmap: true },
  { id: 'dart', label: 'Dart', base: 61, roadmap: false },
  { id: 'scala', label: 'Scala', base: 52, roadmap: false },
  { id: 'haskell', label: 'Haskell', base: 44, roadmap: false },
  { id: 'elixir', label: 'Elixir', base: 33, roadmap: false },
]

const slugId = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function loadVoteStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(LANG_KEY) ?? 'null')
    if (raw && Array.isArray(raw.voted)) {
      return { voted: raw.voted, custom: Array.isArray(raw.custom) ? raw.custom : [] }
    }
  } catch { /* corrupt */ }
  return { voted: [], custom: [] }
}

export function LanguageRequestModal({ onClose }) {
  const [store, setStore] = useState(loadVoteStore)
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState('')
  const [flash, setFlash] = useState(null)

  const persist = (next) => {
    setStore(next)
    try { localStorage.setItem(LANG_KEY, JSON.stringify(next)) } catch { /* quota */ }
  }

  // Full list, re-sorted every time a vote lands so rank is real-time.
  const all = useMemo(() => {
    const has = (id) => store.voted.includes(id)
    const base = LANG_BASE.map((l) => ({ ...l, votes: l.base + (has(l.id) ? 1 : 0), mine: has(l.id) }))
    const custom = store.custom.map((l) => ({ ...l, votes: l.votes + (has(l.id) ? 1 : 0), mine: has(l.id), roadmap: false }))
    return [...base, ...custom].sort((a, b) => b.votes - a.votes)
  }, [store])

  const query = q.trim().toLowerCase()
  const shown = query ? all.filter((l) => l.label.toLowerCase().includes(query)) : all

  const pulse = (id) => { setFlash(id); setTimeout(() => setFlash((f) => (f === id ? null : f)), 900) }

  const upvote = (id) => {
    if (store.voted.includes(id)) return
    persist({ ...store, voted: [...store.voted, id] })
    pulse(id)
  }

  const addLanguage = (raw) => {
    const name = (raw ?? draft).trim()
    const id = slugId(name)
    if (!name || !id || store.voted.includes(id)) return
    const existing = all.find((l) => l.id === id || l.label.toLowerCase() === name.toLowerCase())
    if (existing) { upvote(existing.id); return }
    persist({ voted: [...store.voted, id], custom: [...store.custom, { id, label: name, votes: 0 }] })
    setDraft('')
    pulse(id)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-label="Request a language">
      <div className="card w-full max-w-sm p-5 !bg-popover" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-bold text-slate-100">Request a Language</h2>
        <p className="text-[12px] text-slate-500 mt-1">Python + JavaScript run on your machine; Java + C++ on a shared remote compiler. New languages ship by community demand — one vote each.</p>

        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search languages…"
            aria-label="Search languages"
            className="w-full bg-surface hairline rounded-md h-9 pl-9 pr-3 text-[13px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-diff-emerald/40"
          />
        </div>

        <div className="mt-2.5 space-y-1.5 max-h-[46vh] overflow-y-auto pr-0.5" aria-live="polite">
          {shown.length === 0 && (
            <p className="text-[12px] text-slate-500 py-2 text-center">No match yet — add it below and it enters the board at 1 vote.</p>
          )}
          {shown.map((l) => (
            <div key={l.id} className="flex items-center gap-2 bg-surface hairline rounded-md px-3 h-10">
              <span className="font-mono text-[13px] text-slate-200 truncate">{l.label}</span>
              {l.roadmap && <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600 shrink-0">roadmap</span>}
              <span
                key={l.votes}
                className={`font-mono text-[11px] ml-auto shrink-0 tnum transition-colors ${flash === l.id ? 'text-diff-emerald' : 'text-slate-500'}`}
              >
                {l.votes.toLocaleString()} votes
              </span>
              <button
                onClick={() => upvote(l.id)}
                disabled={l.mine}
                aria-label={`Upvote ${l.label}`}
                className={`flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] font-medium shrink-0 transition-all ${l.mine ? 'text-diff-emerald bg-diff-emerald/10 border border-diff-emerald/30' : 'btn-ghost text-slate-300'}`}
              >
                <ChevronUp size={13} className={flash === l.id ? '-translate-y-0.5 transition-transform' : ''} /> {l.mine ? 'Voted' : 'Upvote'}
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); addLanguage() }} className="mt-3 pt-3 border-t border-border">
          <label htmlFor="lang-add" className="text-[12px] text-slate-500">Don't see it? Add a language</label>
          <div className="flex gap-1.5 mt-1.5">
            <input
              id="lang-add"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Julia, Nim, Erlang…"
              className="flex-1 min-w-0 bg-surface hairline rounded-md h-9 px-3 text-[13px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-diff-emerald/40"
            />
            <button type="submit" className="btn-emerald px-3 h-9 rounded-md text-[13px] font-semibold shrink-0">Add</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function VictoryModal({ meta, totalMs, totalCases, commitInfo, github, xp, tier, onClose, onNext }) {
  const [showDiff, setShowDiff] = useState(false)
  const [copied, setCopied] = useState(false)
  const avg = totalMs != null ? Math.round((totalMs / Math.max(1, 3)) * 100) / 100 : null
  const gained = xp?.breakdown?.gained ?? 500
  const counted = useCountUp(gained)
  const bd = xp?.breakdown
  const tierUp = xp?.tierUp ?? null
  const fresh = xp?.newAchievements ?? []
  const shownTier = tierUp ?? tier
  const span = shownTier?.next ? shownTier.next.min - (shownTier.min ?? 0) : 1
  const intoTier = shownTier ? Math.min(1, Math.max(0, 1 - (shownTier.toNext ?? 0) / span)) : 0

  // Ctrl+Enter → next problem while the modal owns focus.
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onNext() }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [onNext, onClose])

  const share = async () => {
    const commitUrl = commitInfo?.sha ? `${commitInfo.repoUrl}/commit/${commitInfo.sha}` : null
    const text = `Solved "${meta.canonicalTitle}" on BuiltDiff — ${meta.optimalTime} · ${meta.optimalSpace} · +${gained} DIFF${commitUrl ? ` — ${commitUrl}` : ''}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-label="Solve recognized">
      <div className="card w-full max-w-lg p-6 !bg-popover" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5">
          <span className="btn-emerald w-9 h-9 rounded-full flex items-center justify-center shrink-0">
            <Check size={18} strokeWidth={3} />
          </span>
          <div>
            <p className="font-mono text-[13px] font-bold text-diff-emerald tracking-wide">CODE EXECUTED SUCCESSFULLY</p>
            <p className="text-[13px] text-slate-300">{meta.canonicalTitle} — all {totalCases ?? 3} cases green</p>
            <p className="text-[12px] text-slate-500 mt-0.5">Move to the next question when you're ready.</p>
          </div>
          {commitInfo?.sha && <span className="ml-auto font-mono text-[11px] text-slate-500">#{commitInfo.sha.slice(0, 7)}</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
          {[
            ['WASM RUNTIME', totalMs != null ? `${Math.round(totalMs * 100) / 100}ms` : '—', avg != null ? `avg ${avg}ms / case` : 'local exec'],
            ['MEMORY TARGET', meta.optimalSpace ?? '?', 'auxiliary bound'],
            ['DIFF EARNED', `+${counted}`, bd ? `${bd.base} base · ${bd.streakBonus} streak · ${bd.comboBonus} combo` : 'banked'],
          ].map(([label, value, sub]) => (
            <div key={label} className="bg-surface hairline rounded-md p-2.5">
              <p className="text-[11px] font-semibold text-slate-400">{label}</p>
              <p className="font-mono text-[16px] font-bold text-slate-100 mt-0.5 tnum">{value}</p>
              <p className="font-mono text-[10px] text-slate-500">{sub}</p>
            </div>
          ))}
        </div>

        {/* open-source star callout — peak dopamine moment */}
        <div className="mt-4 p-3 rounded-lg bg-surface hairline flex items-center justify-between gap-3">
          <p className="text-[12px] text-slate-400 leading-snug">
            <span className="text-slate-100 font-medium">BuiltDiff is open-source.</span> Star the repo to support free, ad-free developer tools.
          </p>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 px-2.5 py-1.5 rounded-md bg-diff-amber/10 border border-diff-amber/30 text-diff-amber hover:bg-diff-amber/20 font-mono text-[12px] flex items-center gap-1 transition-colors"
          >
            <Star size={12} fill="currentColor" /> Star Repo
          </a>
        </div>

        {(tierUp || fresh.length > 0) && (
          <div className="mt-3 rounded-md p-3 border border-diff-emerald/50 bg-diff-emerald/5">
            {tierUp && (
              <p className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: tierUp.color }}>
                <Trophy size={15} /> TIER UP — {tierUp.name}
              </p>
            )}
            {fresh.map((a) => (
              <p key={a.id} className="flex items-center gap-1.5 text-[12px] text-slate-200 mt-1">
                <Medal size={13} className="text-diff-amber" /> {a.name} — {a.desc}
              </p>
            ))}
          </div>
        )}

        {shownTier?.next && (
          <div className="mt-3">
            <div className="flex justify-between font-mono text-[10px] text-slate-500 mb-1">
              <span style={{ color: shownTier.color }}>{shownTier.name}</span>
              <span>{shownTier.toNext.toLocaleString()} DIFF to {shownTier.next.name}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#1A2333] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${intoTier * 100}%`, background: shownTier.color }} />
            </div>
          </div>
        )}

        <p className="mt-3 text-[12px] text-slate-400">
          {commitInfo?.sha
            ? <>Committed to <span className="font-mono text-slate-200">@{github?.profile?.login}/builtdiff-solutions</span> — green square awarded.</>
            : commitInfo?.queued
              ? 'Offline — commit queued, pushes on reconnect.'
              : 'Connect GitHub to farm this solve as a contribution.'}
        </p>
        {bd?.freezeUsed && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-sky-300">
            A streak freeze covered your missed day — streak alive at {bd.streak} ({bd.freezes} freeze{bd.freezes === 1 ? '' : 's'} left).
          </p>
        )}

        {showDiff && commitInfo?.path && (
          <p className="mt-2 font-mono text-[11px] text-slate-500 break-all">→ {commitInfo.path}</p>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={() => setShowDiff((s) => !s)} className="btn-ghost flex items-center gap-1.5 px-3 h-9 rounded-md text-[13px] text-slate-300">
            <Code2 size={14} /> Review Code Diff
          </button>
          <button onClick={share} className="btn-ghost flex items-center gap-1.5 px-3 h-9 rounded-md text-[13px] text-slate-300">
            {copied ? <Check size={14} className="text-diff-emerald" /> : <Share2 size={14} />} {copied ? 'Copied' : 'Share Solution'}
          </button>
          <button onClick={onNext} className="btn-emerald ml-auto flex items-center gap-1.5 px-4 h-9 rounded-md text-[13px] font-semibold">
            Next Question <ArrowRight size={14} /> <kbd className="font-mono text-[10px] opacity-70">Ctrl+↵</kbd>
          </button>
        </div>
        <p className="mt-2 text-center font-mono text-[10px] text-slate-500">Copy icon — Share copies a result snippet, it does not publish your code.</p>
      </div>
    </div>
  )
}

export function nextUnsolvedInTopic(tracker, topicId, excludeId) {
  try {
    const list = getByTopic(topicId)
    return list.find((p) => p.id !== excludeId && !tracker.isSolved(p.id)) ?? null
  } catch {
    return null
  }
}
