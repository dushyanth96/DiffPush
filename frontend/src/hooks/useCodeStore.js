import { get, set, del } from 'idb-keyval'

const keyFor = (problemId) => `builtdiff:draft:v2:${problemId}`

// Zero-latency local draft engine (IndexedDB). No network.
export async function saveDraft(problemId, code) {
  await set(keyFor(problemId), { code, updatedAt: Date.now() })
}

export async function loadDraft(problemId) {
  return get(keyFor(problemId))
}

export async function clearDraft(problemId) {
  await del(keyFor(problemId))
}

const PENDING_KEY = 'builtdiff:pending-sync'

// Offline commit queue: payloads awaiting POST /api/github/commit.
export async function queuePending(payload) {
  const q = (await get(PENDING_KEY)) ?? []
  q.push({ ...payload, queuedAt: Date.now() })
  await set(PENDING_KEY, q)
  return q.length
}

export async function listPending() {
  return (await get(PENDING_KEY)) ?? []
}

export async function shiftPending() {
  const q = (await get(PENDING_KEY)) ?? []
  const head = q.shift()
  await set(PENDING_KEY, q)
  return head ?? null
}

export function useCodeStore() {
  return { saveDraft, loadDraft, clearDraft, queuePending, listPending, shiftPending }
}
