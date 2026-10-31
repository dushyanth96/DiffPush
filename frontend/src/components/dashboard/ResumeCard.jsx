import React from 'react'
import { ArrowRight, Play, Clock } from 'lucide-react'
import { getProblemMeta } from '../../data/curriculum.js'
import { lastOpenedSlug } from '../../data/resume.js'

const DIFF_STYLE = {
  Easy: 'text-diff-emerald border-diff-emerald/30 bg-diff-emerald/10',
  Medium: 'text-diff-amber border-diff-amber/30 bg-diff-amber/10',
  Hard: 'text-diff-rose border-diff-rose/30 bg-diff-rose/10',
}

// "Continue where I left off" — the exact problem this device last ran.
// Hidden for first-time visitors, solved problems, and any stale slug.
export function ResumeCard({ tracker }) {
  const slug = lastOpenedSlug()
  if (!slug || tracker.isSolved(slug)) return null

  let meta = null
  try { meta = getProblemMeta(slug) } catch { meta = null }
  if (!meta) return null

  return (
    <a
      href={`/solve/${slug}`}
      className="card card-hover flex items-center gap-3 p-3.5 group"
    >
      <span className="w-9 h-9 rounded-md bg-diff-emerald/10 hairline flex items-center justify-center shrink-0">
        <Play size={15} className="text-diff-emerald" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500">Continue where you left off</span>
        <span className="block text-[13px] font-semibold text-slate-100 truncate">{meta.canonicalTitle}</span>
        <span className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[9.5px] font-mono px-1.5 py-px rounded border ${DIFF_STYLE[meta.difficultyRaw] ?? 'text-slate-400 border-border'}`}>
            {meta.difficultyRaw ?? meta.difficulty}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500">
            <Clock size={10} /> {meta.optimalTime}
          </span>
          <span className="font-mono text-[10px] text-slate-600 truncate">{meta.topicName}</span>
        </span>
      </span>
      <span className="shrink-0 flex items-center gap-1 text-[12px] font-medium text-diff-emerald">
        Resume <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
  )
}
