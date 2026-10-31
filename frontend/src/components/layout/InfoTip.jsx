import React, { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'

// Small accessible explainer popover. Click (not hover-only) so it works on
// touch, closes on Escape or outside click, and never shifts layout.
export function InfoTip({ label, children, side = 'left', className = '' }) {
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

  const pos = side === 'right'
    ? 'left-7 top-1/2 -translate-y-1/2'
    : side === 'center'
      ? 'left-1/2 -translate-x-1/2 top-7'
      : 'right-7 top-1/2 -translate-y-1/2'

  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o) }}
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-600 hover:text-slate-300 transition-colors"
      >
        <Info size={11} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 w-60 card !bg-popover p-2.5 text-[11px] leading-relaxed text-slate-400 font-sans normal-case tracking-normal ${pos}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </span>
      )}
    </span>
  )
}
