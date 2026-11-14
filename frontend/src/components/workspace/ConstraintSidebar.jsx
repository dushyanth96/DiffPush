import React, { useState } from 'react'
import { ChevronDown, ChevronRight, ShieldAlert, AlertTriangle, ListChecks } from 'lucide-react'

// Topic-keyed pitfall + edge-case hints. These are *heuristic* companions to
// the problem statement, not authoritative — they nudge students toward the
// boundaries that bite on hidden test cases. Keep entries short and concrete.
const TOPIC_HINTS = {
  'Arrays': {
    edge: ['Empty array', 'Single element', 'All elements identical', 'Strictly decreasing input', 'Negative values'],
    pitfalls: ['Off-by-one on the last index', 'Mutating the input while iterating', 'Integer overflow in sum', 'Forgetting to handle n = 0'],
  },
  'Binary Search': {
    edge: ['Empty array', 'Single element', 'Target not present', 'Target at the very ends', 'Duplicate values'],
    pitfalls: ['Mid overflow: (left + right) / 2 → use left + (right - left) / 2', 'Infinite loop when lo/hi don\'t move', 'Off-by-one in the high/low update'],
  },
  'Strings': {
    edge: ['Empty string', 'Single character', 'All same characters', 'Palindrome of odd/even length', 'Unicode / spaces'],
    pitfalls: ['Indexing past the end', 'Mutating while iterating', 'Case sensitivity', 'Off-by-one in substring bounds'],
  },
  'Linked List': {
    edge: ['Empty list', 'Single node', 'Two nodes', 'Cycle present', 'Head is the target'],
    pitfalls: ['Dereferencing null on the tail', 'Losing the head reference', 'Not updating next pointers in order'],
  },
  'Dynamic Programming': {
    edge: ['n = 0 / n = 1', 'All zeros', 'Negative weights', 'Empty subsequence'],
    pitfalls: ['Wrong base case', 'Iterating in the wrong order', 'Forgetting to take mod', 'Off-by-one in the DP table size'],
  },
  'Graphs': {
    edge: ['Disconnected graph', 'Single node', 'Self-loop', 'Multiple edges between same pair', 'Cycle present'],
    pitfalls: ['Not marking visited before recursing', 'Stack overflow on deep graphs', '0 vs 1-based indexing'],
  },
  'Binary Trees': {
    edge: ['Empty tree', 'Single node', 'Skewed (chain) tree', 'Perfect tree', 'Negative node values'],
    pitfalls: ['Null dereference on children', 'Recursing without a base case', 'Confusing height vs depth'],
  },
}
const GENERIC_EDGE = ['Empty input', 'Single element', 'Maximum constraint size', 'All elements identical', 'Negative values']
const GENERIC_PITFALLS = ['Off-by-one on boundaries', 'Uninitialized accumulator', 'Integer overflow', 'Not handling the empty case']

// Crude constraint decoder: turns "1 <= N <= 10^5" style strings into a hint.
function decodeConstraint(c) {
  const m = String(c).match(/(\d+)\s*[≤<=]+\s*[Nn]\s*[≤<=]+\s*10\^?(\d+)/)
  if (m) {
    const exp = Number(m[2])
    if (exp >= 5) return `${c} → O(n log n) or better; O(n²) will TLE.`
    if (exp >= 4) return `${c} → O(n²) is borderline; prefer O(n) or O(n log n).`
    return `${c} → O(n²) is acceptable.`
  }
  return c
}

export function ConstraintSidebar({ problem, meta }) {
  const [open, setOpen] = useState(false)
  const topic = meta?.topicName ?? meta?.topic ?? ''
  const hints = TOPIC_HINTS[topic] ?? { edge: GENERIC_EDGE, pitfalls: GENERIC_PITFALLS }
  const constraints = problem?.narrative?.constraints ?? []

  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 text-left text-[12px] font-semibold text-slate-400 hover:text-slate-200"
        aria-expanded={open}
      >
        {open ? <ChevronDown size={13} className="text-slate-500 shrink-0" /> : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
        <ShieldAlert size={13} className="text-diff-amber shrink-0" />
        Constraint Decoder
      </button>
      {open && (
        <div className="mt-2.5 space-y-3">
          {constraints.length > 0 && (
            <section>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1.5">
                <ListChecks size={11} /> Constraints decoded
              </p>
              <ul className="space-y-1">
                {constraints.map((c, i) => (
                  <li key={i} className="text-[11.5px] text-slate-300 leading-snug font-mono bg-raised hairline rounded px-2 py-1">
                    {decodeConstraint(c)}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1.5">
              <AlertTriangle size={11} className="text-diff-amber" /> Edge-case spotlight
            </p>
            <div className="flex flex-wrap gap-1.5">
              {hints.edge.map((e) => (
                <span key={e} className="font-mono text-[10.5px] text-slate-300 bg-raised hairline rounded px-2 py-1">{e}</span>
              ))}
            </div>
          </section>
          <section>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1.5">
              <ShieldAlert size={11} className="text-diff-rose" /> Common pitfalls
            </p>
            <ul className="space-y-1">
              {hints.pitfalls.map((p) => (
                <li key={p} className="text-[11.5px] text-slate-400 leading-snug">• {p}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
