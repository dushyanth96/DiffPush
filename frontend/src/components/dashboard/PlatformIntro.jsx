import React from 'react'
import { REPO_URL } from '../../data/repo.js'

export function PlatformIntro() {
  return (
    <section className="relative overflow-hidden rounded-lg bg-surface border border-white/10 px-5 py-4">
      {/* restrained emerald wash, top-left corner only */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(16,185,129,0.10), transparent)' }}
      />
      <p className="relative font-mono text-[11px] tracking-wider text-diff-emerald">OPEN-SOURCE A2Z ENGINE</p>
      <h1 className="relative mt-1 text-[16px] font-bold tracking-tight text-slate-100">
        A2Z DSA Sheet: Interactive Execution &amp; Tracker
      </h1>
      <p className="relative mt-1 text-[13px] leading-relaxed text-slate-400 max-w-3xl">
        The complete A2Z algorithmic curriculum with zero-latency browser execution, automated GitHub
        commit syncing, and Leitner spaced repetition. 100% open-source and local-first.
      </p>
      <div className="relative mt-2.5 flex gap-1.5 flex-wrap">
        {['A2Z Curriculum Complete', '100% Open Source (MIT)', 'Client-Side WASM'].map((label) => (
          <span key={label} className="px-2 py-0.5 rounded-md font-mono text-[10px] text-slate-400 bg-raised hairline">
            {label}
          </span>
        ))}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="px-2 py-0.5 rounded-md font-mono text-[10px] text-diff-amber bg-diff-amber/10 border border-diff-amber/30 hover:bg-diff-amber/20 transition-colors"
        >
          ★ Star the repo
        </a>
      </div>
    </section>
  )
}
