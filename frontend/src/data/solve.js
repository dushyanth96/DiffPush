import { saveCode } from '../data/languages.js'
import { getActiveRoom } from '../data/rooms.js'
import { track } from '../lib/analytics.js'

// Build the commit extras from a run payload: the deep link to this exact
// question on our site, plus the test cases that passed (input → expected).
// Everything returned here must stay JSON-serializable (offline queue).
export function commitExtras(slug, payload) {
  let questionUrl = ''
  try { questionUrl = `${window.location.origin}/p/${slug}/` } catch {}
  const passedTests = (payload?.results ?? [])
    .filter((r) => r && r.passed)
    .slice(0, 8)
    .map((r) => ({ input: r.input ?? null, expected: r.expected ?? null }))
  return { questionUrl, passedTests }
}

const LANG_EXT = { python: 'py', cpp: 'cpp', java: 'java', javascript: 'js' }
export const SOLUTIONS_REPO = 'diffpush-solutions'

function safeSegment(s) {
  return String(s ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'general'
}

// Mirrors backend/app/services/github_service.py (push_solution_commit) so the
// confirmation screen can show the file path before anything is pushed.
export function solutionPathFor({ meta, slug, language = 'python' }) {
  const topic = safeSegment(meta?.topic)
  const level = safeSegment(meta?.level || '')
  const index = String(meta?.index ?? 0).padStart(3, '0')
  const ext = LANG_EXT[language] ?? 'py'
  const dir = level && level !== 'general' ? `${topic}/${level}` : topic
  return `${dir}/${index}_${slug}.${ext}`
}

// Read the current file (if any) so the confirm sheet can show a real diff.
// Returns { path, content } or null when the file does not exist yet.
export async function fetchRepoFile({ token, login, path }) {
  if (!token || !login || !path) return null
  try {
    const res = await fetch(`https://api.github.com/repos/${login}/${SOLUTIONS_REPO}/contents/${path}?ref=main`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.content) return null
    const bin = atob(String(data.content).replace(/\s/g, ''))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return { path, content: new TextDecoder().decode(bytes) }
  } catch {
    return null
  }
}

// Step 1 of a solve: local recognition only. No network, no GitHub, no commit.
export function markSolve({ tracker, slug, problem, code, language = 'python', totalMs }) {
  const solvedMeta = {
    runtimeMs: Math.round(totalMs ?? 0),
    time: problem.complexity?.optimalTime,
    space: problem.complexity?.optimalSpace,
  }
  const result = tracker.markSolved(slug, solvedMeta)
  saveCode(slug, language, code)
  if (result?.firstSolve) track('solve_pass', { slug })
  return result
}

// Step 2: push the already-submitted solution. Only ever called after the
// user has seen repo + path + diff in CommitConfirm.
export async function commitSolve({
  tracker, github, slug, meta, problem, code, totalMs, language = 'python',
  questionUrl = '', passedTests = [],
}) {
  let commitInfo = null
  let commitEvent = null
  const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  try {
    const res = await github.commitSolution({
      topic: meta.topic,
      level: meta.level ?? '',
      index: meta.index ?? 0,
      problemSlug: slug,
      canonicalTitle: meta.canonicalTitle ?? slug,
      code,
      language,
      timeComplexity: problem.complexity?.optimalTime ?? meta.optimalTime ?? '?',
      spaceComplexity: problem.complexity?.optimalSpace ?? meta.optimalSpace ?? '?',
      questionUrl,
      passedTests,
      trackerState: {
        stats: tracker.stats,
        solvedMap: { ...tracker.solvedMap, [slug]: { solvedAt: Date.now(), runtimeMs: Math.round(totalMs ?? 0) } },
        starredIds: tracker.starredIds,
        reviewQueue: tracker.reviewQueue,
      },
    })
    if (res?.queued) {
      commitInfo = { queued: true }
      commitEvent = 'commit_queued'
    } else {
      commitInfo = { sha: res.solutionCommitSha, repoUrl: res.repoUrl, path: res.solutionPath }
      commitEvent = 'commit_success'
    }
    // Room solve-feed announce (best effort).
    try {
      const activeRoom = getActiveRoom()
      if (activeRoom && !res?.queued && res?.solutionCommitSha) {
        await fetch(`${API}/api/rooms/${activeRoom}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: github.token,
            kind: 'code',
            text: `Solved "${meta.canonicalTitle ?? slug}" in ${meta.optimalTime ?? '?'} · ${meta.optimalSpace ?? '?'}`,
            link: `${res.repoUrl}/blob/main/${res.solutionPath}`,
          }),
        })
      }
    } catch {}
  } catch {
    commitInfo = null
    commitEvent = 'commit_failed'
  }
  if (github.connected && commitEvent) track(commitEvent)
  return { commitInfo }
}

// Kept for the arena, where a full pass is the result of the round. Workspace
// and product UI use markSolve + commitSolve separately.
export async function submitSolve({ tracker, github, slug, meta, problem, code, totalMs, language = 'python', questionUrl = '', passedTests = [] }) {
  const result = markSolve({ tracker, slug, problem, code, language, totalMs })
  const { commitInfo } = await commitSolve({
    tracker, github, slug, meta, problem, code, totalMs, language, questionUrl, passedTests,
  })
  return { result, commitInfo }
}
