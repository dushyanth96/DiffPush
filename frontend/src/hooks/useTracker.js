import { useState, useEffect, useCallback } from 'react'
import { getProblems } from '../data/curriculum.js'

const KEY = 'builtdiff:tracker:v1'

const emptyState = () => ({
  stats: { totalSolved: 0, diffScore: 0, currentStreak: 0, lastActiveDate: null },
  solvedMap: {},
  starredIds: [],
  reviewQueue: [],
  boxState: {}, // { [id]: { box: 1..5, nextDue: epochMs, lastReviewed: epochMs|null } }
  comboCount: 0, // consecutive solves within COMBO_WINDOW_MS
  lastSolveAt: null, // epochMs of most recent solve
  achievements: [], // unlocked badge ids
  dailySquares: {}, // { 'YYYY-MM-DD': solveCount } — pruned to last 14 days
  freezes: 0, // banked streak freezes (earn 1 per 7-day streak, cap 3)
  goal: null, // onboarding goal id: placements | faang | core
})

// Elo-style tiers computed from diffScore.
export const TIERS = [
  { id: 'script', name: 'Script Kiddie', min: 0, color: '#94A3B8' },
  { id: 'operator', name: 'Systems Operator', min: 2500, color: '#10B981' },
  { id: 'kernel', name: 'Kernel Hacker', min: 7500, color: '#22D3EE' },
  { id: 'staff', name: 'Staff Architect', min: 15000, color: '#A78BFA' },
  { id: 'different', name: 'Built Different', min: 30000, color: '#FBBF24' },
]

export function getTier(score) {
  let tier = TIERS[0]
  let next = null
  for (let i = 0; i < TIERS.length; i++) {
    if (score >= TIERS[i].min) tier = TIERS[i]
    else { next = TIERS[i]; break }
  }
  return { ...tier, next, toNext: next ? next.min - score : 0 }
}

// XP model: 300 base + streak bonus (10/streak-day, cap 100) + combo bonus.
export const XP_BASE = 300
export const COMBO_WINDOW_MS = 3600000 // 60 minutes
export const COMBO_CAP = 1.5

export function comboMultiplier(comboCount) {
  return Math.min(1.0 + comboCount * 0.1, COMBO_CAP)
}

// Leitner intervals in days per box.
export const BOX_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 }
const DAY_MS = 86400000

export const FREEZE_CAP = 3 // max banked streak freezes

export const ACHIEVEMENTS = {
  first_blood: { name: 'First Blood', desc: 'First problem solved' },
  night_owl: { name: 'Night Owl', desc: 'Solved between midnight and 5 AM' },
  combo_3: { name: 'Combo x3', desc: 'Three solves within an hour' },
  streak_7: { name: 'Week Warrior', desc: '7-day streak' },
  streak_30: { name: 'Unstoppable', desc: '30-day streak' },
  space_god: { name: 'Space God', desc: '10 optimal O(1)-space solves' },
  centurion: { name: 'Centurion', desc: '100 problems solved' },
  frozen: { name: 'Ice Cold', desc: 'A streak freeze saved your streak' },
}

export const GOALS = {
  placements: { name: 'Placements', desc: 'Service + product companies, 3-month runway' },
  faang: { name: 'FAANG+', desc: 'Big-tech bars: Hards + optimal Big-O' },
  core: { name: 'Core CS', desc: 'Fundamentals first, interviews second' },
}

// First Blood paths: 5 hand-picked starters per goal (manifest-verified ids).
export const FIRST_BLOOD_PATHS = {
  placements: ['largest-element-in-array', 'second-largest-element-in-array', 'linear-search', 'check-if-array-is-sorted-and-rotated', 'move-0-s-to-end'],
  faang: ['largest-element-in-array', 'linear-search', 'missing-number', 'max-consecutive-1-s', 'check-if-array-is-sorted-and-rotated'],
  core: ['largest-element-in-array', 'second-largest-element-in-array', 'linear-search', 'find-element-present-only-once', 'move-0-s-to-end'],
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    return {
      ...emptyState(), ...parsed,
      stats: { ...emptyState().stats, ...(parsed.stats ?? {}) },
      boxState: parsed.boxState ?? {},
      achievements: parsed.achievements ?? [],
      dailySquares: parsed.dailySquares ?? {},
      comboCount: parsed.comboCount ?? 0,
      lastSolveAt: parsed.lastSolveAt ?? null,
      freezes: parsed.freezes ?? 0,
      goal: parsed.goal ?? null,
    }
  } catch {
    return emptyState()
  }
}

