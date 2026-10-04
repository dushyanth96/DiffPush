import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Flame, RotateCw, Shuffle, Check } from 'lucide-react'
import { getProblemMeta, getProblems, loadManifest } from '../../data/curriculum.js'
import { loadDraft } from '../../hooks/useCodeStore.js'
import { BOX_INTERVALS } from '../../hooks/useTracker.js'
import { navigate } from '../../data/route.js'

const ago = (ts) => {
  if (!ts) return 'New card'
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d <= 0) return 'Reviewed today'
  return `Last reviewed ${d} day${d === 1 ? '' : 's'} ago`
}

export function ReviewView({ tracker, onBack }) {
  const [session, setSession] = useState(null) // [{id, meta, full, draft}]
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [practice, setPractice] = useState(false)

  const buildSession = async (ids) => {
    await loadManifest()
    const cards = []
    for (const id of ids) {
      const meta = getProblemMeta(id)
      if (!meta) continue
      let full = null
      try {
        const r = await fetch(meta.filePath)
        if (r.ok) full = await r.json()
      } catch { /* offline: meta-only card */ }
      const draft = await loadDraft(id).catch(() => null)
      cards.push({ id, meta, full, draft: draft?.code ?? null })
    }
    setSession(cards)
    setPos(0)
    setFlipped(false)
  }

  useEffect(() => {
    buildSession(tracker.getDueCards())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startPractice = async () => {
    let pool = []
    try { pool = getProblems().filter((p) => !tracker.isSolved(p.id)) } catch { pool = [] }
    const ids = [...pool].sort(() => Math.random() - 0.5).slice(0, 5).map((p) => p.id)
    setPractice(true)
    await buildSession(ids)
  }

  const rate = (n) => {
    const card = session?.[pos]
    if (!card) return
    tracker.rateCard(card.id, n)
    if (pos + 1 >= session.length) {
      setSession([])
    } else {
      setPos((p) => p + 1)
      setFlipped(false)
    }
  }

  // Keyboard: Space flip, 1/2/3 rate, Esc back.
  // Skips when focus is in text entry or an open dialog (palette, modals) —
  // otherwise typing "1" in palette search would rate cards, and Esc with the
  // palette open would abandon the drill instead of just closing the palette.
  const inTextEntry = (t) => t?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"], .monaco-editor')
  useEffect(() => {
    const h = (e) => {
      if (inTextEntry(e.target)) return
      if (e.key === 'Escape') { onBack(); return }
      if (!session?.length) return
      if (e.code === 'Space') { e.preventDefault(); setFlipped((f) => !f) }
      else if (e.key === '1') rate(1)
      else if (e.key === '2') rate(2)
      else if (e.key === '3') rate(3)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const card = session?.[pos]
  const box = card ? tracker.boxState[card.id]?.box ?? 1 : 1

  const snapshot = useMemo(() => {
    if (!card) return { label: '', lines: [] }
    if (card.draft) {
      const lines = card.draft.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).slice(0, 8)
      return { label: 'YOUR LAST SNAPSHOT', lines }
    }
    const starter = card.full?.starterCode?.python ?? card.meta?.title ?? ''
    return { label: 'STARTER TEMPLATE', lines: starter.split('\n').slice(0, 8) }
  }, [card])

  if (session === null) {
    return <div className="pt-16 max-w-3xl mx-auto px-4 py-10"><div className="card p-10 text-center font-mono text-[13px] text-slate-500">Loading recall deck…</div></div>
  }

  if (session.length === 0) {
    return (
      <div className="pt-16 min-h-screen">
        <ReviewHeader pos={0} total={0} streak={tracker.stats.currentStreak} onBack={onBack} />
        <div className="max-w-[780px] mx-auto px-4 py-10">
          <div className="card p-10 text-center">
            <Check size={28} className="text-diff-emerald mx-auto" strokeWidth={2.5} />
            <h1 className="text-[18px] font-bold text-slate-100 mt-3">Interview-ready — for now</h1>
            <p className="text-[13px] text-slate-500 mt-1">Zero cards due. Memory decays fast before interviews — run a drill to stay sharp.</p>
            <button onClick={startPractice} className="btn-emerald inline-flex items-center gap-1.5 px-4 h-9 rounded-md text-[13px] font-semibold mt-4">
              <Shuffle size={14} /> Random 5-Card Drill
            </button>
          </div>
        </div>
      </div>
    )
  }

  const hints = card.full?.aiContext?.hintLevels ?? []
  const intuition = hints.length >= 3 ? hints : [...hints, 'Isolate the invariant the answer must preserve.', 'Check the empty and single-element boundaries.', 'Confirm the Big-O against the target before finalizing.'].slice(0, 3)

  return (
    <div className="pt-16 min-h-screen">
      <ReviewHeader pos={pos + 1} total={session.length} streak={tracker.stats.currentStreak} onBack={onBack} practice={practice} />
      <div className="max-w-[780px] mx-auto px-4 py-6">
        <div className="card p-5 sm:p-6">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[16px] font-bold text-slate-100">{card.meta.canonicalTitle}</h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-slate-400 border-border">{card.meta.difficulty}</span>
            <span className="ml-auto font-mono text-[11px] text-diff-violet">Box {box} · Interval {BOX_INTERVALS[box]}d · {ago(tracker.boxState[card.id]?.lastReviewed)}</span>
          </div>
          <p className="text-[12px] text-slate-500 mt-0.5">{card.meta.topicName} · {card.meta.levelName}</p>

          {/* front */}
          <p className="text-[13px] text-slate-300 mt-4 leading-relaxed">{card.full?.narrative?.scenario ?? card.meta.title}</p>
          <div className="mt-3 flex items-center gap-2 font-mono text-[12px]">
            <span className="text-slate-500">Target:</span>
            <span className="text-diff-emerald">{card.meta.optimalTime}</span>
            <span className="text-slate-600">·</span>
            <span className="text-diff-emerald">{card.meta.optimalSpace}</span>
          </div>

          {/* back */}
          {flipped ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-[11px] font-semibold text-slate-400">Intuition Breakdown</p>
              <ul className="mt-2 space-y-1.5">
                {intuition.map((h, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-slate-300 leading-relaxed">
                    <span className="font-mono text-diff-emerald shrink-0">{i + 1}.</span> {h.replace(/^Level \d+:\s*/, '')}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] font-semibold text-slate-400">{snapshot.label}</p>
              <pre className="mt-2 rounded-md bg-[#07090E] hairline p-3 font-mono text-[12px] leading-relaxed text-slate-300 overflow-x-auto">
                {snapshot.lines.join('\n') || '// no snapshot yet — solve it in the IDE first'}
              </pre>
            </div>
          ) : (
            <button onClick={() => setFlipped(true)} className="btn-ghost w-full mt-4 h-10 rounded-md text-[13px] font-medium text-slate-200">
              Reveal Intuition & Snapshot (Space)
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5 mt-3">
          {[
            ['1', 'Hard / Reset', 'Box 1 · tomorrow', '+0'],
            ['2', 'Good / Maintained', 'Advance 1 box', '+250'],
            ['3', 'Optimal / Instant', 'Jump 2 boxes', '+500'],
          ].map(([key, label, sub, diff]) => (
            <button key={key} onClick={() => rate(Number(key))} className="card card-hover p-3 text-left transition-colors">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-100">
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-raised hairline text-slate-400">{key}</kbd> {label}
              </span>
              <span className="block font-mono text-[10px] text-slate-500 mt-1">{sub} · <span className="text-diff-emerald">{diff} DIFF</span></span>
            </button>
          ))}
        </div>
        <p className="text-center font-mono text-[10px] text-slate-500 mt-3">Space flip · 1/2/3 rate · Esc hub</p>
      </div>
    </div>
  )
}

function ReviewHeader({ pos, total, streak, onBack, practice }) {
  return (
    <div className="border-b border-border bg-canvas px-4 py-2.5 flex items-center gap-3">
      <button onClick={onBack} className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-100">
        <ArrowLeft size={15} /> Back to Hub <kbd className="font-mono text-[10px] text-slate-600 hidden sm:inline">[Esc]</kbd>
      </button>
      <span className="font-mono text-[12px] text-slate-500">diffpush // recall{practice ? ' // practice' : ''}</span>
      <span className="font-mono text-[12px] text-slate-400 ml-auto">Card {pos} of {total}</span>
      <span className="pill flex items-center gap-1 px-2.5 h-7 text-[12px] bg-surface">
        <Flame size={13} className="text-diff-amber" /><span className="font-mono">{streak}</span>
      </span>
    </div>
  )
}

export function RecallDrillButton() {
  return (
          <button onClick={() => navigate('/review')} className="btn-ghost flex items-center justify-center gap-1.5 h-8 rounded-md text-[13px] font-medium text-slate-200">
      <RotateCw size={14} /> Start Recall Drill
    </button>
  )
}
