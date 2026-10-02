import React from 'react'
import { Github, Cpu, GitCommitHorizontal, Repeat, ArrowRight, Coffee, Star } from 'lucide-react'
import { Logo } from '../layout/Logo.jsx'
import { SUPPORT_LINKS } from '../../data/support.js'
import { REPO_URL } from '../../data/repo.js'

const CTA_LABEL = 'Connect with GitHub'

export function LandingPage({ onConnect, onGuest }) {
  return (
    <div className="min-h-screen bg-canvas text-slate-200 flex flex-col">
      <header className="h-16 px-4 sm:px-5 flex items-center gap-2 border-b border-border max-w-[1100px] w-full mx-auto">
        <Logo />
        <span className="pill px-1.5 py-px text-[10px] font-mono text-slate-500">v1.0</span>
        <button onClick={onConnect} className="btn-emerald ml-auto px-4 h-8 rounded-md text-[13px] font-semibold">
          {CTA_LABEL}
        </button>
      </header>

      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4">
        {/* hero: manifesto + proof visual */}
        <section className="text-center pt-16 pb-12">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-surface hairline font-mono text-[11px] text-slate-300 hover:text-slate-100 hover:border-diff-amber/40 transition-colors"
          >
            <Star size={11} className="text-diff-amber" fill="currentColor" />
            <span>Open-Source A2Z DSA Tracker &amp; IDE</span>
            <span className="text-slate-500">— Star on GitHub ↗</span>
          </a>
          <p className="eyebrow mt-4">369 problems · 16 topics · zero setup</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-slate-100 leading-[1.1]">
            Master the A2Z DSA Sheet.<br />Farm Green Squares.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400 max-w-[600px] mx-auto">
            369 interview problems that run in your browser. Pass one, and the solution lands on your GitHub by itself.
          </p>
          <div className="mt-7">
            <button onClick={onConnect} className="btn-emerald inline-flex items-center gap-2.5 px-7 h-12 rounded-lg text-[15px] font-semibold">
              <Github size={19} /> {CTA_LABEL}
            </button>
            <p className="mt-3">
              <button onClick={onGuest} className="font-mono text-[12px] text-slate-500 hover:text-slate-400 transition-colors">
                or explore the offline demo →
              </button>
            </p>
          </div>
        </section>

        {/* product proof: real mini-UI, not a mockup */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-14">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-1.5 px-3.5 h-9 border-b border-border">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A2333]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A2333]" />
              <span className="w-2.5 h-2.5 rounded-full bg-diff-emerald/70" />
              <span className="ml-2 font-mono text-[11px] text-slate-500">solution.py — two-sum</span>
            </div>
            <pre className="p-4 font-mono text-[12px] leading-[1.7] text-slate-300 overflow-x-auto" aria-label="Example solve session">
              <span className="text-slate-600">▶ run — 3 cases, in your browser</span>{'\n'}
              <span className="text-diff-emerald">✓ case 1 · 0.31ms{'\n'}✓ case 2 · 0.28ms{'\n'}✓ case 3 · 0.35ms</span>{'\n'}
              <span className="text-slate-200">→ committed <span className="text-diff-emerald">#a1b2c3d</span> to you/builtdiff-solutions</span>
            </pre>
          </div>
          <div className="card p-5 flex flex-col justify-center">
            <p className="text-[14px] font-semibold tracking-tight text-slate-100">Each solve plants a square.</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-400">Squares compound into the portfolio recruiters actually open.</p>
            <div className="mt-4 flex gap-[3px]" aria-hidden="true">
              {Array.from({ length: 28 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-4 h-4 rounded-sm ${i % 4 === 3 ? 'bg-[#0D111A] border border-white/10' : 'bg-emerald-500'}`}
                />
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px] text-slate-500">illustration — your grid fills as you solve</p>
          </div>
        </section>

        {/* how it works */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-14">
          {[
            ['01', 'Solve in-browser', 'Pick a problem. Code against real test cases executed by WebAssembly — no setup, no server queue.'],
            ['02', 'Auto-commit on green', 'All cases pass and your solution pushes to your repo with its Big-O stamped in the message.'],
            ['03', 'Recall on schedule', 'Leitner boxes resurface each pattern at 1/3/7/14/30 days so it survives until interview day.'],
          ].map(([n, title, body]) => (
            <div key={n}>
              <p className="font-mono text-[13px] font-bold text-diff-emerald tnum">{n}</p>
              <h2 className="mt-1.5 text-[15px] font-bold tracking-tight text-slate-100">{title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{body}</p>
            </div>
          ))}
        </section>

        {/* bento: asymmetric rhythm, mono schematics */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-14">
          <div className="card p-5 md:row-span-2 flex flex-col">
            <span className="w-9 h-9 rounded-md bg-raised hairline flex items-center justify-center">
              <Cpu size={17} className="text-diff-emerald" />
            </span>
            <h2 className="mt-3 text-[15px] font-bold tracking-tight text-slate-100">Zero Server Latency</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">Your code compiles and runs in your browser — nothing leaves your machine until the commit.</p>
            <pre className="mt-auto pt-4 font-mono text-[12px] leading-relaxed text-slate-300 overflow-x-auto">
              <span className="text-slate-600">▶ run solution.py</span>{'\n'}<span className="text-diff-emerald">3/3 passed · 0.4ms · local</span>
            </pre>
          </div>
          <div className="card p-5">
            <span className="w-9 h-9 rounded-md bg-raised hairline flex items-center justify-center">
              <GitCommitHorizontal size={17} className="text-diff-emerald" />
            </span>
            <h2 className="mt-3 text-[15px] font-bold tracking-tight text-slate-100">Contribution Farming</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">Every solve pushes straight to <span className="font-mono text-slate-300">username/builtdiff-solutions</span>.</p>
            <p className="mt-2 font-mono text-[12px] text-diff-emerald">feat(arrays): solve two-sum ✓ #a1b2c3d</p>
          </div>
          <div className="card p-5">
            <span className="w-9 h-9 rounded-md bg-raised hairline flex items-center justify-center">
              <Repeat size={17} className="text-diff-emerald" />
            </span>
            <h2 className="mt-3 text-[15px] font-bold tracking-tight text-slate-100">Spaced Repetition</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">A built-in Leitner system schedules recall so patterns stick permanently.</p>
            <p className="mt-2 font-mono text-[12px] text-slate-400">Box 3 · due in <span className="text-slate-200">7d</span> · +250 DIFF on recall</p>
          </div>
        </section>

        {/* closing band */}
        <section className="card p-8 sm:p-10 text-center mb-14">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">Your GitHub is your resume. Start filling it.</h2>
          <button onClick={onConnect} className="btn-emerald mt-5 inline-flex items-center gap-2 px-6 h-11 rounded-lg text-[14px] font-semibold">
            {CTA_LABEL} <ArrowRight size={16} />
          </button>
        </section>
        {/* support strip */}
        <section className="card p-6 sm:p-8 mb-14 flex flex-col sm:flex-row items-center gap-4">
          <div className="text-center sm:text-left">
            <h2 className="text-[16px] font-bold tracking-tight text-slate-100">Free for every student, forever.</h2>
            <p className="mt-1 text-[13px] text-slate-400">If BuiltDiff gets you placed, fuel the next all-nighter — chai via UPI in India.</p>
          </div>
          <div className="flex gap-2 sm:ml-auto shrink-0">
            <a
              href={SUPPORT_LINKS.chai}
              target="_blank"
              rel="noreferrer"
              title="For India — pay via UPI"
              className="btn-ghost flex items-center gap-2 px-4 h-10 rounded-md text-[13px] font-medium text-slate-200"
            >
              <Coffee size={15} className="text-orange-400" /> Chai <span className="font-mono text-[10px] text-slate-500">UPI</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-[1100px] mx-auto px-4 py-5 flex flex-col sm:flex-row items-center gap-3">
          <p className="text-[12px] text-slate-500">Built for engineers. Open source sync engine.</p>
          <nav className="sm:ml-auto flex items-center gap-4 text-[12px] text-slate-500">
            <a href="#twitter" title="Twitter (link TBD)" className="hover:text-slate-300 transition-colors">Twitter</a>
            <a href="#github" title="GitHub repo (link TBD)" className="hover:text-slate-300 transition-colors">GitHub Repo</a>
            <a href="#privacy" title="Privacy (link TBD)" className="hover:text-slate-300 transition-colors">Privacy</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
