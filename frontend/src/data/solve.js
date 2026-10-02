import { saveCode } from '../data/languages.js'
import { getActiveRoom } from '../data/rooms.js'

// Shared solve-submit pipeline: record solve → snapshot draft → auto-commit
// (+ room solve-feed announce). Used by Workspace and ArenaView alike.
// Returns { result, commitInfo } where commitInfo is {sha,repoUrl,path} |
// {queued:true} | null.
export async function submitSolve({ tracker, github, slug, meta, problem, code, totalMs, language = 'python' }) {
  const solvedMeta = {
    runtimeMs: Math.round(totalMs),
    time: problem.complexity?.optimalTime,
    space: problem.complexity?.optimalSpace,
  }
  const result = tracker.markSolved(slug, solvedMeta)
  saveCode(slug, language, code)

  let commitInfo = null
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
      trackerState: {
        stats: tracker.stats,
        solvedMap: { ...tracker.solvedMap, [slug]: { solvedAt: Date.now(), runtimeMs: Math.round(totalMs) } },
        starredIds: tracker.starredIds,
        reviewQueue: tracker.reviewQueue,
      },
    })
    commitInfo = res?.queued
      ? { queued: true }
      : { sha: res.solutionCommitSha, repoUrl: res.repoUrl, path: res.solutionPath }
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
  }
  return { result, commitInfo }
}
