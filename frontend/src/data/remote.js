// Wandbox remote compilers (keyless). Used for languages without a local engine.
// Contract mirrors the workers: resolves { status, results, totalTimeMs, error }.
// Anything unexpected degrades to a clear, actionable error — never a hang.

const ENDPOINT = 'https://wandbox.org/api/compile.json'
const MARK = '__BD_BEGIN__'

export const REMOTE_COMPILERS = {
  java: 'openjdk-jdk-22+36',
  cpp: 'gcc-head',
}

const FETCH_TIMEOUT_MS = 60000

export async function runRemote({ language, source }) {
  const t0 = performance.now()
  const compiler = REMOTE_COMPILERS[language]
  if (!compiler) {
    return { status: 'error', results: [], totalTimeMs: 0, error: `No remote compiler configured for "${language}".` }
  }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS)
  let res
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: source, compiler, save: false }),
      signal: ctl.signal,
    })
  } catch (e) {
    clearTimeout(timer)
    const offline = e?.name === 'AbortError' ? 'timed out after 60s' : 'unreachable (offline?)'
    return {
      status: 'error', results: [], totalTimeMs: Math.round(performance.now() - t0),
      error: `Remote ${language} compiler ${offline}. Your code is safe — Python and JavaScript run fully offline.`,
    }
  } finally {
    clearTimeout(timer)
  }
  let body
  try {
    body = await res.json()
  } catch {
    return { status: 'error', results: [], totalTimeMs: Math.round(performance.now() - t0), error: 'Remote compiler returned an unreadable response. Try again.' }
  }
  const totalTimeMs = Math.round(performance.now() - t0)
  const out = String(body.program_output || '')
  // MARK first: compilers often emit notes/warnings to compiler_error
  // (e.g. javac "unchecked or unsafe operations") on successful builds.
  const idx = out.indexOf(MARK)
  if (idx >= 0) {
    try {
      const payload = JSON.parse(out.slice(idx + MARK.length))
      const results = Array.isArray(payload.results) ? payload.results : []
      const passed = results.filter((r) => r.passed).length
      return {
        status: passed === results.length && results.length > 0 ? 'passed' : 'failed',
        results, totalTimeMs, error: null,
      }
    } catch {
      return { status: 'error', results: [], totalTimeMs, error: 'Remote result payload was corrupt. Try again.' }
    }
  }
  const cerr = (body.compiler_error || '').trim()
  if (cerr) {
    return { status: 'error', results: [], totalTimeMs, error: compact(cerr, 1200) }
  }
  const perr = (body.program_error || body.program_message || '').trim()
}

function compact(s, max) {
  const t = String(s).replace(/\r/g, '')
  return t.length > max ? t.slice(0, max) + '\n…(truncated)' : t
}
