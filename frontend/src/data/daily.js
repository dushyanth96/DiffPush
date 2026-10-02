import { getProblems } from './curriculum.js'

const ROTATION = ['Easy', 'Medium', 'Hard']

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Deterministic daily challenge: same problem for everyone, difficulty rotates.
export function getDailyChallenge() {
  const problems = getProblems()
  const day = Math.floor(Date.now() / 86400000)
  const difficultyRaw = ROTATION[day % ROTATION.length]
  const pool = problems.filter((p) => p.difficultyRaw === difficultyRaw)
  const rand = mulberry32(day)
  const pick = pool[Math.floor(rand() * pool.length)]
  const date = new Date().toISOString().slice(0, 10)
  return { ...pick, challengeDate: date, challengeDifficulty: difficultyRaw }
}
