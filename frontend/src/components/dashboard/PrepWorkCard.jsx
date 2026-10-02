import React, { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, BookOpen } from 'lucide-react'
import prep from '../../data/prerequisites.json'

// Step 0 overlay — pure reference content. No tracker, no DIFF, no solvedMap.
// Mounted above the 369-problem curriculum so it reads as "do this first".
export function PrepWorkCard() {
  const [open, setOpen] = useState(false)
  const [openModule, setOpenModule] = useState(null)

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="relative w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-raised transition-colors overflow-hidden">
        {open ? <ChevronDown size={15} className="text-slate-500 shrink-0 relative" /> : <ChevronRight size={15} className="text-slate-500 shrink-0 relative" />}
        <span className="font-mono text-[12px] text-slate-500 shrink-0 relative">00</span>
        <h2 className="text-sm font-semibold tracking-tight text-slate-100 truncate relative">{prep.label}</h2>
        <span className="relative shrink-0 px-1.5 py-px rounded-md font-mono text-[10px] font-bold tracking-[0.12em] text-[#0B0714] bg-[#6366F1]">
          {prep.tag.toUpperCase()}
        </span>
        <span className="pill ml-auto shrink-0 px-2 py-px font-mono text-[11px] text-slate-400 relative">
          {prep.modules.reduce((n, m) => n + m.sections.reduce((s, sec) => s + sec.items.length, 0), 0)} refs
        </span>
      </button>
      {open && (
        <div className="px-2 pb-2 border-t border-border pt-1">
          <p className="px-3 pt-2 text-[12px] text-slate-500">{prep.blurb}</p>
          {prep.modules.map((mod, mi) => {
            const expanded = openModule === mod.id
            return (
              <div key={mod.id} className="border-b border-border/50 last:border-0">
                <button
                  onClick={() => setOpenModule(expanded ? null : mod.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-raised rounded-md transition-colors"
                >
                  {expanded
                    ? <ChevronDown size={13} className="text-slate-500 shrink-0" />
                    : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
                  <span className="font-mono text-[10px] text-slate-500">M{mi + 1}</span>
                  <span className="text-[12px] font-semibold tracking-wide text-slate-300 uppercase">{mod.title}</span>
                  <span className="font-mono text-[10px] text-slate-500 ml-auto">
                    {mod.sections.reduce((s, sec) => s + sec.items.length, 0)} refs
                  </span>
                </button>
                {expanded && (
                  <div className="pb-1">
                    {mod.sections.map((sec) => (
                      <div key={sec.id} className="mb-2 last:mb-0">
                        <p className="px-3 pt-1.5 pb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                          <BookOpen size={11} className="text-slate-600" /> {sec.title}
                        </p>
                        {sec.items.map((item) => (
                          <a
                            key={item.url}
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-raised transition-colors group"
                          >
                            <span className="flex-1 min-w-0">
                              <span className="block text-[13px] font-medium text-slate-200 truncate group-hover:text-diff-emerald transition-colors">
                                {item.title}
                              </span>
                              <span className="block text-[11px] text-slate-500 truncate">{item.note}</span>
                            </span>
                            <ExternalLink size={13} className="text-slate-600 group-hover:text-diff-emerald transition-colors shrink-0" />
                          </a>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
