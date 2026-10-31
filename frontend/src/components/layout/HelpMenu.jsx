import React, { useEffect, useRef, useState } from 'react'
import { HelpCircle, ExternalLink, Bug, Mail, BookOpen, ShieldCheck, Keyboard } from 'lucide-react'
import { REPO_URL } from '../../data/repo.js'
import { CONTACT_EMAIL } from '../../data/support.js'
import { track } from '../../lib/analytics.js'

function diagnostics() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
  const route = typeof window !== 'undefined' ? window.location.pathname : '/'
  const viewport = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '?'
  return [
    `Route: ${route}`,
    `Viewport: ${viewport}`,
    `User agent: ${ua}`,
    `App: DiffPush v1.0`,
    `Time: ${new Date().toISOString()}`,
    '',
    'What happened?',
    '',
    '',
    'What did you expect?',
    '',
    '',
    'Note: no code, GitHub token, or API key is included in this report.',
  ].join('\n')
}

const SHORTCUTS = [
  ['Ctrl / Cmd + K', 'Search problems & commands'],
  ['Ctrl / Cmd + Enter', 'Run tests in the workspace'],
  ['Space', 'Flip a recall card'],
  ['1 / 2 / 3', 'Rate a recall card'],
  ['Esc', 'Close dialogs'],
]

export function HelpMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const bugUrl = `${REPO_URL}/issues/new?labels=bug&title=${encodeURIComponent('[Bug] ')}&body=${encodeURIComponent(diagnostics())}`

  const item = 'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[12px] text-slate-300 hover:bg-raised hover:text-slate-100 transition-colors text-left'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) track('help_open', { entry: 'navbar' }) }}
        className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-100 hover:bg-raised transition-colors"
        title="Help, FAQ & bug reports"
        aria-label="Help and support"
        aria-expanded={open}
      >
        <HelpCircle size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-72 card !bg-popover p-2 z-50">
          <p className="px-2.5 pt-1 pb-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-600">Help</p>
          <a href="/faq/" className={item} onClick={() => setOpen(false)}>
            <BookOpen size={14} className="text-diff-emerald shrink-0" /> Student FAQ
            <ExternalLink size={11} className="ml-auto text-slate-600" />
          </a>
          <a href="/privacy/" className={item} onClick={() => setOpen(false)}>
            <ShieldCheck size={14} className="text-diff-emerald shrink-0" /> What's stored in this browser
            <ExternalLink size={11} className="ml-auto text-slate-600" />
          </a>
          <a href={bugUrl} target="_blank" rel="noreferrer" className={item} onClick={() => { track('help_open', { entry: 'bug' }); setOpen(false) }}>
            <Bug size={14} className="text-diff-amber shrink-0" /> Report a bug
            <ExternalLink size={11} className="ml-auto text-slate-600" />
          </a>
          <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('DiffPush — question')}`} className={item} onClick={() => setOpen(false)}>
            <Mail size={14} className="text-slate-400 shrink-0" /> Email the maintainer
          </a>
          <div className="border-t border-border mt-1.5 pt-1.5">
            <p className="px-2.5 py-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-600">
              <Keyboard size={11} /> Shortcuts
            </p>
            <ul className="px-2.5 pb-1 space-y-1">
              {SHORTCUTS.map(([keys, label]) => (
                <li key={keys} className="flex items-center gap-2 text-[11px] text-slate-500">
                  <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-raised hairline text-slate-400 shrink-0">{keys}</kbd>
                  <span className="truncate">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
