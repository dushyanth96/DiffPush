import React, { useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import {
  ArrowLeft, Play, RotateCcw, Check, Circle, Star, Send,
  Cpu, MessageSquareText, BookOpen, FileText, ChevronRight, KeyRound, X,
  RefreshCw, ArrowLeftRight, Eye, EyeOff, ExternalLink,
} from 'lucide-react'
import { getProblemMeta, loadManifest } from '../../data/curriculum.js'
import { LANGUAGES, loadCode, saveCode, starterFor } from '../../data/languages.js'
import { useRunner, ENGINES } from '../../hooks/useRunner.js'
import {
  getProviders, getSettings, saveProvider, saveKey, saveModel, resolveModel,
  askAI, buildMentorSystem,
} from '../../data/chat.js'
import { REPO_URL } from '../../data/repo.js'
import { submitSolve, commitExtras } from '../../data/solve.js'
import { fetchPushedSolution } from '../../hooks/useGitHub.js'
import { SidebarBannerSlot, VerticalAdSlot } from '../layout/AmbientAdSlot.jsx'
import { VictoryModal, LanguageRequestModal, nextUnsolvedInTopic } from '../modals/VictoryModal.jsx'
const DIFF_STYLE = {
  Baseline: 'text-diff-emerald border-diff-emerald/30 bg-diff-emerald/10',
  'Standard Bar': 'text-diff-amber border-diff-amber/30 bg-diff-amber/10',
  'DiffPush Tier': 'text-diff-rose border-diff-rose/30 bg-diff-rose/10',
}

export function defineObsidian(monaco) {
  monaco.editor.defineTheme('obsidian', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5B6577' },
      { token: 'keyword', foreground: '8B7CF6' },
      { token: 'string', foreground: '34D399' },
      { token: 'number', foreground: 'FBBF24' },
      { token: 'type', foreground: '7DD3FC' },
      { token: 'identifier', foreground: 'E6EAF2' },
    ],
    colors: {
      'editor.background': '#07090E',
      'editor.foreground': '#E6EAF2',
      'editor.lineHighlightBackground': '#0D111A',
      'editorLineNumber.foreground': '#3B4557',
      'editorLineNumber.activeForeground': '#8B94A7',
      'editorCursor.foreground': '#10B981',
      'editor.selectionBackground': '#1E3A32',
      'editorWidget.background': '#131A26',
      'editorWidget.border': '#FFFFFF14',
    },
  })
}

const MENTOR_REPLIES = {
  hint: (p) => [
    'Read the constraints first — they rule out the naive shape.',
    `Tags to orient on: ${(p.intentTags ?? []).slice(0, 4).join(', ') || 'see spec'}.`,
    (p.hints ?? [])[0] ?? 'Find the invariant the answer must preserve, then build around it.',
  ].join('\n\n'),
  bigo: (p) => `Target: ${p.optimalTime ?? '?'} time · ${p.optimalSpace ?? '?'} space.\n\nIf your loop nests, you're over budget — look for the single-pass formulation. A hash map trades space for the inner scan; sorting first costs O(n log n) and is only acceptable if the target allows it.`,
  debug: () => 'Paste the failing case ID. Then: (1) print inputs at loop entry, (2) check the empty/single-element edge, (3) verify off-by-one on the final index. 90% of runner failures are boundary exits, not logic.',
}

