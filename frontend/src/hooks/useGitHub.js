import { useState, useEffect, useCallback, useRef } from 'react'
import { listPending, shiftPending, queuePending } from './useCodeStore.js'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const TOKEN_KEY = 'builtdiff:github_token'

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.detail ?? `API ${res.status}`)
    err.status = res.status
    err.retriable = res.status === 429
    throw err
  }
  return data
}

// Merge remote tracker.json into local state (remote fills gaps only;
// local solves are never dropped). Returns merged state object.
export function mergeRemoteTracker(local, remote) {
  if (!remote || typeof remote !== 'object') return local
  const solvedMap = { ...(remote.solvedMap ?? {}), ...(local.solvedMap ?? {}) }
  const pick = (a, b) => Math.max(a ?? 0, b ?? 0)
  return {
    ...local,
    stats: {
      totalSolved: Object.keys(solvedMap).length,
      diffScore: pick(remote.stats?.diffScore, local.stats?.diffScore),
      currentStreak: pick(remote.stats?.currentStreak, local.stats?.currentStreak),
      lastActiveDate: [remote.stats?.lastActiveDate, local.stats?.lastActiveDate].filter(Boolean).sort().pop() ?? null,
    },
    solvedMap,
    starredIds: [...new Set([...(remote.starredIds ?? []), ...(local.starredIds ?? [])])],
    reviewQueue: [...new Set([...(remote.reviewQueue ?? []), ...(local.reviewQueue ?? [])])],
    boxState: { ...(remote.boxState ?? {}), ...(local.boxState ?? {}) },
    achievements: [...new Set([...(remote.achievements ?? []), ...(local.achievements ?? [])])],
    comboCount: Math.max(remote.comboCount ?? 0, local.comboCount ?? 0),
    lastSolveAt: Math.max(remote.lastSolveAt ?? 0, local.lastSolveAt ?? 0) || null,
    dailySquares: mergeSquares(remote.dailySquares, local.dailySquares),
    freezes: Math.max(remote.freezes ?? 0, local.freezes ?? 0),
    goal: local.goal ?? remote.goal ?? null,
  }
}

function mergeSquares(a = {}, b = {}) {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v ?? 0)
  return out
}

const GH_API = 'https://api.github.com'
const SOLUTIONS_REPO = 'diffpush-solutions'
const LANG_EXTS = { python: 'py', cpp: 'cpp', java: 'java', javascript: 'js' }

function safeSegment(s) {
  return String(s ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'general'
}

// Fetch the solution file this user previously pushed for a problem.
// Mirrors the backend push path (topic/level/index_slug.ext). Tries the
// requested language first, then every other known extension (the push may
// predate a language switch). Returns { code, path } or null.
export async function fetchPushedSolution({ token, login, slug, meta, language }) {
  if (!token || !login || !slug || !meta?.topic) return null
  const level = safeSegment(meta.level || '')
  const index = String(meta.index ?? 0).padStart(3, '0')
  const dir = level !== 'general' ? `${meta.topic}/${level}` : `${meta.topic}`
  const exts = [LANG_EXTS[language] ?? 'py', ...Object.values(LANG_EXTS)]
    .filter((e, i, a) => a.indexOf(e) === i)
  for (const ext of exts) {
    const path = `${dir}/${index}_${slug}.${ext}`
    let res
    try {
      res = await fetch(`${GH_API}/repos/${login}/${SOLUTIONS_REPO}/contents/${path}?ref=main`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      })
    } catch { return null }
    if (res.status === 404) continue
    if (!res.ok) return null
    try {
      const data = await res.json()
      if (!data.content) return null
      const bin = atob(String(data.content).replace(/\s/g, ''))
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      const code = new TextDecoder().decode(bytes)
      if (code.trim()) return { code, path }
      return null
    } catch { return null }
  }
  return null
}

