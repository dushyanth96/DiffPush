import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Check, RotateCcw, Zap, RefreshCw, ChevronRight, Users, BadgeCheck, Target } from 'lucide-react'
import { getProblems, searchProblems } from '../../data/curriculum.js'
import { navigate } from '../../data/route.js'

const FILTERS = ['All', 'Arrays', 'Graphs', 'DP', 'Due for Recall']

export function CommandPalette({ tracker, github, onClose }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [cursor, setCursor] = useState(0)
  const [latencyMs, setLatencyMs] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const dueSet = useMemo(() => new Set(tracker.getDueCards()), [tracker])

  const { due, matches, total } = useMemo(() => {
    const t0 = performance.now()
    let problems = []
    try { problems = getProblems() } catch { problems = [] }
    const matchesFilter = (p) => {
      if (filter === 'Due for Recall') return dueSet.has(p.id)
      if (filter === 'All') return true
      const slug = p.topic.toLowerCase()
      if (filter === 'Arrays') return slug.includes('array') || slug.includes('string')
      if (filter === 'Graphs') return slug.includes('graph') || slug.includes('trie')
      if (filter === 'DP') return slug.includes('dynamic') || slug.includes('recursion') || slug.includes('greedy')
      return true
    }
    const q = query.trim()
    const searched = q ? searchProblems(q) : problems.slice(0, 30)
    const matches = searched.filter(matchesFilter).slice(0, 12)
    const due = q ? [] : problems.filter((p) => dueSet.has(p.id) && matchesFilter(p)).slice(0, 5)
    setLatencyMs(Math.round((performance.now() - t0) * 10) / 10)
    return { due, matches, total: problems.length }
  }, [query, filter, dueSet])

  const actions = [
    { id: '__review', label: 'Start Recall Sprint', hint: 'review queue', icon: RotateCcw, run: () => navigate('/review') },
    { id: '__goal', label: 'Change training goal', hint: 'placements faang core target', icon: Target, run: () => { tracker.setGoal(null) } },
    { id: '__room', label: 'Open Study Room', hint: 'friends peers leaderboard', icon: Users, run: () => navigate('/room') },
    ...(github?.profile?.login
      ? [{ id: '__cert', label: 'My certificate', hint: 'resume share proof', icon: BadgeCheck, run: () => navigate(`/u/${github.profile.login}`) }]
      : []),
    { id: '__sync', label: github?.connected ? 'Sync to GitHub' : 'Connect GitHub', hint: 'github sync', icon: RefreshCw, run: () => { window.dispatchEvent(new CustomEvent('builtdiff:connect')) } },
  ].filter((a) => !query.trim() || (`${a.label} ${a.hint}`.toLowerCase().includes(query.trim().toLowerCase())))

  // Flat navigable rows: [type, payload]
  const rows = useMemo(() => [
    ...due.map((p) => ({ kind: 'due', problem: p })),
    ...matches.map((p) => ({ kind: 'match', problem: p })),
    ...actions.map((a) => ({ kind: 'action', action: a })),
  ], [due, matches, actions])

  useEffect(() => { setCursor(0) }, [query, filter])

  const activate = (row) => {
    if (!row) return
    if (row.kind === 'action') { onClose(); row.action.run(); return }
    onClose()
    navigate(`/solve/${row.problem.id}`)
  }

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); activate(rows[cursor]) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center pt-[12vh] px-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }} onClick={onClose}>
      <div
        className="w-full max-w-[640px] h-fit max-h-[70vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: '#0D111A', border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKey}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0">
          <Search size={16} className="text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 369 problems, patterns (e.g. 'monotonic stack'), or topics..."
            className="flex-1 bg-transparent outline-none text-[14px] text-slate-100 placeholder:text-slate-500"
          />
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-raised hairline text-slate-400 shrink-0">ESC</kbd>
        </div>

        <div className="flex gap-1.5 px-3 py-2 border-b border-border overflow-x-auto shrink-0">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-2.5 h-7 rounded-full text-[12px] font-medium transition-colors ${filter === f ? 'bg-diff-emerald/15 text-diff-emerald border border-diff-emerald/30' : 'text-slate-500 hover:text-slate-300 hairline'}`}
            >
              {f}{f === 'All' ? ` (${total})` : f === 'Due for Recall' ? ` (${dueSet.size})` : ''}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto py-1.5 min-h-0">
          {rows.length === 0 && <p className="px-4 py-6 text-center text-[13px] text-slate-500">No matches — try a tag like 'sliding-window'.</p>}
          {due.length > 0 && <p className="eyebrow px-4 pt-1 pb-0.5">RECENT & DUE FOR RECALL</p>}
          {due.map((p) => (
            <PaletteRow key={`due-${p.id}`} problem={p} tracker={tracker} active={rows[cursor]?.kind === 'due' && rows[cursor]?.problem?.id === p.id} onPick={() => activate({ kind: 'due', problem: p })} badge="DUE" />
          ))}
          {matches.length > 0 && <p className="eyebrow px-4 pt-2 pb-0.5">MATCHING PROBLEMS</p>}
          {matches.map((p) => (
            <PaletteRow key={`m-${p.id}`} problem={p} tracker={tracker} active={rows[cursor]?.kind === 'match' && rows[cursor]?.problem?.id === p.id} onPick={() => activate({ kind: 'match', problem: p })} />
          ))}
          {actions.length > 0 && <p className="eyebrow px-4 pt-2 pb-0.5">QUICK ACTIONS</p>}
          {actions.map((a) => {
            const Icon = a.icon
            const idx = rows.findIndex((r) => r.kind === 'action' && r.action.id === a.id)
            return (
              <button key={a.id} onClick={() => activate({ kind: 'action', action: a })} className={`w-full flex items-center gap-2.5 px-4 py-2 text-left border-l-2 ${idx === cursor ? 'bg-raised border-diff-emerald' : 'border-transparent'}`}>
                <Icon size={14} className="text-diff-amber shrink-0" />
                <span className="text-[13px] text-slate-200">{a.label}</span>
                <ChevronRight size={13} className="ml-auto text-slate-600" />
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3 px-4 h-9 border-t border-border shrink-0 font-mono text-[10px] text-slate-500">
          <span>↑↓ Navigate</span><span>↵ Select</span><span>esc Dismiss</span>
          <span className="ml-auto">Indexed: {total} Problems ({latencyMs}ms)</span>
        </div>
      </div>
    </div>
  )
}

function PaletteRow({ problem: p, tracker, active, onPick, badge }) {
  const solved = tracker.isSolved(p.id)
  return (
    <button onClick={onPick} className={`w-full flex items-center gap-2.5 px-4 py-2 text-left border-l-2 ${active ? 'bg-raised border-diff-emerald' : 'border-transparent'}`}>
      {solved ? <Check size={14} className="text-diff-emerald shrink-0" strokeWidth={3} /> : <Zap size={13} className="text-slate-600 shrink-0" />}
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] text-slate-200 truncate">{p.canonicalTitle ?? p.id}</span>
        <span className="block text-[11px] text-slate-500 truncate">{p.topicName} · {p.levelName} · {p.optimalTime}</span>
      </span>
      {badge && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-diff-amber/10 text-diff-amber border border-diff-amber/30 shrink-0">{badge}</span>}
      <span className="font-mono text-[10px] text-slate-500 shrink-0 hidden sm:inline">{p.difficulty}</span>
    </button>
  )
}
