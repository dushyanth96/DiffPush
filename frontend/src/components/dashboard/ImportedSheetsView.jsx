import React, { useEffect, useMemo, useState } from 'react'
import { FileUp, Trash2, ChevronDown, ChevronRight, ExternalLink, FolderOpen, Check, Circle, Search } from 'lucide-react'
import { listSheets, getSheet, deleteSheet, setSheetSolved } from '../../data/sheets.js'
import { ImportSheetModal } from '../modals/ImportSheetModal.jsx'

const DIFF_STYLE = {
  Easy: 'text-diff-emerald border-diff-emerald/30 bg-diff-emerald/10',
  Medium: 'text-diff-amber border-diff-amber/30 bg-diff-amber/10',
  Hard: 'text-diff-rose border-diff-rose/30 bg-diff-rose/10',
}

function SheetCard({ meta, onChanged }) {
  const [open, setOpen] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [q, setQ] = useState('')

  const load = async () => { setSheet(await getSheet(meta.slug)) }
  useEffect(() => { if (open) load() }, [open, meta.slug])

  const rows = useMemo(() => {
    if (!sheet) return []
    const query = q.trim().toLowerCase()
    if (!query) return sheet.problems
    return sheet.problems.filter((p) =>
      `${p.title} ${p.topic} ${p.difficulty ?? ''}`.toLowerCase().includes(query))
  }, [sheet, q])

  const toggle = async (p, solved) => {
    await setSheetSolved(meta.slug, p.id, solved)
    setSheet(await getSheet(meta.slug))
    onChanged?.()
  }

  const remove = async () => {
    await deleteSheet(meta.slug)
    onChanged?.()
  }

  const pct = meta.count ? Math.round((meta.solved / meta.count) * 100) : 0

  return (
    <div className="card overflow-hidden">
      <div className="relative w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-raised transition-colors">
        <button onClick={() => setOpen((o) => !o)} className="relative flex items-center gap-2.5 flex-1 min-w-0 text-left">
          {open ? <ChevronDown size={15} className="text-slate-500 shrink-0" /> : <ChevronRight size={15} className="text-slate-500 shrink-0" />}
          <FolderOpen size={14} className="text-diff-emerald shrink-0" />
          <h2 className="text-sm font-semibold tracking-tight text-slate-100 truncate">{meta.name}</h2>
          <span className="pill ml-auto shrink-0 px-2 py-px font-mono text-[11px] text-slate-400">{meta.solved}/{meta.count} Done</span>
          <span className="hidden sm:block w-16 h-1.5 rounded-full bg-[#1A2333] overflow-hidden shrink-0">
            <span className="block h-full bg-diff-emerald rounded-full" style={{ width: `${pct}%` }} />
          </span>
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-1.5 shrink-0">
            <button onClick={remove} className="px-2 h-7 rounded-md text-[11px] font-semibold text-diff-rose border border-diff-rose/30 hover:bg-diff-rose/10">Delete</button>
            <button onClick={() => setConfirmDelete(false)} className="px-2 h-7 rounded-md text-[11px] text-slate-400 hover:text-slate-200">Cancel</button>
          </span>
        ) : (
          <button onClick={() => setConfirmDelete(true)} title="Delete this sheet" aria-label={`Delete ${meta.name}`} className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-slate-600 hover:text-diff-rose hover:bg-raised transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {open && (
        <div className="px-2 pb-2 border-t border-border pt-1">
          <div className="flex items-center gap-2 px-2 pt-1.5">
            <Search size={13} className="text-slate-600 shrink-0" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${meta.count} problems…`}
              className="flex-1 min-w-0 h-7 bg-transparent text-[12px] text-slate-200 placeholder:text-slate-600 outline-none"
            />
          </div>
          <div className="py-1">
            {rows.map((p) => {
              const solved = Boolean(sheet.solvedMap[p.id])
              return (
                <div key={p.id} className={`flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-raised transition-colors ${solved ? 'bg-diff-emerald/[0.05]' : ''}`}>
                  <button
                    onClick={() => toggle(p, !solved)}
                    title={solved ? 'Mark unsolved' : 'Mark solved'}
                    aria-pressed={solved}
                    aria-label={`${solved ? 'Unmark' : 'Mark'} ${p.title} solved`}
                    className="shrink-0 w-4 flex justify-center text-slate-600 hover:text-diff-emerald"
                  >
                    {solved ? <Check size={15} className="text-diff-emerald" strokeWidth={3} /> : <Circle size={14} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block text-[13px] font-medium truncate transition-colors ${solved ? 'text-slate-500 line-through decoration-slate-600 hover:text-diff-emerald' : 'text-slate-200 hover:text-diff-emerald'}`}
                    >
                      {p.title} <ExternalLink size={10} className="inline text-slate-600" />
                    </a>
                    {p.note && <p className="text-[11px] text-slate-500 line-clamp-1">{p.note}</p>}
                  </div>
                  <span className="hidden sm:inline-block font-mono text-[10px] text-slate-600 truncate max-w-[120px]">{p.topic}</span>
                  {p.difficulty && (
                    <span className={`hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border ${DIFF_STYLE[p.difficulty]}`}>
                      {p.difficulty}
                    </span>
                  )}
                </div>
              )
            })}
            {rows.length === 0 && (
              <p className="px-3 py-2 text-[12px] text-slate-500">No problems match "{q}".</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// "My Sheets" view: custom imported problem lists with local progress.
export function ImportedSheetsView() {
  const [sheets, setSheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [importOpen, setImportOpen] = useState(false)

  const refresh = async () => {
    setSheets(await listSheets())
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  return (
    <div>
      <div className="card p-2 mb-2.5 flex items-center gap-2">
        <p className="pl-1 text-[12px] text-slate-500 flex-1 min-w-0 truncate">
          Your imported sheets — any JSON list of problems with links. Progress stays on this device.
        </p>
        <button onClick={() => setImportOpen(true)} className="btn-emerald shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-md text-[12px] font-semibold">
          <FileUp size={13} /> Import sheet
        </button>
      </div>
      {loading ? (
        <div className="card p-10 text-center font-mono text-[13px] text-slate-500">Loading sheets…</div>
      ) : sheets.length === 0 ? (
        <div className="card p-10 text-center text-[13px] text-slate-500">
          No custom sheets yet. Import Striver's sheet, a college list, or any problem JSON —
          <button onClick={() => setImportOpen(true)} className="ml-1.5 text-diff-emerald hover:underline">import your first sheet</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sheets.map((s) => (
            <SheetCard key={s.slug} meta={s} onChanged={refresh} />
          ))}
        </div>
      )}
      {importOpen && (
        <ImportSheetModal
          onClose={() => setImportOpen(false)}
          onImported={() => refresh()}
        />
      )}
    </div>
  )
}