export function useGitHub(tracker) {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [profile, setProfile] = useState(null)
  const [repoUrl, setRepoUrl] = useState(null)
  const [syncState, setSyncState] = useState('idle') // idle|syncing|ok|error|queued
  const [lastCommit, setLastCommit] = useState(null) // {sha, repoUrl, path}
  const [error, setError] = useState(null)
  const trackerRef = useRef(tracker)
  trackerRef.current = tracker

  const setToken = useCallback((t) => {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
    setTokenState(t)
  }, [])

  const disconnect = useCallback(() => {
    setToken(null)
    setProfile(null)
    setRepoUrl(null)
    setLastCommit(null)
  }, [setToken])

  // init-user: profile + repo ensure + remote tracker hydration
  const initUser = useCallback(async (tok) => {
    const t = trackerRef.current
    const data = await api('/api/github/init-user', { access_token: tok })
    setProfile(data.profile)
    setRepoUrl(data.repoUrl)
    if (data.remoteTracker && Object.keys(data.remoteTracker).length) {
      t.update((prev) => {
        const merged = mergeRemoteTracker(prev, data.remoteTracker)
        try { localStorage.setItem('builtdiff:tracker:v1', JSON.stringify(merged)) } catch {}
        return merged
      })
    }
    return data
  }, [])

  // drain offline queue whenever a token is available
  const flushQueue = useCallback(async (tok) => {
    let pending = await listPending()
    while (pending.length) {
      const head = await shiftPending()
      if (!head) break
      try {
        const res = await api('/api/github/commit', { access_token: tok, solutionPayload: head, branch: 'main' })
        setLastCommit({ sha: res.solutionCommitSha, repoUrl: res.repoUrl, path: res.solutionPath })
      } catch {
        await queuePending(head) // re-queue head, stop draining
        break
      }
      pending = await listPending()
    }
  }, [])

  const connect = useCallback(async (tok) => {
    setError(null)
    setToken(tok)
    await initUser(tok)
    await flushQueue(tok)
  }, [setToken, initUser, flushQueue])

  // Retry the handshake with the stored token (e.g. after a transient
  // network failure during the first connect — no new popup needed).
  const retry = useCallback(async () => {
    if (!token) throw new Error('No token stored — authorize again')
    setError(null)
    await initUser(token)
    await flushQueue(token)
  }, [token, initUser, flushQueue])

  useEffect(() => {
    if (token) {
      connect(token).catch((e) => {
        // Dead token (revoked/expired): drop it so the guard routes to login.
        if (e.status === 401) disconnect()
        else setError(e.message)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commitSolution = useCallback(async (solutionPayload) => {
    if (!token) {
      await queuePending(solutionPayload)
      setSyncState('queued')
      return { queued: true }
    }
    setSyncState('syncing')
    setError(null)
    try {
      const res = await api('/api/github/commit', { access_token: token, solutionPayload, branch: 'main' })
      setLastCommit({ sha: res.solutionCommitSha, repoUrl: res.repoUrl, path: res.solutionPath })
      setSyncState('ok')
      return res
    } catch (e) {
      if (e.retriable || e.message.includes('Failed to fetch')) {
        await queuePending(solutionPayload)
        setSyncState('queued')
        return { queued: true }
      }
      setError(e.message)
      setSyncState('error')
      throw e
    }
  }, [token])

  const syncNow = useCallback(async () => {
    if (!token) return
    setSyncState('syncing')
    try {
      await flushQueue(token)
      await initUser(token) // re-hydrate (picks up other-device solves)
      setSyncState('ok')
    } catch (e) {
      setError(e.message)
      setSyncState('error')
    }
  }, [token, flushQueue, initUser])

  return {
    token, profile, repoUrl, syncState, lastCommit, error,
    connected: Boolean(token && profile),
    connect, disconnect, commitSolution, syncNow, initUser, retry,
    loginUrl: async () => {
      const res = await fetch(`${API}/api/auth/github/login`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'OAuth unavailable')
      return data.authorize_url
    },
  }
}
