import React, { useEffect, useRef, useState } from 'react'
import { Download, Upload, X, AlertTriangle, Check, FileJson2, ShieldOff } from 'lucide-react'
import { track } from '../../lib/analytics.js'

const fmt = (n) => Number(n ?? 0).toLocaleString()

function summarize(state) {
  const solvedMap = state?.solvedMap && typeof state.solvedMap === 'object' ? state.solvedMap : {}
  return {
    solved: Object.keys(solvedMap).length,
    diff: Number(state?.stats?.diffScore ?? 0),
    streak: Number(state?.stats?.currentStreak ?? 0),
    starred: Array.isArray(state?.starredIds) ? state.starredIds.length : 0,
    recall: Array.isArray(state?.reviewQueue) ? state.reviewQueue.length : 0,
    achievements: Array.isArray(state?.achievements) ? state.achievements.length : 0,
    squares: state?.dailySquares && typeof state.dailySquares === 'object' ? Object.keys(state.dailySquares).length : 0,
  }
}

export function BackupModal({ tracker, onClose }) {
  const [incoming, setIncoming] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState(null)
  const [restored, setRestored] = useState(null)
  const inputRef = useRef(null)
  const current = summarize(tracker)
  const next = incoming ? summarize(incoming) : null

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pickFile = async (file) => {
    setError(null)
    setRestored(null)
    setIncoming(null)
    setFileName(file?.name ?? '')
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || !parsed.stats || !parsed.solvedMap) {
        throw new Error('That file is not a DiffPush backup (missing stats / solvedMap).')
      }
      if (Object.keys(parsed.solvedMap).length > 5000) {
        throw new Error('That backup looks corrupted — too many problem entries.')
      }
      setIncoming(parsed)
    } catch (e) {
      setError(e.message || 'Could not read that file.')
    }
  }

  const restore = () => {
    try {
      tracker.importBackup(JSON.stringify(incoming))
      setRestored(summarize(incoming))
      setIncoming(null)
      track('backup_restore')
    } catch (e) {
      setError(e.message || 'Restore failed.')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="backup-title">
      <div className="card w-full max-w-lg !bg-popover p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-md bg-diff-emerald/10 hairline flex items-center justify-center text-diff-emerald shrink-0">
            <FileJson2 size={17} />
          </span>
          <div>
            <p className="eyebrow">Progress safety</p>
            <h2 id="backup-title" className="text-[16px] font-bold text-slate-100 mt-0.5">Backup &amp; restore</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-raised shrink-0">
            <X size={15} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
          <div className="bg-surface hairline rounded-md p-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">In the .json</p>
            <ul className="mt-1.5 space-y-0.5 text-slate-300">
              <li>{fmt(current.solved)} solved problems + per-problem timings</li>
              <li>{fmt(current.diff)} DIFF · {fmt(current.streak)}-day streak</li>
              <li>{fmt(current.starred)} starred · {fmt(current.recall)} in recall queue</li>
              <li>{fmt(current.achievements)} achievements · {fmt(current.squares)} day squares · goal</li>
            </ul>
          </div>
          <div className="bg-surface hairline rounded-md p-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <ShieldOff size={10} /> Not included
            </p>
            <ul className="mt-1.5 space-y-0.5 text-slate-400">
              <li>Code drafts (kept in this browser's IndexedDB)</li>
              <li>GitHub token (disconnect / reconnect instead)</li>
              <li>AI coach API keys</li>
            </ul>
          </div>
        </div>

        <button
          onClick={() => tracker.exportBackup()}
          className="btn-ghost mt-3 w-full h-9 rounded-md text-[13px] font-medium text-slate-200 flex items-center justify-center gap-1.5"
        >
          <Download size={14} /> Download backup .json
        </button>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-[12px] font-semibold text-slate-300">Restore a backup</p>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Restoring <span className="text-slate-300">replaces</span> local progress with the file's contents. GitHub commits already pushed are not deleted.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="btn-ghost mt-2.5 w-full h-9 rounded-md text-[13px] font-medium text-slate-200 flex items-center justify-center gap-1.5"
          >
            <Upload size={14} /> Choose backup file
          </button>
          {fileName && <p className="mt-1.5 font-mono text-[10px] text-slate-500 truncate">{fileName}</p>}

          {error && (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-diff-amber">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {error}
            </p>
          )}

          {next && (
            <div className="mt-3 bg-surface hairline rounded-md p-3">
              <p className="text-[12px] text-slate-300">
                This file has <span className="font-mono text-slate-100">{fmt(next.solved)}</span> solved ·{' '}
                <span className="font-mono text-slate-100">{fmt(next.diff)}</span> DIFF ·{' '}
                <span className="font-mono text-slate-100">{fmt(next.recall)}</span> recall cards.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-2.5">
                <button onClick={restore} className="btn-emerald px-3.5 h-8 rounded-md text-[12px] font-semibold">
                  Replace my progress
                </button>
                <button onClick={() => { setIncoming(null); setFileName(''); if (inputRef.current) inputRef.current.value = '' }} className="btn-ghost px-3 h-8 rounded-md text-[12px] text-slate-300">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {restored && (
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-diff-emerald">
              <Check size={14} /> Restored {fmt(restored.solved)} solved problems and {fmt(restored.diff)} DIFF.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
