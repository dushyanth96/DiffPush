import React, { useEffect, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, Play, RotateCcw, X } from 'lucide-react'
import { navigate } from '../../data/route.js'
import { track } from '../../lib/analytics.js'

const KEY = 'builtdiff:step0'

const load = () => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { completed: {}, scores: {} }
    const p = JSON.parse(raw)
    return { completed: p.completed ?? {}, scores: p.scores ?? {} }
  } catch { return { completed: {}, scores: {} } }
}
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }

const MODULES = [
  { id: 'complexity', title: 'Time & Space Complexity Math', desc: 'Given code, state Θ time/space across best/avg/worst.' },
  { id: 'recursion', title: 'Recursion Visualization', desc: 'Watch the call stack push and pop, base case included.' },
  { id: 'bitwise', title: 'Bitwise Basics', desc: 'Binary representation, masks, AND/OR/XOR/shifts.' },
  { id: 'memory', title: 'Memory Model (stack vs heap)', desc: 'Where variables live and how pointers alias.' },
  { id: 'stl', title: 'STL / Collection Internals', desc: 'What sort(), vector, hash tables actually do.' },
  { id: 'dryrun', title: 'Dry-Running Techniques', desc: 'Step through code with a variable table.' },
]

// ---- Module 1: Complexity Math ----
const CQ = [
  { code: 'for i in range(n):\n    for j in range(n):\n        print(i+j)', t: 'O(n²)', opts: ['O(n)', 'O(n²)', 'O(n log n)', 'O(1)'] },
  { code: 'i = 1\nwhile i < n:\n    i *= 2', t: 'O(log n)', opts: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'] },
  { code: 'def f(n):\n    if n <= 1: return 1\n    return f(n-1) + f(n-2)', t: 'O(2^n)', opts: ['O(n)', 'O(n²)', 'O(2^n)', 'O(n log n)'] },
  { code: 'a = [0]*n\nfor x in arr: a[x] += 1', t: 'O(n + k)', opts: ['O(n)', 'O(n + k)', 'O(n²)', 'O(k)'] },
  { code: 'sort(arr)\nfor x in arr: print(x)', t: 'O(n log n)', opts: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'] },
]
function ComplexityModule({ onComplete }) {
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const pick = (opt) => {
    if (done) return
    const correct = opt === CQ[i].t
    if (correct) setScore((s) => s + 1)
    if (i + 1 >= CQ.length) { setDone(true); if (score + (correct ? 1 : 0) >= 4) onComplete() }
    else setI((x) => x + 1)
  }
  const reset = () => { setI(0); setScore(0); setDone(false) }
  return (
    <div>
      {!done ? (
        <>
          <p className="text-[12px] text-slate-500 mb-2">Question {i + 1}/{CQ.length} · score {score}</p>
          <pre className="font-mono text-[12px] bg-raised hairline rounded p-3 text-slate-200 whitespace-pre">{CQ[i].code}</pre>
          <p className="text-[12px] text-slate-400 mt-2 mb-1">Time complexity?</p>
          <div className="grid grid-cols-2 gap-2">
            {CQ[i].opts.map((o) => (
              <button key={o} onClick={() => pick(o)} className="btn-ghost h-9 rounded-md text-[13px] font-mono text-slate-200">{o}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-[16px] font-bold text-slate-100">{score}/{CQ.length}</p>
          <p className="text-[12px] text-slate-400 mt-1">{score >= 4 ? 'Passed — module complete.' : 'Need 4/5. Try again.'}</p>
          <button onClick={reset} className="btn-ghost mt-3 px-3 h-8 rounded-md text-[12px] text-slate-200 flex items-center gap-1.5 mx-auto">
            <RotateCcw size={13} /> Retry
          </button>
        </div>
      )}
    </div>
  )
}

// ---- Module 2: Recursion Visualizer ----
function RecursionModule({ onComplete }) {
  const [n, setN] = useState(4)
  const [step, setStep] = useState(0)
  // trace of factorial(n): pushes n..1 then pops
  const frames = []
  for (let i = n; i >= 1; i--) frames.push({ kind: 'call', v: i })
  for (let i = 1; i <= n; i++) frames.push({ kind: 'return', v: i })
  const total = frames.length
  const cur = frames[Math.min(step, total - 1)]
  const stack = []
  for (let j = 0; j <= Math.min(step, total - 1); j++) {
    const f = frames[j]
    if (f.kind === 'call') stack.push(f.v)
    else {
      // pop the last matching
      const idx = stack.lastIndexOf(f.v)
      if (idx >= 0) stack.splice(idx, 1)
    }
  }
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-[12px] text-slate-500">n =</label>
        <input type="range" min={1} max={8} value={n} onChange={(e) => { setN(Number(e.target.value)); setStep(0) }} className="flex-1" />
        <span className="font-mono text-[12px] text-slate-200 w-6 text-right">{n}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-raised hairline rounded p-3 min-h-[160px]">
          <p className="font-mono text-[10px] text-slate-600 mb-2">CALL STACK</p>
          <div className="flex flex-col-reverse gap-1">
            {stack.map((v, idx) => (
              <div key={idx} className="font-mono text-[12px] bg-surface hairline rounded px-2 py-1 text-slate-200">factorial({v})</div>
            ))}
            {stack.length === 0 && <p className="text-[11px] text-slate-600">empty</p>}
          </div>
        </div>
        <div className="bg-raised hairline rounded p-3 min-h-[160px]">
          <p className="font-mono text-[10px] text-slate-600 mb-2">CURRENT STEP</p>
          <p className="font-mono text-[13px] text-slate-200">
            {cur ? (cur.kind === 'call' ? `push factorial(${cur.v})` : `return ${cur.v}!`) : 'done'}
          </p>
          {step >= total - 1 && <p className="text-[12px] text-diff-emerald mt-2">Result: {n}! computed.</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} className="btn-ghost px-2.5 h-8 rounded-md text-[12px] text-slate-300">Prev</button>
        <button onClick={() => {
          const next = Math.min(total - 1, step + 1)
          setStep(next)
          if (next >= total - 1) onComplete()
        }} className="btn-emerald px-3.5 h-8 rounded-md text-[12px] font-semibold flex items-center gap-1.5">
          <Play size={12} /> {step >= total - 1 ? 'Done' : 'Next'}
        </button>
        <button onClick={() => setStep(0)} className="btn-ghost px-2.5 h-8 rounded-md text-[12px] text-slate-300 flex items-center gap-1.5">
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    </div>
  )
}

// ---- Module 3: Bitwise ----
function BitwiseModule({ onComplete }) {
  const [a, setA] = useState(13)
  const [b, setB] = useState(9)
  const [tried, setTried] = useState(new Set())
  const ops = [
    { name: 'AND',  fn: (x, y) => x & y, sym: '&' },
    { name: 'OR',   fn: (x, y) => x | y, sym: '|' },
    { name: 'XOR',  fn: (x, y) => x ^ y, sym: '^' },
    { name: 'NOT a', fn: (x) => ~x, sym: '~' },
    { name: 'a << 2', fn: (x) => x << 2, sym: '<<' },
    { name: 'a >> 1', fn: (x) => x >> 1, sym: '>>' },
  ]
  const [last, setLast] = useState(null)
  const run = (op) => {
    const r = op.fn(a, b)
    setLast({ op: op.name, r })
    const next = new Set(tried); next.add(op.name); setTried(next)
    if (next.size >= 3) onComplete()
  }
  const bin = (v) => (v >>> 0).toString(2).padStart(8, '0')
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[11px] text-slate-500 font-semibold">a</label>
          <input type="number" value={a} onChange={(e) => setA(Number(e.target.value) || 0)} className="w-full bg-surface hairline rounded-md h-9 px-3 font-mono text-[13px] text-slate-200 outline-none" />
          <p className="font-mono text-[11px] text-slate-500 mt-1">{bin(a)}</p>
        </div>
        <div>
          <label className="text-[11px] text-slate-500 font-semibold">b</label>
          <input type="number" value={b} onChange={(e) => setB(Number(e.target.value) || 0)} className="w-full bg-surface hairline rounded-md h-9 px-3 font-mono text-[13px] text-slate-200 outline-none" />
          <p className="font-mono text-[11px] text-slate-500 mt-1">{bin(b)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ops.map((op) => (
          <button key={op.name} onClick={() => run(op)} className="btn-ghost px-2.5 h-8 rounded-md text-[12px] font-mono text-slate-200">
            {op.name}
          </button>
        ))}
      </div>
      {last && (
        <div className="mt-3 bg-raised hairline rounded p-3 font-mono text-[12px] text-slate-200">
          {last.op}: {last.r} <span className="text-slate-500">({bin(last.r)})</span>
        </div>
      )}
      <p className="text-[11px] text-slate-600 mt-2">Tried {tried.size}/3 — try at least 3 operations to complete.</p>
    </div>
  )
}

// ---- Module 4: Memory Model ----
function MemoryModule({ onComplete }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-raised hairline rounded p-3">
          <p className="font-mono text-[10px] text-diff-emerald mb-2">STACK</p>
          <div className="space-y-1 font-mono text-[11px] text-slate-300">
            <div className="bg-surface hairline rounded px-2 py-1">int x = 5</div>
            <div className="bg-surface hairline rounded px-2 py-1">int* p → 0x1000</div>
            <div className="bg-surface hairline rounded px-2 py-1">Node* head</div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 leading-snug">Automatic lifetime. Destroyed when scope exits. Fast, fixed size.</p>
        </div>
        <div className="bg-raised hairline rounded p-3">
          <p className="font-mono text-[10px] text-diff-amber mb-2">HEAP</p>
          <div className="space-y-1 font-mono text-[11px] text-slate-300">
            <div className="bg-surface hairline rounded px-2 py-1">0x1000: Node {'{ value: 5, next: 0x1010 }'}</div>
            <div className="bg-surface hairline rounded px-2 py-1">0x1010: Node {'{ value: 9, next: null }'}</div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 leading-snug">Manual lifetime (new/delete). Slower, grows as needed. Leaks if not freed.</p>
        </div>
      </div>
      <p className="text-[12px] text-slate-400 leading-relaxed">
        <span className="text-slate-200 font-medium">Pointer rule:</span> a pointer is just an address. Two pointers can alias the same heap node — mutating through one is visible through the other. Stack variables are never aliased unless you take their address.
      </p>
      <button onClick={onComplete} className="btn-emerald w-full h-9 rounded-md text-[13px] font-semibold flex items-center justify-center gap-2">
        <Check size={14} /> I've got it — mark complete
      </button>
    </div>
  )
}

// ---- Module 5: STL Internals ----
const SQ = [
  { q: 'Which C++ container gives O(1) average lookup by key?', a: 'std::unordered_map', opts: ['std::map', 'std::unordered_map', 'std::vector', 'std::list'] },
  { q: 'std::sort complexity on a random-access range?', a: 'O(n log n)', opts: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'] },
  { q: 'std::vector push_back amortized cost?', a: 'O(1)', opts: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'] },
  { q: 'std::set is implemented as?', a: 'Red-black tree', opts: ['Hash table', 'Red-black tree', 'Array', 'Linked list'] },
  { q: 'Best container for LRU cache eviction?', a: 'list + unordered_map', opts: ['vector', 'list + unordered_map', 'set', 'deque'] },
]
function StlModule({ onComplete }) {
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const pick = (opt) => {
    if (done) return
    const correct = opt === SQ[i].a
    if (correct) setScore((s) => s + 1)
    if (i + 1 >= SQ.length) { setDone(true); if (score + (correct ? 1 : 0) >= 4) onComplete() }
    else setI((x) => x + 1)
  }
  const reset = () => { setI(0); setScore(0); setDone(false) }
  return (
    <div>
      {!done ? (
        <>
          <p className="text-[12px] text-slate-500 mb-2">Question {i + 1}/{SQ.length} · score {score}</p>
          <p className="text-[13px] text-slate-200 mb-3">{SQ[i].q}</p>
          <div className="grid grid-cols-2 gap-2">
            {SQ[i].opts.map((o) => (
              <button key={o} onClick={() => pick(o)} className="btn-ghost h-9 rounded-md text-[12px] font-mono text-slate-200">{o}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-[16px] font-bold text-slate-100">{score}/{SQ.length}</p>
          <p className="text-[12px] text-slate-400 mt-1">{score >= 4 ? 'Passed — module complete.' : 'Need 4/5. Try again.'}</p>
          <button onClick={reset} className="btn-ghost mt-3 px-3 h-8 rounded-md text-[12px] text-slate-200 flex items-center gap-1.5 mx-auto">
            <RotateCcw size={13} /> Retry
          </button>
        </div>
      )}
    </div>
  )
}

// ---- Module 6: Dry-run trainer ----
const DRY_CODE = `def max_subarray(arr):
    best = cur = arr[0]
    for x in arr[1:]:
        cur = max(x, cur + x)
        best = max(best, cur)
    return best`
const DRY_TRACE = [
  { line: 'best=cur=arr[0]', vars: { best: -2, cur: -2, x: '—' } },
  { line: 'x = -1; cur = max(-1, -3) = -1', vars: { best: -2, cur: -1, x: -1 } },
  { line: 'best = max(-2, -1) = -1', vars: { best: -1, cur: -1, x: -1 } },
  { line: 'x = 3; cur = max(3, 2) = 3', vars: { best: -1, cur: 3, x: 3 } },
  { line: 'best = max(-1, 3) = 3', vars: { best: 3, cur: 3, x: 3 } },
  { line: 'x = 4; cur = max(4, 7) = 7', vars: { best: 3, cur: 7, x: 4 } },
  { line: 'best = max(3, 7) = 7', vars: { best: 7, cur: 7, x: 4 } },
  { line: 'return 7', vars: { best: 7, cur: 7, x: '—' } },
]
function DryRunModule({ onComplete }) {
  const [step, setStep] = useState(0)
  const t = DRY_TRACE[step]
  return (
    <div>
      <pre className="font-mono text-[11px] bg-raised hairline rounded p-3 text-slate-200 whitespace-pre mb-3">{DRY_CODE}</pre>
      <div className="bg-surface hairline rounded p-3 mb-3">
        <p className="font-mono text-[11px] text-diff-emerald mb-1">STEP {step + 1}/{DRY_TRACE.length}</p>
        <p className="text-[12px] text-slate-300 mb-2">{t.line}</p>
        <table className="w-full font-mono text-[11px]">
          <thead><tr className="text-slate-500"><th className="text-left pr-3">var</th><th className="text-left">value</th></tr></thead>
          <tbody>
            {Object.entries(t.vars).map(([k, v]) => (
              <tr key={k} className="text-slate-200"><td className="pr-3">{k}</td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} className="btn-ghost px-2.5 h-8 rounded-md text-[12px] text-slate-300">Prev</button>
        <button onClick={() => {
          const next = Math.min(DRY_TRACE.length - 1, step + 1)
          setStep(next)
          if (next >= DRY_TRACE.length - 1) onComplete()
        }} className="btn-emerald px-3.5 h-8 rounded-md text-[12px] font-semibold flex items-center gap-1.5">
          <Play size={12} /> {step >= DRY_TRACE.length - 1 ? 'Done' : 'Next'}
        </button>
        <button onClick={() => setStep(0)} className="btn-ghost px-2.5 h-8 rounded-md text-[12px] text-slate-300 flex items-center gap-1.5">
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    </div>
  )
}

const MOD_MAP = {
  complexity: ComplexityModule,
  recursion: RecursionModule,
  bitwise: BitwiseModule,
  memory: MemoryModule,
  stl: StlModule,
  dryrun: DryRunModule,
}

export function FoundationsPage({ onBack }) {
  const [state, setState] = useState(load)
  const [active, setActive] = useState(MODULES[0].id)

  const complete = (id) => {
    const next = { ...state, completed: { ...state.completed, [id]: true } }
    setState(next)
    save(next)
    track('step0_complete', { module: id })
  }

  const doneCount = MODULES.filter((m) => state.completed[m.id]).length
  const Active = MOD_MAP[active]

  return (
    <div className="min-h-screen bg-canvas text-slate-200">
      <div className="max-w-[1100px] mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-100">
            <ArrowLeft size={15} /> Hub
          </button>
          <h1 className="text-[18px] font-bold text-slate-100">Step 0: Foundations</h1>
          <span className="font-mono text-[11px] text-slate-500 ml-auto">{doneCount}/{MODULES.length} complete</span>
        </div>
        <p className="text-[13px] text-slate-400 mb-4 leading-relaxed">
          The pre-DSA layer the A2Z sheet assumes you already know. Finish these six modules before touching the sheet, or run them in parallel — your call.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          <div className="space-y-1.5">
            {MODULES.map((m) => (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${
                  active === m.id ? 'bg-raised hairline text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-raised'
                }`}
              >
                <div className="flex items-center gap-2">
                  {state.completed[m.id]
                    ? <Check size={13} className="text-diff-emerald shrink-0" strokeWidth={3} />
                    : <span className="w-3 h-3 rounded-full border border-slate-600 shrink-0" />}
                  <span className="text-[13px] font-medium truncate">{m.title}</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 ml-5 line-clamp-2">{m.desc}</p>
              </button>
            ))}
          </div>
          <div className="card p-5">
            <h2 className="text-[15px] font-bold text-slate-100 mb-3">
              {MODULES.find((m) => m.id === active)?.title}
            </h2>
            <Active onComplete={() => complete(active)} />
          </div>
        </div>
      </div>
    </div>
  )
}
