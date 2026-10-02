import React, { useMemo, useState, Fragment } from 'react'
import { Check, ChevronDown, ChevronRight, Star, Circle } from 'lucide-react'
import { getTopics, getByTopic, getProblemMeta } from '../../data/curriculum.js'
import { FIRST_BLOOD_PATHS, GOALS } from '../../hooks/useTracker.js'
import { SlimAdSlot } from '../layout/AmbientAdSlot.jsx'
import { PrepWorkCard } from './PrepWorkCard.jsx'

const DIFF_STYLE = {
  Easy: 'text-diff-emerald border-diff-emerald/30 bg-diff-emerald/10',
  Medium: 'text-diff-amber border-diff-amber/30 bg-diff-amber/10',
  Hard: 'text-diff-rose border-diff-rose/30 bg-diff-rose/10',
}
const DIFF_SHORT = { Easy: 'Easy', Medium: 'Medium', Hard: 'Hard' }

const TABS = ['All 16 Topics', 'In Progress', 'Needs Recall', 'Starred']

function FirstBloodCard({ tracker }) {
  const path = FIRST_BLOOD_PATHS[tracker.goal] ?? FIRST_BLOOD_PATHS.placements
  const goalName = GOALS[tracker.goal]?.name ?? GOALS.placements.name
  const next = path.find((id) => !tracker.isSolved(id))
  return (
    <div className="card p-5 mb-3 border-diff-emerald/40" style={{ boxShadow: 'inset 0 1px 0 rgba(16,185,129,0.25)' }}>
      <p className="eyebrow" style={{ color: '#10B981' }}>Start here · {goalName} path</p>
      <p className="mt-1.5 text-[15px] font-bold tracking-tight text-slate-100">First Blood Path</p>
      <p className="mt-0.5 text-[13px] text-slate-400">Five hand-picked Easies. Finish them and your GitHub is already talking.</p>
      <ol className="mt-3 space-y-1.5">
        {path.map((id, i) => {
          let meta = null
          try { meta = getProblemMeta(id) } catch { meta = null }
          const done = tracker.isSolved(id)
          const isNext = id === next
          return (
            <li key={id}>
              <a
                href={`#/solve/${id}`}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors ${isNext ? 'bg-raised hairline' : 'hover:bg-raised'}`}
              >
                <span className={`font-mono text-[11px] w-5 ${done ? 'text-diff-emerald' : isNext ? 'text-slate-200' : 'text-slate-600'}`}>
                  {done ? '✓' : `0${i + 1}`}
                </span>
                <span className={`text-[13px] ${done ? 'text-slate-500 line-through' : isNext ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                  {meta?.canonicalTitle ?? id}
                </span>
                {isNext && <span className="ml-auto font-mono text-[10px] text-diff-emerald">NEXT →</span>}
              </a>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function ProblemRow({ p, tracker }) {
  const solved = tracker.isSolved(p.id)
  const starred = tracker.starredIds.includes(p.id)
  const due = !solved && tracker.reviewQueue.includes(p.id)
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-raised transition-colors group">
      <span className="shrink-0 w-4 flex justify-center" title={solved ? 'Solved' : due ? 'Due for recall' : 'Unsolved'}>
        {solved
          ? <Check size={15} className="text-diff-emerald" strokeWidth={3} />
          : due
            ? <span className="w-2.5 h-2.5 rounded-full bg-diff-amber inline-block" />
            : <Circle size={14} className="text-slate-600" />}
      </span>
      <div className="flex-1 min-w-0">
        <a href={`#/solve/${p.id}`} className="block text-[13px] font-medium text-slate-200 truncate hover:text-diff-emerald transition-colors">
          {p.canonicalTitle ?? p.id}
        </a>
        <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug">{p.title}</p>
      </div>
      <span className={`hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border ${DIFF_STYLE[p.difficultyRaw] ?? 'text-slate-400 border-border'}`}>
        {DIFF_SHORT[p.difficultyRaw] ?? p.difficulty}
      </span>
      <span className="hidden md:inline-block font-mono text-[11px] text-slate-500">{p.optimalTime}</span>
      <button
        onClick={() => tracker.toggleStar(p.id)}
        className="shrink-0 text-slate-600 hover:text-diff-amber transition-colors"
        title={starred ? 'Unstar' : 'Star for recall deck'}
        aria-label={starred ? `Unstar ${p.canonicalTitle ?? p.id}` : `Star ${p.canonicalTitle ?? p.id}`}
        aria-pressed={starred}
      >
        <Star size={14} fill={starred ? '#F59E0B' : 'none'} className={starred ? 'text-diff-amber' : ''} />
      </button>
      <a
        href={`#/solve/${p.id}`}
        tabIndex={-1}
        aria-hidden="true"
        className="shrink-0 text-slate-600 hover:text-diff-emerald transition-colors"
      >
        <ChevronRight size={15} />
      </a>
    </div>
  )
}

function TopicAccordion({ topic, tracker }) {
  const [open, setOpen] = useState(false)
  const [openLevel, setOpenLevel] = useState(null) // one expanded level at a time
  const [showAll, setShowAll] = useState(false)
  const problems = useMemo(() => getByTopic(topic.id), [topic.id])
  const solved = problems.filter((p) => tracker.isSolved(p.id)).length
  const pct = problems.length ? Math.round((solved / problems.length) * 100) : 0
  const mastered = problems.length > 0 && solved === problems.length

  // Group rows by curriculum level folder (Learn → Drill → Hard path).
  const levels = useMemo(() => {
    const map = new Map()
    for (const p of problems) {
      const key = p.level ?? 'general'
      if (!map.has(key)) map.set(key, { name: p.levelName ?? key, order: p.levelOrder ?? 999, items: [] })
      map.get(key).items.push(p)
    }
    return [...map.values()].sort((a, b) => a.order - b.order)
  }, [problems])

  const diffCount = (raw) => {
    const inDiff = problems.filter((p) => p.difficultyRaw === raw)
    return [inDiff.filter((p) => tracker.isSolved(p.id)).length, inDiff.length]
  }
  const [eS, eT] = diffCount('Easy')
  const [mS, mT] = diffCount('Medium')
  const [hS, hT] = diffCount('Hard')

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="relative w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-raised transition-colors overflow-hidden">
        {/* header progress fill */}
        <span className="absolute inset-y-0 left-0 bg-diff-emerald/10 pointer-events-none" style={{ width: `${pct}%` }} />
        {open ? <ChevronDown size={15} className="text-slate-500 shrink-0 relative" /> : <ChevronRight size={15} className="text-slate-500 shrink-0 relative" />}
        <span className="font-mono text-[12px] text-slate-500 shrink-0 relative">{topic.id.split('-')[0]}</span>
        <h2 className="text-sm font-semibold tracking-tight text-slate-100 truncate relative">{topic.name}</h2>
        {mastered && (
          <span className="relative shrink-0 px-1.5 py-px rounded-md font-mono text-[10px] font-bold tracking-[0.12em] text-[#04120C] bg-diff-amber">
            MASTERED
          </span>
        )}
        <span className="pill ml-auto shrink-0 px-2 py-px font-mono text-[11px] text-slate-400 relative">{solved}/{problems.length} Solved</span>
        <span className="hidden sm:block w-20 h-1.5 rounded-full bg-[#1A2333] overflow-hidden shrink-0 relative">
          <span className="block h-full bg-diff-emerald rounded-full" style={{ width: `${pct}%` }} />
        </span>
      </button>
      {open && (
        <div className="px-2 pb-2 border-t border-border pt-1">
          <p className="px-3 pt-2 font-mono text-[10px] text-slate-500">
            Easy: {eS}/{eT} <span className="text-slate-700">|</span> Medium: {mS}/{mT} <span className="text-slate-700">|</span> Hard: {hS}/{hT}
          </p>
          {levels.map((lv, li) => {
            const lvSolved = lv.items.filter((p) => tracker.isSolved(p.id)).length
            const expanded = openLevel === lv.name
            const visible = expanded ? (showAll ? lv.items : lv.items.slice(0, 5)) : []
            return (
              <div key={lv.name} className="border-b border-border/50 last:border-0">
                <button
                  onClick={() => { setOpenLevel(expanded ? null : lv.name); setShowAll(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-raised rounded-md transition-colors"
                >
                  {expanded
                    ? <ChevronDown size={13} className="text-slate-500 shrink-0" />
                    : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
                  <span className="font-mono text-[10px] text-slate-500">L{li + 1}</span>
                  <span className="text-[12px] font-semibold tracking-wide text-slate-300 uppercase">{lv.name}</span>
                  <span className="font-mono text-[10px] text-slate-500 ml-auto">{lvSolved}/{lv.items.length}</span>
                  <span className="w-14 h-1 rounded-full bg-[#1A2333] overflow-hidden shrink-0">
                    <span className="block h-full bg-diff-emerald/70 rounded-full" style={{ width: `${lv.items.length ? (lvSolved / lv.items.length) * 100 : 0}%` }} />
                  </span>
                </button>
                {expanded && (
                  <div className="pb-1">
                    {visible.map((p) => <ProblemRow key={p.id} p={p} tracker={tracker} />)}
                    {lv.items.length > 5 && (
                      <button
                        onClick={() => setShowAll((s) => !s)}
                        className="w-full mt-1 px-3 py-1.5 rounded-md text-[12px] font-medium text-slate-400 hover:text-diff-emerald hover:bg-raised transition-colors"
                      >
                        {showAll ? 'Show less' : `Load more (${lv.items.length - 5} remaining)`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CurriculumDirectory({ tracker }) {
  const [tab, setTab] = useState(TABS[0])
  const topics = useMemo(() => getTopics(), [])

  const visibleTopics = useMemo(() => {
    if (tab === 'Starred') {
      const starred = new Set(tracker.starredIds)
      return topics.filter((t) => getByTopic(t.id).some((p) => starred.has(p.id)))
    }
    if (tab === 'Needs Recall') {
      const due = new Set(tracker.reviewQueue)
      return topics.filter((t) => getByTopic(t.id).some((p) => due.has(p.id)))
    }
    if (tab === 'In Progress') {
      return topics.filter((t) => {
        const ps = getByTopic(t.id)
        const s = ps.filter((p) => tracker.isSolved(p.id)).length
        return s > 0 && s < ps.length
      })
    }
    return topics
  }, [tab, topics, tracker.starredIds, tracker.reviewQueue, tracker.solvedMap])

  return (
    <div>
      {tracker.getCompletionStats().totalSolved === 0 && (
        <FirstBloodCard tracker={tracker} />
      )}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-3 h-8 rounded-md text-[13px] font-medium transition-colors ${
              tab === t ? 'bg-raised text-slate-100 hairline' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-2.5">
        <PrepWorkCard />
        {visibleTopics.map((t, i) => (
          <Fragment key={t.id}>
            <TopicAccordion topic={t} tracker={tracker} />
            {(i + 1) % 6 === 0 && i + 1 < visibleTopics.length && <SlimAdSlot />}
          </Fragment>
        ))}
        {visibleTopics.length === 0 && (
          <div className="card p-8 text-center text-[13px] text-slate-500">Nothing here yet — solve or star problems to fill this view.</div>
        )}
      </div>
    </div>
  )
}
