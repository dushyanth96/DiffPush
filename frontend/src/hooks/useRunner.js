import { useEffect, useRef } from 'react'
import { buildJavaSource } from '../data/drivers/java.js'
import { buildCppSource } from '../data/drivers/cpp.js'
import { runRemote } from '../data/remote.js'

export const RUN_TIMEOUT_MS = 5000 // exec budget, counted from engine-ready
const LOAD_TIMEOUT_MS = 90000 // engine CDN load ceiling (slow networks)
const LOAD_MESSAGE = 'Engine took too long to load (slow network?). Check your connection and run again — your code is untouched.'

// Engine presentation per language id.
export const ENGINES = {
  python: { label: 'Python · WASM local', worker: true },
  javascript: { label: 'JavaScript · local', worker: true },
  java: { label: 'Java · remote compiler', worker: false },
  cpp: { label: 'C++ · remote compiler', worker: false },
}

const WORKER_URL = {
  python: new URL('../workers/pyodide.worker.js', import.meta.url),
  javascript: new URL('../workers/js.worker.js', import.meta.url),
}

const b64encode = (s) => {
  try { return btoa(unescape(encodeURIComponent(s))) } catch { return '' }
}

// Unified run(code, testCases, { language }) -> { status, results, totalTimeMs, error }.
// Local engines run in a fresh worker per invocation (5s kill, same as before);
// remote engines build driver source and POST to Wandbox (60s cap).
export function useRunner() {
  const workerRef = useRef(null)
  const warmRef = useRef({}) // lang -> pre-warmed worker (loadPyodide only, no user code)
  const timeoutRef = useRef(0)
  const runIdRef = useRef(0)

  // Pre-warm local engines on mount so the first run skips the CDN download.
  // Warmed workers never ran user code, so per-run isolation is preserved
  // (each run still gets a worker that is discarded afterwards).
  useEffect(() => {
    for (const lang of Object.keys(WORKER_URL)) {
      try {
        const w = new Worker(WORKER_URL[lang])
        w.postMessage({ type: 'warm' })
        w.onerror = () => {
          try { w.terminate() } catch {}
          if (warmRef.current[lang] === w) delete warmRef.current[lang]
        }
        warmRef.current[lang] = w
      } catch { /* workers unavailable — runs fall back to fresh spawns */ }
    }
    return () => {
      clearTimeout(timeoutRef.current)
      for (const w of Object.values(warmRef.current)) { try { w.terminate() } catch {} }
      warmRef.current = {}
      try { workerRef.current?.terminate() } catch {}
      workerRef.current = null
    }
  }, [])

  const runWorker = (language, code, testCases) => new Promise((resolve) => {
    const id = ++runIdRef.current
    try { workerRef.current?.terminate() } catch {}
    let worker = warmRef.current[language] ?? null
    if (worker) {
      delete warmRef.current[language]
    } else {
      try {
        worker = new Worker(WORKER_URL[language])
      } catch {
        resolve({ status: 'error', results: [], totalTimeMs: 0, error: 'Worker unavailable.' })
        return
      }
    }
    workerRef.current = worker
    const kill = (message) => {
      if (runIdRef.current !== id) return
      try { worker.terminate() } catch {}
      if (workerRef.current === worker) workerRef.current = null
      resolve({ status: 'error', results: [], totalTimeMs: message === LOAD_MESSAGE ? LOAD_TIMEOUT_MS : RUN_TIMEOUT_MS, error: message })
    }
    worker.onmessage = (e) => {
      if (e.data?.id !== id) return
      if (e.data?.type === 'started') {
        // Execution actually began — restart the clock as the 5s exec budget.
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => kill('Killed after 5s — infinite loop suspected. Check your exit condition.'), RUN_TIMEOUT_MS)
        return
      }
      if (e.data?.type !== 'result' || e.data.id !== id) return
      clearTimeout(timeoutRef.current)
      resolve(e.data)
    }
    worker.onerror = () => {
      clearTimeout(timeoutRef.current)
      resolve({ status: 'error', results: [], totalTimeMs: 0, error: 'Worker crashed on load (CDN unreachable?).' })
    }
    worker.postMessage({ type: 'run', id, code, testCases: testCases ?? [], functionName: null })
    // Until 'started' arrives we are still loading the engine, not executing.
    timeoutRef.current = setTimeout(() => kill(LOAD_MESSAGE), LOAD_TIMEOUT_MS)
  })

  const run = async (code, testCases, opts = {}) => {
    const language = opts.language ?? 'python'
    const eng = ENGINES[language]
    if (!eng) {
      return { status: 'error', results: [], totalTimeMs: 0, error: `Unknown language "${language}".` }
    }
    if (eng.worker) return runWorker(language, code, testCases)
    // remote: build driver source (parse errors surface as run errors)
    const id = ++runIdRef.current
    let source
    try {
      const testsB64 = b64encode(JSON.stringify(testCases ?? []))
      source = language === 'java' ? buildJavaSource(code, testsB64) : buildCppSource(code, testsB64)
    } catch (e) {
      return { status: 'error', results: [], totalTimeMs: 0, error: String(e?.message ?? e) }
    }
    const out = await runRemote({ language, source })
    if (runIdRef.current !== id) {
      return { status: 'error', results: [], totalTimeMs: 0, error: 'Superseded by a newer run.' }
    }
    return out
  }

  return { run }
}