export function useTracker() {
  const [state, setState] = useState(emptyState)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setState(load())
    setReady(true)
  }, [])

  const update = useCallback((fn) => {
    setState((prev) => {
      const next = fn(prev)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* quota/unavailable */ }
      return next
    })
  }, [])

  const isSolved = useCallback((id) => Boolean(state.solvedMap[id]), [state.solvedMap])

  const toggleStar = useCallback((id) => {
    update((prev) => ({
      ...prev,
      starredIds: prev.starredIds.includes(id)
        ? prev.starredIds.filter((s) => s !== id)
        : [...prev.starredIds, id],
    }))
  }, [update])

  const getCompletionStats = useCallback(() => {
    let problems = []
    try { problems = getProblems() } catch { problems = [] }
    const solved = Object.keys(state.solvedMap)
    const solvedSet = new Set(solved)
    const byDiff = (raw) => problems.filter((p) => p.difficultyRaw === raw && solvedSet.has(p.id)).length
    const total = problems.length || 369
    return {
      totalSolved: solved.length,
      percentage: total ? Math.round((solved.length / total) * 1000) / 10 : 0,
      easySolved: byDiff('Easy'),
      medSolved: byDiff('Medium'),
      hardSolved: byDiff('Hard'),
    }
  }, [state.solvedMap])

  const exportBackup = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'builtdiff_backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [state])

  const importBackup = useCallback((jsonString) => {
    const parsed = JSON.parse(jsonString)
    if (!parsed || typeof parsed !== 'object' || !parsed.stats || !parsed.solvedMap) {
      throw new Error('Invalid backup: missing stats/solvedMap')
    }
    update(() => ({ ...emptyState(), ...parsed }))
  }, [update])

  const dayStr = (ts) => new Date(ts).toISOString().slice(0, 10)

  const addDiff = useCallback((n) => {
    update((prev) => ({ ...prev, stats: { ...prev.stats, diffScore: prev.stats.diffScore + n } }))
  }, [update])

  // Leitner rating: 1 = reset to Box 1, 2 = advance one box (+250), 3 = jump two (+500).
  const rateCard = useCallback((id, rating) => {
    update((prev) => {
      const cur = prev.boxState[id]?.box ?? 1
      const box = rating === 1 ? 1 : Math.min(5, cur + (rating === 3 ? 2 : 1))
      const bonus = rating === 1 ? 0 : rating === 2 ? 250 : 500
      const nextDue = Date.now() + (BOX_INTERVALS[box] * DAY_MS)
      return {
        ...prev,
        stats: { ...prev.stats, diffScore: prev.stats.diffScore + bonus },
        boxState: { ...prev.boxState, [id]: { box, nextDue, lastReviewed: Date.now() } },
        reviewQueue: prev.reviewQueue.filter((q) => q !== id),
      }
    })
  }, [update])

  const getDueCards = useCallback(() => {
    const now = Date.now()
    return state.reviewQueue.filter((id) => {
      const b = state.boxState[id]
      return !b || !b.nextDue || b.nextDue <= now
    })
  }, [state.reviewQueue, state.boxState])

  const markSolved = useCallback((id, meta = {}) => {
    const prev = state
    const now = Date.now()
    if (prev.solvedMap[id]) {
      update((p) => ({ ...p, solvedMap: { ...p.solvedMap, [id]: { ...p.solvedMap[id], ...meta } } }))
      return { firstSolve: false }
    }
    const today = dayStr(now)
    const yesterday = dayStr(now - 86400000)
    const last = prev.stats.lastActiveDate
    // Freeze-aware streak: a banked freeze covers exactly one missed day.
    let streak, freezes = prev.freezes ?? 0, freezeUsed = false
    if (last === today) {
      streak = prev.stats.currentStreak
    } else if (last === yesterday) {
      streak = prev.stats.currentStreak + 1
    } else if (last === dayStr(now - 2 * 86400000) && freezes > 0) {
      streak = prev.stats.currentStreak + 1
      freezes -= 1
      freezeUsed = true
    } else {
      streak = 1
    }
    // Bank a freeze on each fresh 7-day milestone (cap enforced).
    if (last !== today && streak % 7 === 0 && freezes < FREEZE_CAP) freezes += 1

    // Combo: solve within 60 minutes of the previous one.
    const inCombo = prev.lastSolveAt && (now - prev.lastSolveAt) <= COMBO_WINDOW_MS
    const comboCount = inCombo ? prev.comboCount + 1 : 0
    const multiplier = comboMultiplier(comboCount)
    const base = XP_BASE
    const streakBonus = Math.min(streak * 10, 100)
    const comboBonus = Math.round(base * (multiplier - 1))
    const gained = base + streakBonus + comboBonus

    const beforeTier = getTier(prev.stats.diffScore).id
    const afterScore = prev.stats.diffScore + gained
    const afterTier = getTier(afterScore)
    const tierUp = afterTier.id !== beforeTier ? afterTier : null

    // Achievements.
    const have = new Set(prev.achievements)
    const fresh = []
    const unlock = (aid) => { if (!have.has(aid)) { have.add(aid); fresh.push(aid) } }
    if (prev.stats.totalSolved === 0) unlock('first_blood')
    const hour = new Date(now).getHours()
    if (hour < 5) unlock('night_owl')
    if (comboCount >= 3) unlock('combo_3')
    if (streak >= 7) unlock('streak_7')
    if (streak >= 30) unlock('streak_30')
    if (prev.stats.totalSolved + 1 >= 100) unlock('centurion')
    if (freezeUsed) unlock('frozen')
    const o1 = Object.values(prev.solvedMap).filter((s) => s.space === 'O(1)').length + (meta.space === 'O(1)' ? 1 : 0)
    if (o1 >= 10) unlock('space_god')

    // Daily squares (prune beyond 14 days).
    const squares = { ...prev.dailySquares, [today]: (prev.dailySquares[today] ?? 0) + 1 }
    const cutoff = dayStr(now - 13 * 86400000)
    for (const k of Object.keys(squares)) if (k < cutoff) delete squares[k]

    const next = {
      ...prev,
      stats: {
        totalSolved: prev.stats.totalSolved + 1,
        diffScore: afterScore,
        currentStreak: streak,
        lastActiveDate: today,
      },
      solvedMap: { ...prev.solvedMap, [id]: { solvedAt: now, ...meta } },
      reviewQueue: prev.reviewQueue.includes(id) ? prev.reviewQueue : [...prev.reviewQueue, id],
      boxState: prev.boxState[id] ? prev.boxState : {
        ...prev.boxState,
        [id]: { box: 1, nextDue: now + DAY_MS, lastReviewed: null },
      },
      comboCount,
      lastSolveAt: now,
      freezes,
      achievements: [...have],
      dailySquares: squares,
    }
    update(() => next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
    return {
      firstSolve: true,
      breakdown: { base, streakBonus, comboBonus, multiplier, comboCount, gained, streak, freezeUsed, freezes },
      tierUp, newAchievements: fresh.map((aid) => ({ id: aid, ...ACHIEVEMENTS[aid] })),
    }
  }, [update, state])

  const unmarkSolved = useCallback((id) => {
    update((prev) => {
      if (!prev.solvedMap[id]) return prev
      const solvedMap = { ...prev.solvedMap }
      delete solvedMap[id]
      return {
        ...prev,
        stats: { ...prev.stats, totalSolved: Object.keys(solvedMap).length },
        solvedMap,
        reviewQueue: prev.reviewQueue.filter((q) => q !== id),
      }
    })
  }, [update])

  const setGoal = useCallback((goalId) => {
    update((prev) => ({ ...prev, goal: GOALS[goalId] ? goalId : null }))
  }, [update])

  // Live combo status for the navbar pill.
  const getCombo = useCallback(() => {
    if (!state.lastSolveAt) return { active: false, multiplier: 1.0, minsLeft: 0, comboCount: 0 }
    const elapsed = Date.now() - state.lastSolveAt
    if (elapsed > COMBO_WINDOW_MS || state.comboCount < 1) {
      return { active: false, multiplier: 1.0, minsLeft: 0, comboCount: 0 }
    }
    return {
      active: true,
      multiplier: comboMultiplier(state.comboCount),
      minsLeft: Math.ceil((COMBO_WINDOW_MS - elapsed) / 60000),
      comboCount: state.comboCount,
    }
  }, [state.lastSolveAt, state.comboCount])

  return { ...state, ready, isSolved, toggleStar, getCompletionStats, exportBackup, importBackup, markSolved, unmarkSolved, addDiff, rateCard, getDueCards, getCombo, getTier, setGoal, update }
}
