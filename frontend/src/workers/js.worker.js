// Local JavaScript runner (classic Web Worker, killed by the hook on timeout).
// Contract in:  { type:'run', id, code, testCases, functionName }
// Contract out: { type:'result', id, status, results, totalTimeMs, error }
// Mirrors the Pyodide harness semantics: ops-replay / single-call / ctor-repeat,
// name-bound args, serialize-then-compare (superset of Python ==).

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
const LENGTH_NAMES = new Set(['n', 'm', 'len', 'length', 'size', 'sz', 'num'])
const OPS_KEYS = new Set(['operations', 'ops'])

// ---------- canonical JSON (numbers normalized, keys sorted, linked structs walked)
function canonical(v, seen = new Set()) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return 'null'
    if (Object.is(v, -0)) return '0'
    return Number.isInteger(v) ? String(v) : String(v)
  }
  if (typeof v === 'bigint') {
    const n = Number(v)
    return Number.isSafeInteger(n) ? String(n) : JSON.stringify(v.toString())
  }
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v !== 'object') return JSON.stringify(String(v))
  if (seen.has(v)) return '"<cycle>"'
  seen.add(v)
  // linked-list walk: {data|val, next}
  const keys = Object.keys(v)
  const hasNext = 'next' in v
  const dataKey = 'data' in v ? 'data' : ('val' in v && !('left' in v) ? 'val' : null)
  if (!Array.isArray(v) && hasNext && dataKey && keys.length <= 3) {
    const out = []
    let cur = v
    let guard = 0
    while (cur && typeof cur === 'object' && guard++ < 10000) {
      out.push(canonical(cur[dataKey], seen))
      cur = cur.next
    }
    seen.delete(v)
    return '[' + out.join(',') + ']'
  }
  // binary-tree walk: {val, left, right} -> trimmed level order
  if (!Array.isArray(v) && 'val' in v && 'left' in v && 'right' in v && keys.length <= 4) {
    const lvl = [v]
    const vals = []
    let guard = 0
    for (let i = 0; i < lvl.length && guard++ < 10000; i++) {
      const n = lvl[i]
      if (n === null || n === undefined) { vals.push('null'); continue }
      vals.push(canonical(n.val, seen))
      lvl.push(n.left ?? null, n.right ?? null)
    }
    while (vals.length && vals[vals.length - 1] === 'null') vals.pop()
    seen.delete(v)
    return '[' + vals.join(',') + ']'
  }
  if (Array.isArray(v)) {
    const s = '[' + v.map((x) => canonical(x, seen)).join(',') + ']'
    seen.delete(v)
    return s
  }
  const ks = keys.sort()
  const s = '{' + ks.map((k) => JSON.stringify(k) + ':' + canonical(v[k], seen)).join(',') + '}'
  seen.delete(v)
  return s
}

const canonEqual = (a, b) => {
  try { return canonical(a) === canonical(b) } catch { return false }
}

function jsonable(v) {
  try { JSON.stringify(v); return v }
  catch { try { return String(v) } catch { return '<unprintable>' } }
}

