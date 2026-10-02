import { loadDraft, saveDraft } from '../hooks/useCodeStore.js'

// Single source of truth for IDE language support.
// status 'live' = executable today (local worker or remote compiler).
// Anything else opens the request/vote modal.
export const LANGUAGES = [
  { id: 'python', label: 'Python 3.11', tag: 'WASM', status: 'live', mode: 'python', file: 'solution.py' },
  { id: 'javascript', label: 'JavaScript', tag: 'local', status: 'live', mode: 'javascript', file: 'solution.js' },
  { id: 'java', label: 'Java 17', tag: 'remote', status: 'live', mode: 'java', file: 'Solution.java' },
  { id: 'cpp', label: 'C++20', tag: 'remote', status: 'live', mode: 'cpp', file: 'solution.cpp' },
  { id: 'typescript', label: 'TypeScript', tag: '5.x', status: 'soon' },
  { id: 'go', label: 'Go', tag: '1.23', status: 'soon' },
  { id: 'rust', label: 'Rust', tag: '1.82', status: 'soon' },
  { id: 'csharp', label: 'C#', tag: 'mono', status: 'soon' },
  { id: 'kotlin', label: 'Kotlin', tag: '2.0', status: 'soon' },
  { id: 'ruby', label: 'Ruby', tag: '3.3', status: 'soon' },
  { id: 'php', label: 'PHP', tag: '8.3', status: 'soon' },
  { id: 'sql', label: 'SQL', tag: 'sqlite', status: 'soon' },
]

export const langById = (id) => LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0]

// Python keeps the legacy bare-slug key so existing drafts survive;
// every other language namespaces its drafts per problem.
export const draftKeyFor = (slug, langId) => (langId === 'python' ? slug : `${slug}::${langId}`)

const safeId = (k, i) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `arg${i}`)
const OPS = new Set(['operations', 'ops'])

// JS has no curated starters: derive a working stub from the first test's keys.
// The JS harness binds by name, so any method name works.
export function jsStub(problem) {
  const first = (problem?.testCases ?? []).find((t) => t.input && typeof t.input === 'object')?.input ?? {}
  const keys = Object.keys(first)
  const opsKey = keys.find((k) => OPS.has(k.toLowerCase()))
  const params = keys.filter((k) => k !== opsKey).map((k, i) => safeId(k, i))
  const sig = params.join(', ')
  if (opsKey) {
    return [
      'class Solution {',
      '    // Design problem: add one method per operation name,',
      '    // e.g. push(x) { ... }, pop() { ... }',
      `    // constructor args (if any): ${sig || 'none'}`,
      '}',
      '',
    ].join('\n')
  }
  return [
    'class Solution {',
    `    solve(${sig}) {`,
    `        // TODO: implement — inputs: ${sig || 'none'}`,
    '    }',
    '}',
    '',
  ].join('\n')
}

export function starterFor(problem, langId) {
  const curated = problem?.starterCode?.[langId]
  if (curated) return curated
  if (langId === 'javascript') return jsStub(problem)
  return ''
}

export async function loadCode(slug, langId, problem) {
  const d = await loadDraft(draftKeyFor(slug, langId)).catch(() => null)
  return d?.code ?? starterFor(problem, langId)
}

export function saveCode(slug, langId, code) {
  saveDraft(draftKeyFor(slug, langId), code).catch(() => {})
}
