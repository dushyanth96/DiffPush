import React, { useEffect, useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import {
  ArrowLeft, Play, RotateCcw, Check, Circle, Users,
  BookOpen, FileText, ListOrdered,
} from 'lucide-react'
import { getProblemMeta, getByTopic, loadManifest } from '../../data/curriculum.js'
import { LANGUAGES, langById, loadCode, saveCode, starterFor } from '../../data/languages.js'
import { useRunner, ENGINES } from '../../hooks/useRunner.js'
import { useRoomLive } from '../../hooks/useRoomLive.js'
import { submitSolve, commitExtras } from '../../data/solve.js'
import { fetchRoomMeta, LOBBY_CODE } from '../../data/rooms.js'
import { defineObsidian } from '../workspace/Workspace.jsx'
import { SidebarBannerSlot, DashboardBannerSlot } from '../layout/AmbientAdSlot.jsx'
import { VictoryModal } from '../modals/VictoryModal.jsx'
import { RoomChat } from './RoomChat.jsx'

const DIFF_DOT = { Easy: 'bg-diff-emerald', Medium: 'bg-diff-amber', Hard: 'bg-diff-rose' }

// Room arena: the room's problems only (left), an IDE (center),
// side discussion (right). One screen, zero context switching.
export function ArenaView({ code, tracker, github, onBack }) {
  if (!github?.connected) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="border-b border-border bg-canvas px-4 py-2.5 flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-100">
            <ArrowLeft size={15} /> Back to Hub
          </button>
          <span className="font-mono text-[12px] text-slate-600">diffpush // arena</span>
        </div>
        <div className="max-w-[520px] mx-auto px-4 py-10">
          <div className="card p-8 text-center">
            <Users size={24} className="text-diff-emerald mx-auto" />
            <h1 className="text-[16px] font-bold text-slate-100 mt-3">The arena needs your GitHub identity</h1>
            <p className="text-[13px] text-slate-500 mt-1">Live roster and discussion are tied to a verified login.</p>
            <button onClick={() => window.dispatchEvent(new CustomEvent('builtdiff:connect'))} className="btn-emerald mt-4 px-5 h-10 rounded-md text-[14px] font-semibold">
              Connect GitHub to enter
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <ArenaInner code={code} tracker={tracker} github={github} onBack={onBack} />
}

function ArenaInner({ code, tracker, github, onBack }) {
  const [room, setRoom] = useState(code === LOBBY_CODE
    ? { code, name: 'Global Lobby', topics: [], levels: [], visibility: 'public', expiresAt: 0 }
    : null)
  const [missing, setMissing] = useState(false)
  const [selId, setSelId] = useState(null)
  const [problem, setProblem] = useState(null)
  const [meta, setMeta] = useState(null)
  const [codeText, setCodeText] = useState('')
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)
  const [activeCase, setActiveCase] = useState(0)
  const [victoryOpen, setVictoryOpen] = useState(false)
  const [victoryMs, setVictoryMs] = useState(null)
  const [victoryXp, setVictoryXp] = useState(null)
  const [victoryTier, setVictoryTier] = useState(null)
  const [commitInfo, setCommitInfo] = useState(null)
  const [showList, setShowList] = useState(true)
  const [specTab, setSpecTab] = useState('mission')
  // Persisted runner language: selecting a language saves it, and switching
  // questions keeps it (never resets to python behind the user's back).
  const [langId, setLangId] = useState(() => {
    try {
      const saved = localStorage.getItem('builtdiff:arena:lang')
      if (saved && LANGUAGES.some((l) => l.id === saved && l.status === 'live')) return saved
    } catch {}
    return 'python'
  })
  const [remoteNoteHidden, setRemoteNoteHidden] = useState(() => {
    try { return localStorage.getItem('builtdiff:remote-note-hidden') === '1' } catch { return false }
  })
  const { run: codeRun } = useRunner()

  useEffect(() => {
    if (code === LOBBY_CODE) return
    let cancelled = false
    fetchRoomMeta(code).then((m) => {
      if (cancelled) return
      if (m) setRoom(m)
      else setMissing(true)
    })
    return () => { cancelled = true }
  }, [code])

  // Room-scoped problems in manifest order (lobby: all unsolved Baseline).
  const roomProblems = useMemo(() => {
    try {
      if (!room) return []
      if (room.code === LOBBY_CODE) {
        return getByTopic('01-arrays').filter((p) => p.difficultyRaw === 'Easy').slice(0, 13)
      }
      const out = []
      for (const t of room.topics ?? []) {
        for (const p of getByTopic(t)) {
          if ((room.levels ?? []).length && !room.levels.includes(p.levelName) && !room.levels.includes(p.level)) continue
          out.push(p)
        }
      }
      return out
    } catch {
      return []
    }
  }, [room])

  // No auto-select: the arena opens on the question list with an empty IDE.
  // Ads stay off and no starter loads until the user picks a question.

  const selectProblem = async (id, fromUser = true) => {
    setSelId(id)
    if (fromUser) setShowList(false)
    setProblem(null)
    setRunResult(null)
    setActiveCase(0)
    setVictoryOpen(false)
    try {
      await loadManifest()
      const m = getProblemMeta(id)
      setMeta(m)
      const r = await fetch(m.filePath)
      if (!r.ok) throw new Error()
      const full = await r.json()
      setProblem(full)
      setCodeText(await loadCode(id, langId, full))
    } catch {
      setProblem(null)
    }
  }

  const switchLanguage = (l) => {
    if (l === langId) return
    if (selId) saveCode(selId, langId, codeText)
    try { localStorage.setItem('builtdiff:arena:lang', l) } catch {}
    setLangId(l)
    setRunResult(null)
    setActiveCase(0)
    if (problem && selId) loadCode(selId, l, problem).then(setCodeText).catch(() => {})
  }

  const dismissRemoteNote = () => {
    try { localStorage.setItem('builtdiff:remote-note-hidden', '1') } catch {}
    setRemoteNoteHidden(true)
  }
  const showRemoteNote = !remoteNoteHidden && langById(langId)?.tag === 'remote'

  const run = async () => {
    if (!problem || running || victoryOpen || !meta) return
    setRunning(true)
    setRunResult(null)
    try { localStorage.setItem('builtdiff:status', JSON.stringify({ slug: selId, at: Date.now() })) } catch {}
    const payload = await codeRun(codeText, problem.testCases ?? [], { language: langId })
    setRunning(false)
    setRunResult(payload)
    setActiveCase(0)
    if (payload.status === 'passed') {
      const totalMs = payload.results.reduce((s, r) => s + (r.runtimeMs ?? 0), 0)
      // Recognition must not depend on the commit round-trip (see Workspace.run).
      let result = null
      let ci = null
      try {
        ({ result, commitInfo: ci } = await submitSolve({
          tracker, github, slug: selId, meta, problem, code: codeText, totalMs, language: langId,
          ...commitExtras(selId, payload),
        }))
      } catch { /* offline / commit failed — still celebrate the pass */ }
      setVictoryMs(totalMs)
      setVictoryXp(result ?? { breakdown: { gained: 0, base: 0, streakBonus: 0, comboBonus: 0 }, tierUp: null, newAchievements: [] })
      setVictoryTier(tracker.getTier(tracker.stats.diffScore + (result?.breakdown?.gained ?? 0)))
      setCommitInfo(ci)
      setVictoryOpen(true)
    }
  }

  useEffect(() => {
    const h = (e) => {
      if (victoryOpen) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const { roster, messages, typingNames, send, markTyping } = useRoomLive({
    code,
    token: github.token,
    login: github.profile.login,
    getPayload: () => {
      let topicSolves = 0
      try {
        const ids = new Set(roomProblems.map((p) => p.id))
        topicSolves = Object.keys(tracker.solvedMap).filter((id) => ids.has(id)).length
      } catch {}
      return {
        stats: {
          total: Object.keys(tracker.solvedMap).length,
          streak: tracker.stats.currentStreak,
          topicSolves,
        },
        status: 'idle',
      }
    },
    enabled: !!room,
  })

  const goNextInRoom = () => {
    const next = roomProblems.find((p) => p.id !== selId && !tracker.isSolved(p.id))
    setVictoryOpen(false)
    if (next) selectProblem(next.id)
  }

  const passedCount = (runResult?.results ?? []).filter((r) => r.passed).length
  const active = runResult?.results?.[activeCase]

  if (missing) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="max-w-[520px] mx-auto px-4 py-10">
          <div className="card p-8 text-center">
            <p className="text-[15px] font-semibold text-slate-200">Room not found</p>
            <button onClick={onBack} className="btn-ghost mt-4 px-4 h-9 rounded-md text-[13px] text-slate-200">Back to Hub</button>
          </div>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="max-w-[520px] mx-auto px-4 py-10">
          <div className="card p-10 text-center font-mono text-[13px] text-slate-500">Resolving room…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* top leaderboard strip — sits between browser chrome and nav controls
          (no navbar renders on arena routes, so no pt-16 offset here) */}
      <div className="shrink-0 border-b border-border px-4 py-1 flex justify-center overflow-hidden">
        <DashboardBannerSlot />
      </div>
      <div className="shrink-0 border-b border-border bg-canvas px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-100">
          <ArrowLeft size={15} /> Hub
        </button>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-100">
          <Users size={14} className="text-diff-emerald" /> {room.name}
        </span>
        <span className="font-mono text-[11px] text-slate-500">{roster.length} inside</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={run} disabled={running || !problem} className="btn-emerald flex items-center gap-1.5 px-3.5 h-8 rounded-md text-[13px] font-semibold disabled:opacity-60">
            <Play size={14} /> {running ? 'Running…' : 'Run (Ctrl+Enter)'}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[30%_44%_26%] overflow-y-auto lg:overflow-hidden">
        {/* LEFT: all problems first, question after click */}
        <section className="border-b lg:border-b-0 lg:border-r border-border flex flex-col min-h-0 lg:overflow-hidden">
          {showList ? (
            <div className="flex-1 min-h-0 p-2 lg:flex-[65] lg:min-h-0 lg:overflow-y-auto">
              <p className="px-2 pt-1 font-mono text-[10px] text-slate-500">
                {roomProblems.length} problems{room.code !== LOBBY_CODE && room.topics?.length ? ' · room scope' : ''}
              </p>
              <div className="mt-1 space-y-0.5">
                {roomProblems.map((p) => {
                  const solved = tracker.isSolved(p.id)
                  const on = p.id === selId
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectProblem(p.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${on ? 'bg-raised hairline' : 'hover:bg-raised'}`}
                    >
                      {solved
                        ? <Check size={14} className="text-diff-emerald shrink-0" strokeWidth={3} />
                        : <Circle size={13} className="text-slate-600 shrink-0" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] text-slate-200 truncate">{p.canonicalTitle ?? p.id}</span>
                        <span className="block font-mono text-[10px] text-slate-500">{p.topicName} · {p.optimalTime}</span>
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DIFF_DOT[p.difficultyRaw] ?? 'bg-slate-600'}`} />
                    </button>
                  )
                })}
                {roomProblems.length === 0 && (
                  <p className="px-2 py-4 text-[12px] text-slate-600">No problems in scope.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col lg:flex-[65]">
              <div className="shrink-0 px-3 pt-2">
                <button
                  onClick={() => setShowList(true)}
                  className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400 hover:text-diff-emerald transition-colors"
                >
                  <ListOrdered size={13} /> All {roomProblems.length} problems
                </button>
              </div>
              <div className="shrink-0 flex gap-1 px-3 pt-2">
                {[
                  ['mission', 'Mission Narrative', BookOpen],
                  ['canonical', 'Canonical Spec', FileText],
                ].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    onClick={() => setSpecTab(key)}
                    className={`flex items-center gap-1.5 px-3 h-8 rounded-t-md text-[12px] font-medium ${specTab === key ? 'bg-surface text-slate-100 hairline border-b-0' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Icon size={13} /> {label}
                  </button>
                ))}
              </div>
              <div className="flex-1 lg:overflow-y-auto px-4 py-3 bg-surface lg:bg-transparent border-t border-border min-h-0">
            {!problem ? (
              <p className="font-mono text-[12px] text-slate-600">Loading problem…</p>
            ) : specTab === 'mission' ? (
              <>
                <h1 className="text-[15px] font-bold text-slate-100 leading-snug">{problem.narrative?.title}</h1>
                <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">{problem.narrative?.scenario}</p>
                <div className="mt-4 space-y-2.5 text-[12px]">
                  <div><p className="text-slate-500 font-semibold mb-1">INPUT</p><p className="font-mono text-slate-300 bg-raised hairline rounded p-2">{problem.narrative?.inputFormat}</p></div>
                  <div><p className="text-slate-500 font-semibold mb-1">OUTPUT</p><p className="font-mono text-slate-300 bg-raised hairline rounded p-2">{problem.narrative?.outputFormat}</p></div>
                  <div>
                    <p className="text-slate-500 font-semibold mb-1">CONSTRAINTS</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(problem.narrative?.constraints ?? []).map((c) => (
                        <span key={c} className="font-mono text-[11px] text-slate-400 bg-raised hairline rounded px-1.5 py-0.5">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-[15px] font-bold text-slate-100 leading-snug">{problem.canonical?.title}</h1>
                <a href={problem.canonical?.leetcodeSearch} target="_blank" rel="noreferrer" className="text-[12px] text-diff-emerald hover:underline">Open on LeetCode ↗</a>
                <p className="font-mono text-[11px] text-slate-600 mt-2 break-all">{problem.canonical?.sourceFilePath}</p>
              </>
            )}
            {problem && (
              <div className="mt-4">
                <p className="text-slate-500 font-semibold text-[12px] mb-2">EXAMPLES</p>
                {(problem.testCases ?? []).filter((t) => t.isPublic).map((t, i) => (
                  <div key={t.id} className="mb-2 rounded-md bg-raised hairline p-2.5 font-mono text-[11px] leading-relaxed">
                    <p className="text-slate-500 mb-1">Example {i + 1}</p>
                    <p className="text-slate-300">Input: {JSON.stringify(t.input)}</p>
                    <p className="text-diff-emerald">Output: {JSON.stringify(t.expected)}</p>
                    {t.explanation && <p className="text-slate-500 mt-1 font-sans">{t.explanation}</p>}
                  </div>
                ))}
              </div>
            )}
              </div>
            </div>
          )}
          {/* sponsor under the question column — hybrid rotation like the dashboard, only once a question is open */}
          {!showList && (
            <div className="flex-none border-t border-border p-2 lg:flex-[35] lg:min-h-0 lg:overflow-hidden">
              <SidebarBannerSlot />
            </div>
          )}
        </section>

        {/* CENTER: IDE */}
        <section className="border-b lg:border-b-0 lg:border-r border-border flex flex-col min-h-[560px] lg:min-h-0 lg:overflow-hidden">
          <div className="shrink-0 flex items-center gap-2 px-3 h-10 border-b border-border">
            <span className="font-mono text-[12px] text-slate-200 bg-raised hairline rounded px-2 py-0.5">{langById(langId).file ?? 'solution.py'}</span>
            <select
              value={langId}
              onChange={(e) => switchLanguage(e.target.value)}
              title="Runner language"
              className="bg-surface hairline rounded h-7 px-1.5 text-[12px] text-slate-300 max-w-[132px]"
            >
              {LANGUAGES.filter((l) => l.status === 'live').map((l) => (
                <option key={l.id} value={l.id}>{l.label}{l.tag === 'remote' ? ' · remote' : ''}</option>
              ))}
            </select>
            <span className="font-mono text-[11px] text-slate-600 truncate hidden md:inline">{meta?.canonicalTitle ?? ''}</span>
            <button onClick={() => problem && setCodeText(starterFor(problem, langId))} disabled={!problem} className="ml-auto flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-200 disabled:opacity-40" title="Reset to starter">
              <RotateCcw size={13} /> Reset
            </button>
          </div>
          {showRemoteNote && (
            <div className="shrink-0 mx-3 mt-2 rounded-md bg-diff-amber/10 border border-diff-amber/30 px-3 py-2 flex items-start gap-2">
              <p className="flex-1 text-[12px] text-slate-300 leading-snug">
                <span className="font-semibold text-diff-amber">{langById(langId).label}</span> compiles on a <span className="font-semibold">remote server</span>, not locally — needs internet and may have some latency.
              </p>
              <label className="shrink-0 flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
                <input type="checkbox" checked={false} onChange={dismissRemoteNote} className="accent-[#F59E0B]" />
                Don&apos;t show again
              </label>
            </div>
          )}
          {problem ? (
          <>
          <div className="flex-1 min-h-[280px] lg:min-h-0">
            <Editor
              height="100%"
              language={langById(langId).mode ?? 'python'}
              value={codeText}
              onChange={(v) => setCodeText(v ?? '')}
              beforeMount={defineObsidian}
              theme="obsidian"
              options={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', minimap: { enabled: false }, padding: { top: 12 }, scrollBeyondLastLine: false, automaticLayout: true }}
            />
          </div>
          <div className="shrink-0 border-t border-border max-h-[38%] flex flex-col min-h-0">
            <div className="flex items-center gap-2 px-3 h-9 shrink-0">
              <span className="text-[12px] font-semibold text-slate-300" title={langId === 'python' || langId === 'javascript' ? 'Runs on your machine — no network.' : 'Runs on a shared remote compiler — needs internet.'}>
                {ENGINES[langId]?.label ?? 'Output'}
              </span>
              {runResult && (
                <span className={`ml-auto text-[11px] font-mono px-2 py-0.5 rounded border ${runResult.status === 'passed' ? 'text-diff-emerald border-diff-emerald/30 bg-diff-emerald/10' : runResult.status === 'failed' ? 'text-diff-rose border-diff-rose/30 bg-diff-rose/10' : 'text-diff-amber border-diff-amber/30 bg-diff-amber/10'}`}>
                  {runResult.status === 'passed' ? `${passedCount}/${runResult.results.length} Passed` : runResult.status}
                </span>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
              {runResult ? (
                <>
                  <div className="flex gap-1 mb-2 flex-wrap">
                    {runResult.results.map((r, i) => (
                      <button
                        key={r.id ?? i}
                        onClick={() => setActiveCase(i)}
                        className={`flex items-center gap-1 px-2 h-7 rounded text-[12px] font-mono ${i === activeCase ? 'bg-raised text-slate-100 hairline' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        {r.passed ? <Check size={12} className="text-diff-emerald" strokeWidth={3} /> : <Circle size={11} className="text-diff-rose" />}
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  {active && (
                    <div className="space-y-1 font-mono text-[11px]">
                      <p className="text-slate-400">Expected: <span className="text-diff-emerald">{JSON.stringify(active.expected)}</span></p>
                      <p className="text-slate-400">Yours: <span className={active.passed ? 'text-diff-emerald' : 'text-diff-rose'}>{JSON.stringify(active.actual)}</span></p>
                      {active.stdout && <pre className="whitespace-pre-wrap text-slate-500 bg-raised hairline rounded p-2">{active.stdout}</pre>}
                    </div>
                  )}
                  {runResult.error && !runResult.results.length && (
                    <pre className="font-mono text-[11px] text-diff-amber whitespace-pre-wrap bg-raised hairline rounded p-2">{runResult.error}</pre>
                  )}
                </>
              ) : (
                <p className="font-mono text-[11px] text-slate-600">Ctrl+Enter runs {problem?.testCases?.length ?? '…'} cases{langId === 'python' || langId === 'javascript' ? ' locally' : ' on a remote compiler'}.</p>
            )}
          </div>
          </div>
          </>
          ) : (
            <div className="flex-1 min-h-[280px] lg:min-h-0 flex items-center justify-center px-4">
              <div className="text-center">
                <p className="text-[14px] font-semibold text-slate-200">Select a question to practice</p>
                <p className="text-[12px] text-slate-500 mt-1">Pick any problem from the room list — the editor stays empty until then.</p>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT: side discussion */}
        <section className="flex flex-col min-h-[420px] lg:min-h-0 lg:overflow-hidden">
          <div className="shrink-0 px-3 h-10 border-b border-border flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-500">LIVE · {roster.length} inside</span>
          </div>
          <div className="flex-1 min-h-0">
            <RoomChat messages={messages} typingNames={typingNames} onSend={(t) => send(t)} onTyping={markTyping} />
          </div>
        </section>
      </div>

      {victoryOpen && (
        <VictoryModal
          meta={meta}
          totalMs={victoryMs}
          totalCases={runResult?.results?.length ?? problem?.testCases?.length}
          commitInfo={commitInfo}
          github={github}
          xp={victoryXp}
          tier={victoryTier}
          onClose={() => setVictoryOpen(false)}
          onNext={goNextInRoom}
        />
      )}
    </div>
  )
}