// ---------- user code loading (plain scripts; no import/export)
const IDENT = /^[A-Za-z_$][\w$]*$/
function extractNames(code) {
  const names = new Set()
  const add = (n) => { if (IDENT.test(n) && n !== 'undefined') names.add(n) }
  for (const m of code.matchAll(/(?:^|[\s;}])(?:async\s+)?function\s*(\*?)\s*([A-Za-z_$][\w$]*)\s*\(/gm)) add(m[2])
  for (const m of code.matchAll(/(?:^|[\s;}])(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/gm)) add(m[1])
  for (const m of code.matchAll(/(?:^|[\s;}])(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) add(m[1])
  return [...names].slice(0, 50)
}

function loadUser(code) {
  const names = extractNames(code)
  const tail = names.length
    ? '\n;return { ' + names.map((n) => `${JSON.stringify(n)}: (typeof ${n} !== "undefined" ? ${n} : undefined)`).join(', ') + ' };'
    : '\n;return {};'
  const factory = new Function(code + tail)
  const g = factory()
  const out = {}
  for (const k of Object.keys(g)) if (g[k] !== undefined) out[k] = g[k]
  return out
}

// ---------- signatures
function isClass(fn) {
  if (typeof fn !== 'function') return false
  try { return /^\s*class[\s{]/.test(Function.prototype.toString.call(fn)) } catch { return false }
}

// Constructor params for a class (default ctor -> []). Mirrors required_init_params:
// the class-string's first parens belong to a method, NOT the constructor.
function ctorParams(cls) {
  let src = ''
  try { src = Function.prototype.toString.call(cls) } catch { return [] }
  const m = src.match(/constructor\s*\(([^)]*)\)/)
  if (!m) return []
  return splitTop(m[1]).map((p) => {
    p = p.trim()
    if (!p) return null
    if (p.startsWith('...')) return { name: p.slice(3).trim(), dflt: undefined, rest: true }
    const eq = p.indexOf('=')
    if (eq >= 0) return { name: p.slice(0, eq).trim(), dflt: p.slice(eq + 1).trim(), rest: false }
    if (/[{}\[\]]/.test(p)) return { name: '', dflt: undefined, rest: false }
    return { name: p, dflt: undefined, rest: false }
  }).filter(Boolean)
}
function paramList(fn) {
  let src = ''
  try { src = Function.prototype.toString.call(fn) } catch { return [] }
  let m = src.match(/^[^(]*\(([^)]*)\)/)
  if (!m) {
    const am = src.match(/^([A-Za-z_$][\w$]*)\s*=>/)
    if (am) return [{ name: am[1], dflt: undefined, rest: false }]
    return []
  }
  return splitTop(m[1]).map((p) => {
    p = p.trim()
    if (!p) return null
    if (p.startsWith('...')) return { name: p.slice(3).trim(), dflt: undefined, rest: true }
    const eq = p.indexOf('=')
    if (eq >= 0) return { name: p.slice(0, eq).trim(), dflt: p.slice(eq + 1).trim(), rest: false }
    // destructuring has no usable name -> positional only
    if (/[{}\[\]]/.test(p)) return { name: '', dflt: undefined, rest: false }
    return { name: p, dflt: undefined, rest: false }
  }).filter(Boolean)
}

function splitTop(s) {
  const parts = []
  let depth = 0, cur = ''
  let str = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (str) {
      cur += c
      if (c === str && s[i - 1] !== '\\') str = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { str = c; cur += c; continue }
    if ('([{'.includes(c)) depth++
    if (')]}'.includes(c)) depth--
    if (c === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += c
  }
  parts.push(cur)
  return parts
}

function evalDefault(expr) {
  try { return new Function(`return (${expr});`)() } catch { return undefined }
}

// ---------- arg binding (mirror of bind_args)
function bindArgs(params, inputs) {
  if (!params.length) return []
  if (inputs === null || typeof inputs !== 'object' || Array.isArray(inputs)) return [inputs]
  const remaining = { ...inputs }
  const bound = {}
  for (const p of params) {
    if (!p.name || p.rest) continue
    for (const k of Object.keys(remaining)) {
      if (norm(k) === norm(p.name)) { bound[p.name] = remaining[k]; delete remaining[k]; break }
    }
  }
  const lists = Object.values(bound).filter((v) => Array.isArray(v) || typeof v === 'string')
  let li = 0
  const args = []
  for (const p of params) {
    if (p.rest) break // extra inputs ignored, like Python *args swallowing
    if (p.name && p.name in bound) args.push(bound[p.name])
    else if (Object.keys(remaining).length) {
      const k = Object.keys(remaining)[0]
      args.push(remaining[k]); delete remaining[k]
    } else if (p.name && LENGTH_NAMES.has(norm(p.name)) && li < lists.length) {
      args.push(lists[li].length); li++
    } else if (p.dflt !== undefined) {
      args.push(evalDefault(p.dflt))
    } else if (!p.name) {
      throw new TypeError(`missing argument for destructured parameter (inputs: ${Object.keys(inputs)})`)
    } else {
      throw new TypeError(`missing argument for '${p.name}' (inputs: ${Object.keys(inputs)})`)
    }
  }
  return args
}

function publicMethods(cls) {
  try {
    const names = Object.getOwnPropertyNames(cls.prototype || {}).filter((m) => m !== 'constructor' && typeof cls.prototype[m] === 'function')
    // also static methods
    for (const m of Object.getOwnPropertyNames(cls)) {
      if (m !== 'prototype' && m !== 'length' && m !== 'name' && typeof cls[m] === 'function' && !names.includes(m)) names.push(m)
    }
    return names
  } catch { return [] }
}

function findMethod(inst, name) {
  if (inst == null) return null
  if (typeof inst[name] === 'function') return inst[name].bind(inst)
  for (const m of Object.getOwnPropertyNames(Object.getPrototypeOf(inst) || {})) {
    if (typeof inst[m] === 'function' && norm(m) === norm(name)) return inst[m].bind(inst)
  }
  return null
}

function opsKeyOf(inputs) {
  if (inputs && typeof inputs === 'object' && !Array.isArray(inputs)) {
    for (const k of Object.keys(inputs)) {
      if (OPS_KEYS.has(norm(k)) && Array.isArray(inputs[k])) return k
    }
  }
  return null
}

function construct(cls, other) {
  let params = []
  try { params = ctorParams(cls) } catch { return new cls() }
  if (!params.length) {
    try { return new cls() } catch { return new cls() }
  }
  const args = bindArgs(params, (other && typeof other === 'object') ? other : {})
  return new cls(...args)
}

function opsReplay(cls, ops, other) {
  const inst = construct(cls, other)
  const collected = []
  for (const op of ops) {
    const name = (op && op[0]) || ''
    const args = op && op.length > 1 ? op.slice(1) : []
    const meth = findMethod(inst, name)
    if (!meth) {
      if (!args.length) { collected.push(null); continue }
      throw new Error(`unknown operation: ${name}`)
    }
    collected.push(jsonable(meth(...args)))
  }
  return collected
}

function listsMatch(actual, exp) {
  if (canonEqual(actual, exp)) return true
  if (Array.isArray(exp) && exp.every((e) => e !== null && e !== undefined)) {
    return canonEqual((actual || []).filter((x) => x !== null && x !== undefined), exp)
  }
  return false
}

// Resolve the entrypoint class: prefer Solution, else the single class in
// scope, else the first class (mirrors resolve_class).
function resolveClass(g) {
  if (typeof g.Solution === 'function') return g.Solution
  const classes = Object.keys(g).filter((k) => isClass(g[k]))
  if (classes.length === 1) return g[classes[0]]
  return classes.length ? g[classes[0]] : null
}

function ctorRepeat(cls, inputs) {
  const methods = publicMethods(cls)
  if (methods.length !== 1 || !inputs || typeof inputs !== 'object') {
    throw new TypeError('constructor-repeat needs exactly one public method')
  }
  const initPs = (() => { try { return ctorParams(cls) } catch { return [] } })()
  const inst = new cls(...bindArgs(initPs, inputs))
  const consumed = new Set()
  const rem = { ...inputs }
  for (const p of initPs) {
    if (!p.name || p.rest) continue
    let hit = null
    for (const k of Object.keys(rem)) if (norm(k) === norm(p.name)) { hit = k; break }
    if (hit) { consumed.add(hit); delete rem[hit] }
    else if (Object.keys(rem).length) { const k = Object.keys(rem)[0]; consumed.add(k); delete rem[k] }
  }
  const repeatLists = Object.keys(inputs).filter((k) => !consumed.has(k) && Array.isArray(inputs[k]))
  if (repeatLists.length !== 1) throw new TypeError('constructor-repeat needs exactly one leftover list input')
  const meth = inst[methods[0]].bind(inst)
  return inputs[repeatLists[0]].map((x) => jsonable(meth(x)))
}

// ---------- stdout capture
function captureStdout(fn) {
  const buf = []
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info }
  const push = (...a) => { buf.push(a.map((x) => { try { return typeof x === 'string' ? x : JSON.stringify(x) } catch { return String(x) } }).join(' ')) }
  console.log = push; console.error = push; console.warn = push; console.info = push
  try { return { value: fn(), out: buf.join('\n') } }
  finally { console.log = orig.log; console.error = orig.error; console.warn = orig.warn; console.info = orig.info }
}

function stack3(err) {
  const s = String((err && err.stack) || err)
  return s.split('\n').slice(0, 4).join('\n')
}

// ---------- main
self.onmessage = async (e) => {
  const { id, code, testCases, functionName } = e.data ?? {}
  if (e.data?.type === 'warm') { try { self.postMessage({ type: 'ready' }) } catch {} return }
  const t0 = performance.now()
  const fail = (error) => self.postMessage({ type: 'result', id, status: 'error', results: [], totalTimeMs: Math.round(performance.now() - t0), error })
  let g
  try {
    g = loadUser(code)
  } catch (err) {
    fail(stack3(err))
    return
  }
  const results = []
  try {
    const Cls = resolveClass(g)
    try { self.postMessage({ type: 'started', id }) } catch {}
    // plain functions (exclude classes)
    const fns = Object.keys(g).filter((k) => typeof g[k] === 'function' && k !== 'Solution' && !isClass(g[k]))
    for (const tc of testCases ?? []) {
      const rawIn = tc.input
      const exp = tc.expected
      const start = performance.now()
      try {
        const { value: actual, out } = captureStdout(() => {
          const OPKEY = opsKeyOf(rawIn)
          if (OPKEY !== null && Cls) {
            const other = Object.fromEntries(Object.entries(rawIn).filter(([k]) => k !== OPKEY))
            return opsReplay(Cls, rawIn[OPKEY], other)
          }
          const needsCtor = (() => {
            if (!Cls) return false
            let ps = []
            try { ps = ctorParams(Cls) } catch { return false }
            const required = ps.filter((p) => !p.rest && p.dflt === undefined && p.name)
            if (!required.length) return false
            if (functionName && typeof g[functionName] === 'function') return false
            return true
          })()
          if (needsCtor) return ctorRepeat(Cls, rawIn)
          let target = null
          let methodParams = null
          if (functionName && typeof g[functionName] === 'function') target = g[functionName]
          if (!target && Cls) {
            const methods = publicMethods(Cls)
            if (methods.length) {
              const inst = (() => { try { return new Cls() } catch { return null } })()
              if (inst) {
                const raw = inst[methods[0]]
                // NOTE: read params BEFORE bind — bound fns report () natively.
                methodParams = paramList(raw)
                target = raw.bind(inst)
              }
            }
          }
          if (!target && fns.length) target = g[fns[0]]
          if (!target) throw new Error('No callable found: define a Solution class or a function.')
          const args = bindArgs(methodParams ?? paramList(target), rawIn)
          return target(...args)
        })
        const ms = performance.now() - start
        let passed
        if (Array.isArray(exp) && Array.isArray(actual)) passed = listsMatch(actual, exp)
        else passed = canonEqual(actual, exp)
        results.push({ id: tc.id, input: jsonable(rawIn), expected: jsonable(exp), actual: jsonable(actual), passed: !!passed, stdout: out, runtimeMs: Math.round(ms * 100) / 100 })
      } catch (err) {
        const ms = performance.now() - start
        results.push({ id: tc.id, input: jsonable(rawIn), expected: jsonable(exp), actual: null, passed: false, stdout: stack3(err), runtimeMs: Math.round(ms * 100) / 100 })
      }
    }
  } catch (err) {
    fail(stack3(err))
    return
  }
  const passedCount = results.filter((r) => r.passed).length
  self.postMessage({
    type: 'result', id, results,
    status: passedCount === results.length && results.length > 0 ? 'passed' : 'failed',
    totalTimeMs: Math.round(performance.now() - t0), error: null,
  })
}
