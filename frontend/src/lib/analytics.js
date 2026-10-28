const EVENTS = {
  cta_click: ['cta'],
  guest_start: ['source'],
  problem_open: ['slug'],
  run_tests: ['status'],
  solve_pass: ['slug'],
  github_connect: ['method'],
  commit_success: [],
  commit_queued: [],
  commit_failed: [],
}

function cleanValue(value) {
  if (typeof value === 'string') return value.slice(0, 120)
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return undefined
}

export function track(event, props = {}) {
  if (typeof window === 'undefined') return
  const allowed = EVENTS[event]
  if (!allowed) return
  const data = {}
  for (const key of allowed) {
    const value = cleanValue(props[key])
    if (value !== undefined) data[key] = value
  }
  try {
    if (typeof window.diffpushTrack === 'function') {
      window.diffpushTrack(event, data)
      return
    }
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track(event, data)
    }
  } catch (error) {}
}
