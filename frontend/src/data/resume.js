// "Continue where I left off" helpers. The tracker hook owns live state, but
// the landing page also needs to read a previously-saved session before the
// dashboard mounts, so the same localStorage contract is mirrored here.
import { getProblemMeta } from './curriculum.js'
import { FIRST_BLOOD_PATHS } from '../hooks/useTracker.js'

export const TRACKER_KEY = 'builtdiff:tracker:v1'
const STATUS_KEY = 'builtdiff:status'

export function readLocalTracker() {
  try {
    const raw = localStorage.getItem(TRACKER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function readLocalSolvedCount() {
  const state = readLocalTracker()
  if (!state) return 0
  if (state.solvedMap && typeof state.solvedMap === 'object') return Object.keys(state.solvedMap).length
  return Number(state.stats?.totalSolved ?? 0) || 0
}

// Last problem the user actually ran (written by Workspace/ArenaView).
export function lastOpenedSlug() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATUS_KEY) ?? 'null')
    return typeof raw?.slug === 'string' ? raw.slug : null
  } catch {
    return null
  }
}

function metaExists(id) {
  try {
    return Boolean(getProblemMeta(id))
  } catch {
    return false
  }
}

// Priority: the problem you last opened (if unsolved) → next unsolved in the
// goal path → the very first starter. Never returns a solved problem unless
// the whole path is done.
export function resumeTarget(tracker) {
  const solved = (id) => Boolean(tracker?.isSolved?.(id) || tracker?.solvedMap?.[id])
  const last = lastOpenedSlug()
  if (last && metaExists(last) && !solved(last)) return last

  const path = FIRST_BLOOD_PATHS[tracker?.goal] ?? FIRST_BLOOD_PATHS.placements
  return path.find((id) => !solved(id)) ?? path[0]
}
