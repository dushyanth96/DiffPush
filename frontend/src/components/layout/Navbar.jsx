import React, { useEffect, useRef, useState } from 'react'
import { Search, Flame, Github, RefreshCw, LogOut, ExternalLink, Zap, Users, Star } from 'lucide-react'
import { Logo } from './Logo.jsx'
import { REPO_URL } from '../../data/repo.js'
import { navigate } from '../../data/route.js'

const MOD_KEY = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform ?? '') ? 'Cmd' : 'Ctrl'

export function Navbar({ tracker, github, onPalette, onConnect }) {
  const { stats, getCompletionStats } = tracker
  const completion = getCompletionStats()
  const total = 369
  const [showProfile, setShowProfile] = useState(false)
  const combo = tracker.getCombo()
  const profileRef = useRef(null)

  // Dismiss the profile popover on Esc or outside click; return focus to avatar.
  useEffect(() => {
    if (!showProfile) return
    const onKey = (e) => { if (e.key === 'Escape') setShowProfile(false) }
    const onDown = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [showProfile])

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-canvas/95 backdrop-blur border-b border-border">
      <div className="h-full px-4 sm:px-5 flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <Logo />
          <span className="pill px-1.5 py-px text-[10px] font-mono text-slate-500">v1.0</span>
        </div>

        <button
          onClick={onPalette}
          className="hidden md:flex flex-1 max-w-xl mx-auto items-center gap-2.5 px-3 h-8 rounded-md bg-surface hairline text-left text-[13px] text-slate-500 hover:bg-raised transition-colors"
        >
          <Search size={14} className="shrink-0" />
          <span className="flex-1 truncate">Search 369 problems, algorithms, or tags...</span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-raised hairline text-slate-400">{MOD_KEY} + K</kbd>
        </button>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span className="pill hidden sm:flex items-center px-2.5 h-7 text-[12px] bg-surface border-white/10">
            <span className="font-mono font-medium text-emerald-500 tnum">{stats.diffScore.toLocaleString()} DIFF</span>
          </span>
          <span className="pill hidden sm:flex items-center gap-1 px-2.5 h-7 text-[12px] font-medium text-slate-300 bg-surface border-white/10">
            <Flame size={13} className="text-diff-amber" />
            <span className="font-mono tnum">{stats.currentStreak} Day{stats.currentStreak === 1 ? '' : 's'}</span>
          </span>
          {combo.active && (
            <span className="pill hidden md:flex items-center gap-1 px-2.5 h-7 text-[12px] bg-diff-amber/10 border-diff-amber/40 animate-pulse" title="Solve again within the hour to stack the multiplier">
              <Zap size={12} className="text-diff-amber" />
              <span className="font-mono font-semibold text-diff-amber">{combo.multiplier.toFixed(1)}x Combo</span>
              <span className="font-mono text-[10px] text-slate-500">{combo.minsLeft}m left</span>
            </span>
          )}
          <span className="pill hidden xl:flex items-center px-2.5 h-7 text-[12px] font-mono text-slate-400 bg-surface">
            {completion.totalSolved} / {total} Solved
          </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            title="Star the open-source repo"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-surface hairline text-[12px] font-mono text-slate-300 hover:text-slate-100 hover:border-diff-amber/40 transition-colors"
          >
            <Github size={13} className="text-slate-400" />
            <span>Star DiffPush on GitHub</span>
            <Star size={11} className="text-diff-amber" fill="currentColor" />
          </a>
          <a
            href="/room"
            title="Study Room"
            aria-label="Open Study Room"
            className="hidden sm:flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-100 hover:bg-raised transition-colors"
          >
            <Users size={15} />
          </a>

          {github.connected ? (
            <div className="relative" ref={profileRef}>
              <button onClick={() => setShowProfile((s) => !s)} className="relative block w-7 h-7 rounded-full overflow-hidden hairline" title={github.profile.login} aria-label="Profile menu" aria-expanded={showProfile}>
                <img src={github.profile.avatar_url} alt={github.profile.login} className="w-full h-full object-cover" width={28} height={28} />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-diff-emerald border border-canvas" title="Sync active" />
              </button>
              {showProfile && (
                <div className="absolute right-0 top-9 w-64 card !bg-popover p-3 z-50">
                  <p className="font-mono text-[13px] text-slate-100">@{github.profile.login}</p>
                  <a href={github.repoUrl ?? `https://github.com/${github.profile.login}/diffpush-solutions`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] text-diff-emerald hover:underline mt-0.5">
                    diffpush-solutions <ExternalLink size={11} />
                  </a>
                  <p className="font-mono text-[10px] text-slate-500 mt-1">
                    {github.syncState === 'syncing' ? 'syncing…' : github.syncState === 'queued' ? 'offline — commits queued' : github.error ?? 'in sync'}
                  </p>
                  <a
                    href={`/u/${github.profile.login}`}
                    onClick={() => setShowProfile(false)}
                    className="btn-ghost mt-2 w-full flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] text-slate-200"
                  >
                    View profile page
                  </a>
                  <div className="flex gap-1.5 mt-2.5">
                    <button onClick={() => { github.syncNow(); }} className="btn-ghost flex-1 flex items-center justify-center gap-1 h-8 rounded-md text-[12px] text-slate-200">
                      <RefreshCw size={13} /> Sync Now
                    </button>
                    <button onClick={() => { github.disconnect(); setShowProfile(false) }} className="btn-ghost flex items-center justify-center w-8 h-8 rounded-md text-slate-400" title="Disconnect">
                      <LogOut size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button onClick={onConnect} className="btn-ghost flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[12px] font-medium text-slate-300" title="Connect GitHub">
              <Github size={14} />
              <span className="hidden sm:inline">Connect</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