export function Workspace({ slug, tracker, github, onBack }) {
  const [meta, setMeta] = useState(null)
  const [problem, setProblem] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [code, setCode] = useState('')
  const [fontSize, setFontSize] = useState(13)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)
  const [activeCase, setActiveCase] = useState(0)
  const [specTab, setSpecTab] = useState('mission')
  const [commitInfo, setCommitInfo] = useState(null) // {sha, repoUrl, path} | {queued:true}
  const [victoryOpen, setVictoryOpen] = useState(false)
  const [victoryMs, setVictoryMs] = useState(null)
  const [victoryXp, setVictoryXp] = useState(null)
  const [victoryTier, setVictoryTier] = useState(null)
  const [langMenu, setLangMenu] = useState(false)
  const [langModal, setLangModal] = useState(false)
  const [langPick, setLangPick] = useState(LANGUAGES[0])
  const [mentorOpen, setMentorOpen] = useState(false)
  const [mentor, setMentor] = useState([
    { role: 'mentor', text: 'Online. I know this problem\'s optimal shape — ask for a hint, a Big-O check, or a debug trace.' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [coachSetup, setCoachSetup] = useState(false)
  const [coachProviders, setCoachProviders] = useState([])
  const [coachProvider, setCoachProvider] = useState(() => getSettings().provider || '')
  const [coachModel, setCoachModel] = useState(() => getSettings().models[getSettings().provider] || '')
  const [coachKey, setCoachKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [coachSaved, setCoachSaved] = useState(false)
  const [pushedLoaded, setPushedLoaded] = useState(false)
  const pushedTried = useRef(new Set())

  const editorRef = useRef(null)
  const chatScrollRef = useRef(null)
  const { run: codeRun } = useRunner()

  // load manifest entry + full problem JSON (code follows via the language effect)
  useEffect(() => {
    let cancelled = false
    loadManifest()
      .then(() => {
        if (cancelled) return
        const m = getProblemMeta(slug)
        if (!m) { setLoadError(`Unknown problem: ${slug}`); return }
        setMeta(m)
        return fetch(m.filePath)
          .then((r) => { if (!r.ok) throw new Error(`fetch ${r.status}`); return r.json() })
          .then(async (full) => {
            if (cancelled) return
            setProblem(full)
          })
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message) })
    return () => { cancelled = true }
  }, [slug])

  // per-language code: saved draft first, else the language starter.
  // Reloads on language switch (the old buffer is snapshotted first).
  // If the problem is already solved + pushed and there is no local draft,
  // pull the pushed solution back down from the user's GitHub repo.
  useEffect(() => {
    if (!problem) return
    let cancelled = false
    setPushedLoaded(false)
    loadCode(slug, langPick.id, problem)
      .then(async (c) => {
        if (cancelled) return
        setCode(c)
        try {
          const starter = starterFor(problem, langPick.id)
          const hasDraft = c && c !== starter
          const key = `${slug}::${langPick.id}`
          if (!hasDraft && !pushedTried.current.has(key)
            && tracker.isSolved(slug) && github.connected && github.profile?.login && meta) {
            pushedTried.current.add(key)
            const remote = await fetchPushedSolution({
              token: github.token, login: github.profile.login,
              slug, meta, language: langPick.id,
            })
            if (!cancelled && remote?.code) {
              saveCode(slug, langPick.id, remote.code)
              setCode(remote.code)
              setPushedLoaded(true)
            }
          }
        } catch {}
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem, slug, langPick.id, github.connected])

  const switchLanguage = (l) => {
    if (l.id === langPick.id) { setLangMenu(false); return }
    saveCode(slug, langPick.id, code)
    setLangPick(l)
    setLangMenu(false)
    setRunResult(null)
    setActiveCase(0)
  }

  const run = async () => {
    if (!problem || running || victoryOpen) return
    setRunning(true)
    setRunResult(null)
    // Presence signal for live rooms (fresh for 5 min, read by the heartbeat).
    try { localStorage.setItem('builtdiff:status', JSON.stringify({ slug, at: Date.now() })) } catch {}
    const payload = await codeRun(code, problem.testCases ?? [], { language: langPick.id })
    setRunning(false)
    setRunResult(payload)
    setActiveCase(0)
    if (payload.status === 'passed') {
      const totalMs = payload.results.reduce((s, r) => s + (r.runtimeMs ?? 0), 0)
      // Recognition must never depend on the GitHub/commit round-trip — a
      // network blip should not swallow the success popup.
      let result = null
      let ci = null
      try {
        ({ result, commitInfo: ci } = await submitSolve({
          tracker, github, slug, meta, problem, code, totalMs, language: langPick.id,
          ...commitExtras(slug, payload),
        }))
      } catch { /* offline / commit failed — still celebrate the pass */ }
      setVictoryMs(totalMs)
      setVictoryXp(result ?? { breakdown: { gained: 0, base: 0, streakBonus: 0, comboBonus: 0 }, tierUp: null, newAchievements: [] })
      setVictoryTier(tracker.getTier(tracker.stats.diffScore + (result?.breakdown?.gained ?? 0)))
      setCommitInfo(ci)
      setVictoryOpen(true)
    }
  }

  // Ctrl+Enter runs (unless victory modal owns the keystroke)
  useEffect(() => {
    const h = (e) => {
      if (victoryOpen) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  // Coach chat follows new messages: every send/reply/error lands in view.
  useEffect(() => {
    try {
      const n = chatScrollRef.current
      if (n) n.scrollTop = n.scrollHeight
    } catch {}
  }, [mentor])

  const passedCount = useMemo(
    () => (runResult?.results ?? []).filter((r) => r.passed).length,
    [runResult]
  )
  const totalCount = runResult?.results?.length ?? problem?.testCases?.length ?? 0
  const solved = tracker.isSolved(slug)
  const mentorCtx = useMemo(() => ({
    intentTags: problem?.aiContext?.intentTags ?? meta?.tags ?? [],
    hints: problem?.aiContext?.hintLevels ?? [],
    optimalTime: problem?.complexity?.optimalTime ?? meta?.optimalTime,
    optimalSpace: problem?.complexity?.optimalSpace ?? meta?.optimalSpace,
  }), [problem, meta])

  const askMentor = (kind) => {
    const map = { hint: 'Intuition Hint', bigo: 'Big-O Check', debug: 'Debug Trace' }
    const reply = MENTOR_REPLIES[kind === 'bigo' ? 'bigo' : kind === 'debug' ? 'debug' : 'hint'](mentorCtx)
    setMentor((m) => [...m, { role: 'user', text: map[kind] ?? kind }, { role: 'mentor', text: reply }])
  }

  const sendChat = async (text) => {
    const q = (text ?? chatInput).trim()
    if (!q || aiBusy) return
    setChatInput('')
    // BYOK path: provider + key configured -> real model via backend proxy.
    const { provider, keys } = getSettings()
    const key = (keys[provider] || '').trim()
    if (provider && key) {
      const history = [
        ...mentor.filter((m) => !m.pending && !m.error).slice(-6)
          .map((m) => ({ role: m.role === 'mentor' ? 'assistant' : 'user', content: m.text })),
        { role: 'user', content: q },
      ]
      setMentor((m) => [...m, { role: 'user', text: q }, { role: 'mentor', text: 'Thinking…', pending: true }])
      setAiBusy(true)
      try {
        const { reply } = await askAI({
          system: buildMentorSystem({
            title: meta?.canonicalTitle, tags: mentorCtx.intentTags, hints: mentorCtx.hints,
            optimalTime: mentorCtx.optimalTime, optimalSpace: mentorCtx.optimalSpace, language: langPick.label,
          }),
          messages: history,
        })
        setMentor((m) => [...m.filter((x) => !x.pending), { role: 'mentor', text: reply }])
      } catch (e) {
        const action = e.action || 'retry'
        setMentor((m) => [...m.filter((x) => !x.pending), {
          role: 'mentor', text: String(e.message || 'Coach hiccup — retry.'), error: { action, question: q },
        }])
        if (action === 'check_key' || action === 'fix_input') setCoachSetup(true)
      } finally {
        setAiBusy(false)
      }
      return
    }
    // No key configured -> instant rule-based fallback (offline, free).
    setMentor((m) => [...m, { role: 'user', text: q }, {
      role: 'mentor',
      text: 'Noted. Break the problem into the smallest failing input, then ask for a Debug Trace — I\'ll walk the boundary with you.',
    }])
  }

  // Provider catalog for the BYOK settings (backend truth, baked fallback).
  useEffect(() => {
    let cancelled = false
    getProviders().then((list) => {
      if (cancelled || !list.length) return
      setCoachProviders(list)
      setCoachProvider((cur) => {
        if (cur) return cur
        const first = list[0]
        setCoachModel(resolveModel(list, first.id, getSettings().models[first.id] || ''))
        return first.id
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const coachProviderCfg = coachProviders.find((p) => p.id === coachProvider) ?? null
  const coachHasKey = (() => { try { return Boolean(getSettings().keys[coachProvider]) } catch { return false } })()

  const saveCoachSettings = () => {
    if (!coachProvider) return
    saveProvider(coachProvider)
    if (coachKey.trim()) saveKey(coachProvider, coachKey.trim())
    saveModel(coachProvider, coachModel.trim())
    setCoachKey('')
    setCoachSaved(true)
    setTimeout(() => setCoachSaved(false), 1600)
  }

  const goNext = () => {
    const next = nextUnsolvedInTopic(tracker, meta?.topic, slug)
    setVictoryOpen(false)
    if (next) window.location.hash = `#/solve/${next.id}`
    else onBack()
  }

  if (loadError) {
    return (
      <div className="pt-16 max-w-2xl mx-auto px-4 py-10">
        <div className="card p-8 text-center text-[13px] text-slate-500">
          {loadError} <button onClick={onBack} className="text-diff-emerald ml-2">← Hub</button>
        </div>
      </div>
    )
  }
  if (!problem || !meta) {
    return (
      <div className="pt-16 max-w-2xl mx-auto px-4 py-10">
        <div className="card p-10 text-center font-mono text-[13px] text-slate-500">Loading problem…</div>
      </div>
    )
  }

  const active = runResult?.results?.[activeCase]

  return (
    <div className="pt-16 h-screen flex flex-col">
      {/* top workspace header */}
      <div className="shrink-0 border-b border-border bg-canvas px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-100">
          <ArrowLeft size={15} /> Hub
        </button>
        <span className="text-[13px] text-slate-500 truncate">
          <span className="text-slate-600">A2Z Sheet</span> <span className="text-slate-700">/</span> {meta.topicName}{' '}
          <span className="text-slate-700">/</span>{' '}
          <span className="text-slate-200 font-medium">{meta.canonicalTitle}</span>
        </span>
        {pushedLoaded && (
          <span className="font-mono text-[11px] text-diff-emerald" title="Loaded the solution you previously pushed to your diffpush-solutions repo">
            · GitHub solution loaded
          </span>
        )}
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${DIFF_STYLE[meta.difficulty] ?? ''}`}>{meta.difficulty}</span>
        <span className="hidden md:inline font-mono text-[11px] text-slate-500 ml-2">
          Optimal: {meta.optimalTime} · {meta.optimalSpace}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            title="Open-source repo"
            className="hidden md:flex items-center gap-1 text-[12px] font-mono text-slate-500 hover:text-diff-amber transition-colors"
          >
            Open-source repo <span className="text-slate-600">↗</span>
          </a>
          <button
            onClick={() => tracker.toggleStar(slug)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[12px] font-medium hairline bg-surface text-slate-400 hover:text-slate-200"
            title={tracker.starredIds.includes(slug) ? 'Starred — click to unstar' : 'Star for recall deck'}
          >
            <Star size={13} className={tracker.starredIds.includes(slug) ? 'text-diff-amber' : 'text-slate-600'} />
            <span className="hidden md:inline">{tracker.starredIds.includes(slug) ? 'Starred' : 'Star'}</span>
          </button>
          <button
            onClick={() => (solved ? tracker.unmarkSolved(slug) : tracker.markSolved(slug, { manual: true }))}
            className={`flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[12px] font-medium hairline transition-colors ${solved ? 'bg-diff-emerald/15 text-diff-emerald border-diff-emerald/30 hover:bg-diff-emerald/25' : 'bg-surface text-slate-400 hover:text-slate-200'}`}
            title={solved ? 'Marked solved — click to revert to unsolved' : 'Mark solved'}
            aria-pressed={solved}
          >
            {solved ? <Check size={14} strokeWidth={3} /> : <Circle size={13} />} {solved ? 'Solved' : 'Mark Solved'}
          </button>
          <div className="relative hidden sm:block">
            <button onClick={() => setLangMenu((v) => !v)} className="bg-surface hairline rounded-md h-8 px-2.5 text-[12px] text-slate-300 flex items-center gap-1.5">
              {langPick.label} {langPick.status === 'live' && <span className="font-mono text-[10px] text-slate-600">{langPick.tag}</span>} <span className="text-slate-600">▾</span>
            </button>
            {langMenu && (
              <div className="absolute right-0 top-9 w-60 card !bg-popover p-1.5 z-50">
                <p className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-600">Runners</p>
                <div className="max-h-[260px] overflow-y-auto">
                  {LANGUAGES.map((l) => {
                    const live = l.status === 'live'
                    return (
                      <button
                        key={l.id}
                        onClick={() => { if (live) switchLanguage(l); else { setLangMenu(false); setLangModal(true) } }}
                        className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 text-[12px] ${live ? 'text-slate-100 hover:bg-raised' : 'text-slate-500 hover:bg-raised'}`}
                      >
                        {live && langPick.id === l.id
                          ? <Check size={13} className="text-diff-emerald shrink-0" strokeWidth={3} />
                          : <Circle size={11} className="text-slate-700 shrink-0" />}
                        <span className="truncate">{l.label}</span>
                        <span className="ml-auto font-mono text-[10px] text-slate-600 shrink-0">{live ? l.tag : 'soon'}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="border-t border-border mt-1 pt-1">
                  <button onClick={() => { setLangMenu(false); setLangModal(true) }} className="w-full text-left px-2 py-1.5 text-[12px] text-diff-emerald hover:bg-raised rounded">+ Request a Language…</button>
                </div>
              </div>
            )}
          </div>
          <button onClick={run} disabled={running} className="btn-emerald flex items-center gap-1.5 px-3.5 h-8 rounded-md text-[13px] font-semibold disabled:opacity-60">
            <Play size={14} /> {running ? 'Running…' : 'Run Solution (Ctrl+Enter)'}
          </button>
        </div>
      </div>

      {/* 3-pane grid — coach column collapses to a slim rail when closed */}
      <div className={`flex-1 min-h-0 grid grid-cols-1 ${mentorOpen ? 'lg:grid-cols-[30%_45%_25%]' : 'lg:grid-cols-[30%_56%_14%]'} overflow-y-auto lg:overflow-hidden`}>
        {/* LEFT: spec (70%) + sponsor (30%) */}
        <section className="border-b lg:border-b-0 lg:border-r border-border flex flex-col min-h-0 lg:overflow-hidden">
          <div className="flex flex-col min-h-0 lg:flex-[65] lg:min-h-0 lg:overflow-hidden">
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
            <div className="flex-1 min-h-0 lg:overflow-y-auto px-4 py-3 bg-surface lg:bg-transparent border-t border-border">
            {specTab === 'mission' ? (
              <>
                <h1 className="text-[16px] font-bold text-slate-100 leading-snug">{problem.narrative?.title}</h1>
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
                <h1 className="text-[16px] font-bold text-slate-100 leading-snug">{problem.canonical?.title}</h1>
                <a href={problem.canonical?.leetcodeSearch} target="_blank" rel="noreferrer" className="text-[12px] text-diff-emerald hover:underline">Open on LeetCode ↗</a>
                <p className="font-mono text-[11px] text-slate-500 mt-2 break-all">{problem.canonical?.sourceFilePath}</p>
              </>
            )}
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
            </div>
          </div>
          {/* sponsor takes the remaining 30% of the question column —
              same square banner as the dashboard sidebar, in-house heavy:
              AADS only, never Mondiad */}
          <div className="flex min-h-0 border-t border-border p-2 lg:flex-[35] lg:min-h-0">
            <div className="w-full h-full min-h-0 overflow-y-auto">
              <SidebarBannerSlot mondiad={false} networkMs={30000} houseMs={90000} />
            </div>
          </div>
        </section>

        {/* CENTER: editor + runner */}
        <section className="border-b lg:border-b-0 lg:border-r border-border flex flex-col min-h-[560px] lg:min-h-0 lg:overflow-hidden">
          <div className="shrink-0 flex items-center gap-2 px-3 h-10 border-b border-border">
            <span className="font-mono text-[12px] text-slate-200 bg-raised hairline rounded px-2 py-1">{langPick.file ?? 'solution.py'}</span>
            <button onClick={() => setCode(starterFor(problem, langPick.id))} className="flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-200" title="Reset to starter">
              <RotateCcw size={13} /> Reset
            </button>
            <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="ml-auto bg-surface hairline rounded h-7 px-1.5 font-mono text-[11px] text-slate-400">
              {[12, 13, 14, 16].map((s) => <option key={s} value={s}>{s}px</option>)}
            </select>
          </div>
          <div className="flex-1 min-h-[320px] lg:min-h-0">
            <Editor
              height="100%"
              language={langPick.mode ?? 'python'}
              value={code}
              onChange={(v) => setCode(v ?? '')}
              beforeMount={defineObsidian}
              theme="obsidian"
              options={{ fontSize, fontFamily: 'JetBrains Mono, monospace', minimap: { enabled: false }, padding: { top: 12 }, scrollBeyondLastLine: false, automaticLayout: true }}
              onMount={(ed) => { editorRef.current = ed }}
            />
          </div>
          {/* execution drawer */}
          <div className="shrink-0 border-t border-border max-h-[42%] flex flex-col min-h-0">
            <div className="flex items-center gap-2 px-3 h-9 shrink-0">
              <Cpu size={13} className="text-slate-500" />
              <span className="text-[12px] font-semibold text-slate-300" title={langPick.id === 'python' || langPick.id === 'javascript' ? 'Runs on your machine — no network, no queue.' : 'Runs on a shared remote compiler — needs internet, takes a few seconds.'}>
                {ENGINES[langPick.id]?.label ?? 'Output'}
              </span>
              {runResult && (
                <>
                  <span className="font-mono text-[11px] text-slate-500" title={`Wall time incl. engine load: ${runResult.totalTimeMs}ms`}>
                    {Math.round(runResult.results.reduce((s, r) => s + (r.runtimeMs ?? 0), 0) * 100) / 100}ms exec
                  </span>
                  <span className={`ml-auto text-[11px] font-mono px-2 py-0.5 rounded border ${runResult.status === 'passed' ? 'text-diff-emerald border-diff-emerald/30 bg-diff-emerald/10' : runResult.status === 'failed' ? 'text-diff-rose border-diff-rose/30 bg-diff-rose/10' : 'text-diff-amber border-diff-amber/30 bg-diff-amber/10'}`}>
                    {runResult.status === 'passed' ? `${passedCount}/${totalCount} Passed` : runResult.status === 'failed' ? `${totalCount - passedCount}/${totalCount} Failed` : 'Error'}
                  </span>
                </>
              )}
            </div>
            {runResult ? (
              <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
                {runResult.error && !runResult.results.length && (
                  <pre className="font-mono text-[11px] text-diff-amber whitespace-pre-wrap bg-raised hairline rounded p-2">{runResult.error}</pre>
                )}
                {runResult.results.length > 0 && (
                  <>
                    <div className="flex gap-1 mb-2">
                      {runResult.results.map((r, i) => (
                        <button
                          key={r.id ?? i}
                          onClick={() => setActiveCase(i)}
                          className={`flex items-center gap-1 px-2.5 h-7 rounded text-[12px] font-mono ${i === activeCase ? 'bg-raised text-slate-100 hairline' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          {r.passed ? <Check size={12} className="text-diff-emerald" strokeWidth={3} /> : <Circle size={11} className="text-diff-rose" />}
                          Case {i + 1}
                        </button>
                      ))}
                    </div>
                    {active && (
                      <div className="space-y-1.5 font-mono text-[11px]">
                        <p className="text-slate-400">Input: <span className="text-slate-200">{JSON.stringify(active.input)}</span></p>
                        <p className="text-slate-400">Expected: <span className="text-diff-emerald">{JSON.stringify(active.expected)}</span></p>
                        <p className="text-slate-400">Yours: <span className={active.passed ? 'text-diff-emerald' : 'text-diff-rose'}>{JSON.stringify(active.actual)}</span></p>
                        <p className="text-slate-500">{active.runtimeMs}ms{active.stdout ? ` · stdout/stderr:\n${active.stdout}` : ''}</p>
                        {active.stdout && <pre className="whitespace-pre-wrap text-slate-500 bg-raised hairline rounded p-2">{active.stdout}</pre>}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="px-3 pb-3 font-mono text-[11px] text-slate-500">Press Ctrl+Enter — {langPick.id === 'python' ? 'Pyodide executes' : langPick.id === 'javascript' ? 'the local engine executes' : 'the remote compiler executes'} {totalCount} cases{langPick.id === 'python' || langPick.id === 'javascript' ? ', zero server cost' : ', shared queue'}.</p>
            )}
          </div>
        </section>

        {/* RIGHT: mentor — collapsed to a slim rail: horizontal opener + vertical banner ad */}
        {!mentorOpen ? (
          <section className="border-t lg:border-t-0 lg:border-l border-border min-h-0 flex flex-col">
            <div className="shrink-0 p-2">
              <button
                onClick={() => setMentorOpen(true)}
                aria-expanded={false}
                aria-label="Open Diff Mentor AI coach"
                title="Open Diff Mentor AI coach"
                className="btn-ghost w-full h-10 rounded-md text-[13px] font-medium text-slate-200 flex items-center justify-center gap-2"
              >
                <MessageSquareText size={15} className="text-diff-emerald shrink-0" />
                <span className="truncate">AI Coach</span>
                <span className="w-1.5 h-1.5 rounded-full bg-diff-emerald shrink-0 animate-pulse" />
              </button>
            </div>
            <p className="shrink-0 px-3 pt-1 pb-2 text-[11px] leading-snug text-slate-500 text-center">
              Stuck? <span className="text-slate-200 font-medium">Open AI Coach</span> for hints, Big-O checks &amp; debug traces.
            </p>
            {/* rail freed up by the collapsed coach → in-house banner (normal IDE: AADS only, never Mondiad) */}
            <div className="hidden lg:flex flex-1 min-h-0 px-2 pb-2">
              <VerticalAdSlot mondiad={false} networkMs={30000} houseMs={90000} />
            </div>
          </section>
        ) : (
        <section className="relative border-t lg:border-t-0 lg:border-l border-border flex flex-col min-h-[420px] lg:min-h-0 lg:overflow-hidden">
          <div className="shrink-0 flex items-center gap-2 px-3 h-10 border-b border-border">
            <MessageSquareText size={13} className="text-diff-emerald" />
            <span className="text-[12px] font-semibold text-slate-200">Diff Mentor // AI Copilot</span>
            <button
              onClick={() => setCoachSetup((v) => !v)}
              title="AI provider settings — bring your own free key"
              aria-label="AI provider settings"
              className={`ml-auto flex items-center gap-1.5 px-2 h-7 rounded-md text-[11px] font-medium hairline transition-colors ${coachHasKey ? 'bg-surface text-slate-300 hover:text-slate-100' : 'bg-diff-emerald/10 text-diff-emerald border-diff-emerald/30 hover:bg-diff-emerald/20'}`}
            >
              <KeyRound size={11} />
              <span className="max-w-[92px] truncate">{coachHasKey ? (coachProviderCfg?.label ?? coachProvider) : 'BYOK'}</span>
            </button>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-diff-emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-diff-emerald inline-block animate-pulse" /> Online
            </span>
            <button
              onClick={() => setMentorOpen(false)}
              title="Collapse coach"
              aria-label="Collapse coach"
              className="ml-1 w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-raised"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          {coachSetup && (
            <div className="absolute top-11 right-2 left-2 z-40 card !bg-popover p-3 max-h-[75%] overflow-y-auto" role="dialog" aria-label="AI provider settings">
              <div className="flex items-center gap-2">
                <KeyRound size={13} className="text-diff-emerald shrink-0" />
                <span className="text-[13px] font-semibold text-slate-100">Coach AI — bring your own key</span>
                <button onClick={() => setCoachSetup(false)} aria-label="Close settings" className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-raised">
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                {coachProviders.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setCoachProvider(p.id); setCoachModel(resolveModel([p], p.id, getSettings().models[p.id] || '')); setCoachKey('') }}
                    className={`px-2.5 h-7 rounded-md text-[12px] font-medium transition-colors ${coachProvider === p.id ? 'bg-diff-emerald/15 text-diff-emerald border border-diff-emerald/30' : 'btn-ghost text-slate-400'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {coachProviderCfg && (
                <>
                  <p className="mt-2 text-[12px] text-slate-500">{coachProviderCfg.note}</p>
                  <label className="block mt-2.5 text-[11px] font-semibold text-slate-400" htmlFor="coach-model">Model</label>
                  {coachProviderCfg.anyModel ? (
                    <input
                      id="coach-model"
                      value={coachModel}
                      onChange={(e) => setCoachModel(e.target.value)}
                      placeholder={coachProviderCfg.default}
                      spellCheck={false}
                      className="mt-1 w-full bg-surface hairline rounded-md h-9 px-3 font-mono text-[12px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-diff-emerald/40"
                    />
                  ) : (
                    <select
                      id="coach-model"
                      value={resolveModel(coachProviders, coachProvider, coachModel) || coachProviderCfg?.default || ''}
                      onChange={(e) => setCoachModel(e.target.value)}
                      className="mt-1 w-full bg-surface hairline rounded-md h-9 px-2 text-[13px] text-slate-200 outline-none"
                    >
                      {coachProviderCfg.models.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  )}
                  <label className="block mt-2.5 text-[11px] font-semibold text-slate-400" htmlFor="coach-key">API key</label>
                  <div className="mt-1 flex gap-1.5">
                    <input
                      id="coach-key"
                      type={showKey ? 'text' : 'password'}
                      value={coachKey}
                      onChange={(e) => setCoachKey(e.target.value)}
                      placeholder={coachHasKey ? 'Saved ✓ — paste to replace' : 'Paste key…'}
                      spellCheck={false}
                      autoComplete="off"
                      className="flex-1 min-w-0 bg-surface hairline rounded-md h-9 px-3 font-mono text-[12px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-diff-emerald/40"
                    />
                    <button onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Hide key' : 'Show key'} className="btn-ghost w-9 h-9 rounded-md flex items-center justify-center text-slate-400 shrink-0">
                      {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <a href={coachProviderCfg.keyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] text-diff-emerald hover:underline">
                      Get free key <ExternalLink size={12} />
                    </a>
                    <span className="ml-auto flex items-center gap-1.5">
                      {coachHasKey && (
                        <button onClick={() => { saveKey(coachProvider, ''); setCoachKey('') }} className="btn-ghost px-2.5 h-8 rounded-md text-[12px] text-slate-400">
                          Clear
                        </button>
                      )}
                      <button onClick={saveCoachSettings} disabled={!coachProvider} className="btn-emerald px-3.5 h-8 rounded-md text-[13px] font-semibold disabled:opacity-50">
                        Save
                      </button>
                      {coachSaved && <span className="text-[12px] text-diff-emerald">Saved ✓</span>}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-slate-600">Keys stay in this browser only — sent per-request in headers, never stored on any server.</p>
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-600">
                    If a model fails, switch to another model. If nothing works,{' '}
                    <a href={`${REPO_URL}/issues/new`} target="_blank" rel="noreferrer" className="text-diff-emerald hover:underline">
                      raise a request here <ExternalLink size={10} className="inline" />
                    </a>
                  </p>
                </>
              )}
            </div>
          )}
          <div className="shrink-0 flex gap-1.5 px-3 py-2 border-b border-border overflow-x-auto">
            {[
              ['hint', 'Intuition Hint'],
              ['bigo', 'Big-O Check'],
              ['debug', 'Debug Trace'],
            ].map(([kind, label]) => (
              <button key={kind} onClick={() => askMentor(kind)} className="btn-ghost shrink-0 px-2.5 h-7 rounded-md text-[12px] text-slate-300">{label}</button>
            ))}
          </div>
          <div ref={chatScrollRef} className="flex-1 lg:overflow-y-auto px-3 py-2 space-y-2 min-h-0">
            {mentor.map((m, i) => (
              <div key={i} className={`rounded-md p-2.5 text-[12px] leading-relaxed whitespace-pre-wrap ${m.pending ? 'opacity-70 ' : ''}${m.role === 'mentor' ? 'bg-surface hairline text-slate-300' : 'bg-raised text-slate-400 ml-6'}`}>
                {m.role === 'mentor' && <p className="font-mono text-[10px] text-diff-emerald mb-1">MENTOR</p>}
                {m.text}
                {m.error && (
                  <span className="mt-2 flex gap-1.5 flex-wrap">
                    {(m.error.action === 'switch_provider') && (
                      <button onClick={() => setCoachSetup(true)} className="btn-ghost flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] text-slate-200">
                        <ArrowLeftRight size={12} /> Switch provider
                      </button>
                    )}
                    {(m.error.action === 'check_key' || m.error.action === 'fix_input') && (
                      <button onClick={() => setCoachSetup(true)} className="btn-ghost flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] text-slate-200">
                        <KeyRound size={12} /> {m.error.action === 'check_key' ? 'Add / fix key' : 'Fix settings'}
                      </button>
                    )}
                    {(m.error.action === 'retry' || m.error.action === 'reconnect') && (
                      <button onClick={() => sendChat(m.error.question)} className="btn-ghost flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] text-slate-200">
                        <RefreshCw size={12} /> Retry
                      </button>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="shrink-0 p-2 border-t border-border flex gap-1.5">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              placeholder="Ask about this problem…"
              className="flex-1 min-w-0 bg-surface hairline rounded-md h-9 px-3 text-[13px] text-slate-200 placeholder:text-slate-500 outline-none focus:border-diff-emerald/40"
            />
            <button onClick={() => sendChat()} disabled={aiBusy} className="btn-ghost w-9 h-9 rounded-md flex items-center justify-center text-slate-300 shrink-0 disabled:opacity-50" aria-label="Send">
              <Send size={15} />
            </button>
          </div>
        </section>
        )}
      </div>
      {victoryOpen && (
        <VictoryModal
          meta={meta}
          totalMs={victoryMs}
          totalCases={totalCount}
          commitInfo={commitInfo}
          github={github}
          xp={victoryXp}
          tier={victoryTier}
          onClose={() => setVictoryOpen(false)}
          onNext={goNext}
        />
      )}
      {langModal && <LanguageRequestModal onClose={() => setLangModal(false)} />}
    </div>
  )
}
