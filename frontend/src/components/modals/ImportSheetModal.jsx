import React, { useEffect, useRef, useState } from 'react'
import { X, FileUp, Loader2, Check } from 'lucide-react'
import { importSheet } from '../../data/sheets.js'
import { track } from '../../lib/analytics.js'

// Accepts a pasted JSON blob or a .json file. Shape: {name, problems:[...]}
// where each problem needs a title and/or link (LeetCode, GfG, etc).
export function ImportSheetModal({ onClose, onImported }) {
  const [raw, setRaw] = useState('')
  const [fileName, setFileName] = useState(null)
  const [status, setStatus] = useState('form') // form | importing | done | error
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && status !== 'importing') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, status])

  const readFile = async (file) => {
    if (!file) return
    try {
      const text = await file.text()
      setRaw(text)
      setFileName(file.name)
    } catch {
      setError('Could not read that file.')
    }
  }

  const doImport = async () => {
    setStatus('importing')
    setError('')
    try {
      const parsed = JSON.parse(raw)
      const res = await importSheet(parsed)
      setResult(res)
      setStatus('done')
      track('sheet_imported', {})
      onImported?.(res)
    } catch (e) {
      setStatus('error')
      setError(e instanceof SyntaxError ? 'That is not valid JSON.' : e.message)
    }
  }

  const canImport = raw.trim().length > 2 && status !== 'importing'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-sheet-title"
      onClick={() => { if (status !== 'importing') onClose() }}
    >
      <div className="card w-full max-w-lg p-6 !bg-popover" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-raised hairline flex items-center justify-center text-diff-emerald shrink-0">
            <FileUp size={17} />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Custom sheet</p>
            <h2 id="import-sheet-title" className="text-[15px] font-bold text-slate-100 mt-1">
              {status === 'done' ? 'Sheet imported!' : 'Import a problem sheet'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Close import dialog" className="ml-auto text-slate-500 hover:text-slate-200 shrink-0">
            <X size={16} />
          </button>
        </div>

        {status === 'done' ? (
          <>
            <p className="text-[13px] text-slate-400 mt-3 leading-relaxed">
              <span className="text-slate-200 font-medium">{result.count} problems</span> saved under this device.
              Re-importing the same sheet name updates it — progress is kept.
            </p>
            <button onClick={onClose} autoFocus className="btn-emerald w-full h-10 rounded-md text-[14px] font-semibold mt-5 flex items-center justify-center gap-2">
              <Check size={15} /> Open my sheets
            </button>
          </>
        ) : (
          <>
            <p className="text-[13px] text-slate-400 mt-3 leading-relaxed">
              Paste JSON or drop a file: <code className="font-mono text-[11px] text-slate-300">{`{"name": "My Sheet", "problems": [{"title": "Two Sum", "link": "https://leetcode.com/problems/two-sum", "difficulty": "Easy"}]}`}</code>
              {' '}— a bare array works too. Each problem needs a title and/or link.
            </p>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer?.files?.[0]) }}
            >
              <textarea
                value={raw}
                onChange={(e) => { setRaw(e.target.value); setFileName(null) }}
                rows={7}
                autoFocus
                spellCheck={false}
                placeholder={'{\n  "name": "Striver A2Z (my copy)",\n  "problems": [\n    { "title": "Largest element", "difficulty": "Easy" }\n  ]\n}'}
                className="w-full mt-3 bg-surface hairline rounded-md p-3 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-diff-emerald/40 resize-none"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => fileRef.current?.click()} className="btn-ghost px-2.5 h-8 rounded-md text-[12px] font-medium text-slate-300 flex items-center gap-1.5">
                <FileUp size={13} /> Choose .json file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => readFile(e.target.files?.[0])}
              />
              {fileName && <span className="font-mono text-[11px] text-slate-500 truncate">{fileName}</span>}
              {error && <span className="ml-auto text-[11px] text-diff-rose truncate" title={error}>{error}</span>}
            </div>
            <button
              onClick={doImport}
              disabled={!canImport}
              className="btn-emerald w-full h-10 rounded-md text-[14px] font-semibold mt-4 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === 'importing' ? <Loader2 size={15} className="animate-spin" /> : null}
              {status === 'importing' ? 'Importing…' : 'Import sheet'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
