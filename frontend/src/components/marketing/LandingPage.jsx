import React from 'react'
import { Github, Cpu, GitCommitHorizontal, Repeat, ArrowRight, Coffee, Star, Play, ShieldCheck } from 'lucide-react'
import { Logo } from '../layout/Logo.jsx'
import { SUPPORT_LINKS } from '../../data/support.js'
import { REPO_URL } from '../../data/repo.js'
import { readLocalSolvedCount, readLocalTracker, resumeTarget } from '../../data/resume.js'
import { getProblemMeta } from '../../data/curriculum.js'
import { track } from '../../lib/analytics.js'

const X_URL = 'https://x.com/dushyanth168'

export function LandingPage({ onConnect, onStart }) {
  const connect = (cta) => {
    track('cta_click', { cta })
    onConnect()
  }
  const start = (source) => {
    track('start_solving', { source })
    onStart()
  }

  // Returning device: show the resume card before asking anyone to sign in.
  const solvedCount = readLocalSolvedCount()
  const localState = readLocalTracker()
  const resumeSlug = solvedCount > 0
    ? resumeTarget({ goal: localState?.goal ?? null, isSolved: (id) => Boolean(localState?.solvedMap?.[id]) })
    : null
  const resumeTitle = (() => {
    if (!resumeSlug) return null
    try { return getProblemMeta(resumeSlug)?.canonicalTitle ?? resumeSlug } catch { return resumeSlug }
  })()

  return (
    <div className="relative isolate overflow-hidden min-h-screen bg-canvas text-slate-200 flex flex-col">
      {/* atmosphere: absolute and paint-only, so it never affects layout, clicks, or screen readers */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[820px] -z-10">
        <span className="hero-aurora hero-aurora--emerald" />
        <span className="hero-aurora hero-aurora--indigo" />
        <span className="hero-dots" />
      </div>
      <header className="h-16 px-4 sm:px-5 flex items-center gap-2 border-b border-border max-w-[1100px] w-full mx-auto">
        <Logo />
        <span className="pill px-1.5 py-px text-[10px] font-mono text-slate-400">v1.0</span>
        <button onClick={() => start('header')} className="btn-emerald ml-auto px-4 h-8 rounded-md text-[13px] font-semibold">
          Start solving
        </button>
      </header>

      <main className="flex-1 w-full max-w-[1100px] mx-auto px-4">
        {/* hero: one action, one promise */}
        <section className="text-center pt-16 pb-12">
          {solvedCount > 0 && resumeTitle ? (
            <div className="card mx-auto mb-6 max-w-[560px] p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-left border-diff-emerald/40">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-md bg-diff-emerald/10 hairline flex items-center justify-center shrink-0">
                  <Play size={15} className="text-diff-emerald" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-100">
                    Welcome back — {solvedCount} problem{solvedCount === 1 ? '' : 's'} solved on this device
                  </p>
                  <p className="text-[12px] text-slate-500 truncate">Next up: {resumeTitle}</p>
                </div>
              </div>
              <button onClick={() => start('resume_card')} className="btn-emerald w-full sm:w-auto sm:ml-auto shrink-0 px-3.5 h-8 rounded-md text-[12px] font-semibold">
                Continue
              </button>
            </div>
          ) : (
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-surface hairline font-mono text-[11px] text-slate-300 hover:text-slate-100 hover:border-diff-amber/40 transition-colors"
            >
              <Star size={11} className="text-diff-amber" fill="currentColor" />
              <span>A2Z DSA Tracker &amp; IDE</span>
              <span className="text-slate-400">— Star on GitHub ↗</span>
            </a>
          )}
          <p className="eyebrow mt-4">A2Z DSA tracker · in-browser IDE</p>
          <h1
            className="mt-3 max-w-[760px] mx-auto text-[30px] sm:text-5xl font-bold tracking-tight text-slate-100 leading-[1.12] sm:leading-[1.1]"
            style={{ textWrap: 'balance' }}
          >
            Finish the A2Z sheet.<br />Ship the proof to GitHub.
          </h1>
          <p
            className="mt-4 text-[15px] leading-relaxed text-slate-400 max-w-[620px] mx-auto"
            style={{ textWrap: 'balance' }}
          >
            369 interview problems with real tests that run in your browser. Submit when green, review the commit before it
            lands, and let spaced recall keep it sharp.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3">
            <button onClick={() => start('hero')} className="btn-emerald btn-emerald-hero inline-flex items-center gap-2.5 px-8 h-12 rounded-lg text-[15px] font-semibold">
              <Play size={18} /> Start solving — free, no account
            </button>
            <button
              onClick={() => connect('hero_github')}
              className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Github size={13} /> Connect GitHub to publish solutions
            </button>
          </div>
          <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono text-[11px] text-slate-500">
            <span>369 problems</span>
            <span className="text-slate-700">·</span>
            <span>16 topics</span>
            <span className="text-slate-700">·</span>
            <span>runs locally</span>
            <span className="text-slate-700">·</span>
            <span>0 setup</span>
          </p>
          <p
            className="mt-3 text-center text-[12px] text-slate-500 max-w-[680px] mx-auto"
            style={{ textWrap: 'balance' }}
          >
            <ShieldCheck size={13} className="inline-block mr-1 align-[-2px] text-slate-500" />
            No account needed. Progress lives in this browser — export a backup before clearing site data.
          </p>
          <p className="mt-4 text-[12px] text-slate-500">
            <a href="/a2z-dsa-sheet/" className="text-diff-emerald hover:underline">Browse the full A2Z DSA sheet</a>
            <span className="mx-2 text-slate-700">·</span>
            <a href="/leetcode-alternative/" className="text-diff-emerald hover:underline">DiffPush vs LeetCode</a>
          </p>
        </section>

        {/* product proof: real mini-UI, not a mockup */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-14">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-1.5 px-3.5 h-9 border-b border-border">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A2333]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A2333]" />
              <span className="w-2.5 h-2.5 rounded-full bg-diff-emerald/70" />
              <span className="ml-2 font-mono text-[11px] text-slate-400">solution.py — two-sum</span>
            </div>
            <pre className="p-4 font-mono text-[12px] leading-[1.7] text-slate-300 overflow-x-auto" aria-label="Example solve session">
              <span className="text-slate-400">▶ run — 3 cases, in your browser</span>{'\n'}
              <span className="text-diff-emerald">✓ case 1 · 0.31ms{'\n'}✓ case 2 · 0.28ms{'\n'}✓ case 3 · 0.35ms</span>{'\n'}
              <span className="text-slate-200">→ commit preview: you/diffpush-solutions/arrays/001_two-sum.py</span>
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
            <p className="mt-2 font-mono text-[10px] text-slate-400">illustration — your grid fills as you solve</p>
          </div>
        </section>

        {/* how it works */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-14">
          {[
            ['01', 'Solve in-browser', 'Pick a problem. Code against real test cases executed by WebAssembly — no setup, no server queue.'],
            ['02', 'Submit when green', 'All cases pass, then one click marks it solved. Your GitHub commit is previewed — repo, file, diff — before anything is pushed.'],
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
              <span className="text-slate-400">▶ run solution.py</span>{'\n'}<span className="text-diff-emerald">3/3 passed · 0.4ms · local</span>
            </pre>
          </div>
          <div className="card p-5">
            <span className="w-9 h-9 rounded-md bg-raised hairline flex items-center justify-center">
              <GitCommitHorizontal size={17} className="text-diff-emerald" />
            </span>
            <h2 className="mt-3 text-[15px] font-bold tracking-tight text-slate-100">Contribution Farming</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">Every reviewed solve lands in <span className="font-mono text-slate-300">username/diffpush-solutions</span>.</p>
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

        {/* FAQ: visible answers double as the homepage FAQPage schema */}
        <section className="pb-14">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">Questions, answered</h2>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {[
              ['Is DiffPush free?', 'Yes. DiffPush is free for students and non-commercial study. Guest mode works without an account, and ads can be blocked without losing features.'],
              ['Is it affiliated with LeetCode?', 'No. DiffPush is an independent A2Z DSA sheet tracker. Problem titles reference canonical interview problems, but explanations, tests, and execution are DiffPush’s own.'],
              ['Where does my code run?', 'Python 3.11 runs in your browser through Pyodide/WebAssembly and JavaScript runs in a local Web Worker. Java 17 and C++20 use a shared remote compiler.'],
              ['Does it push to GitHub?', 'Optionally. Connect GitHub once, then commit any accepted solution to your own diffpush-solutions repository — you see the repo, file path, and diff before anything is pushed.'],
              ['How many problems are included?', '369 problems across 16 topics: arrays, binary search, strings, linked lists, recursion, bit manipulation, stacks and queues, sliding window, heaps, greedy, trees, BSTs, graphs, DP, tries, and advanced strings.'],
              ['How does spaced repetition work?', 'Solved problems enter a Leitner queue. Correct reviews move a problem to longer intervals; misses bring it back sooner so weak patterns resurface before interview day.'],
            ].map(([q, a]) => (
              <div key={q}>
                <h3 className="text-[14px] font-semibold text-slate-100">{q}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* closing band */}
        <section className="card p-8 sm:p-10 text-center mb-14">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">Your GitHub is your resume. Start filling it.</h2>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => start('closing')} className="btn-emerald inline-flex items-center gap-2 px-6 h-11 rounded-lg text-[14px] font-semibold">
              Start solving <ArrowRight size={16} />
            </button>
            <button onClick={() => connect('closing_github')} className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-200 transition-colors">
              <Github size={13} /> Connect GitHub instead
            </button>
          </div>
        </section>
        {/* support strip */}
        <section className="card p-6 sm:p-8 mb-14 flex flex-col sm:flex-row items-center gap-4">
          <div className="text-center sm:text-left">
            <h2 className="text-[16px] font-bold tracking-tight text-slate-100">Free for every student, forever.</h2>
            <p className="mt-1 text-[13px] text-slate-400">If DiffPush gets you placed, fuel the next all-nighter — chai via UPI in India.</p>
          </div>
          <div className="flex gap-2 sm:ml-auto shrink-0">
            <a
              href={SUPPORT_LINKS.chai}
              target="_blank"
              rel="noreferrer"
              title="For India — pay via UPI"
              className="btn-ghost flex items-center gap-2 px-4 h-10 rounded-md text-[13px] font-medium text-slate-200"
            >
              <Coffee size={15} className="text-orange-400" /> Chai <span className="font-mono text-[10px] text-slate-400">UPI</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-[1100px] mx-auto px-4 py-5 flex flex-col sm:flex-row items-center gap-3">
          <p className="text-[12px] text-slate-400">Built for engineers. Source-available, free for students.</p>
          <nav className="sm:ml-auto flex flex-wrap items-center gap-4 text-[12px] text-slate-400">
            <a href="/a2z-dsa-sheet/" className="hover:text-slate-300 transition-colors">A2Z sheet</a>
            <a href="/leetcode-alternative/" className="hover:text-slate-300 transition-colors">vs LeetCode</a>
            <a href="/about/" className="hover:text-slate-300 transition-colors">About</a>
            <a href="/faq/" className="hover:text-slate-300 transition-colors">Student FAQ</a>
            <a href={X_URL} target="_blank" rel="noreferrer" className="hover:text-slate-300 transition-colors">X / Twitter</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-slate-300 transition-colors">GitHub Repo</a>
            <a href="/privacy/" className="hover:text-slate-300 transition-colors">Privacy</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
