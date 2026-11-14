const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const FEEDBACK_TYPES = [
  { id: 'bug', label: 'Bug', hint: 'Something broken or wrong' },
  { id: 'feature', label: 'Feature idea', hint: 'What would help you grind faster?' },
  { id: 'difficulty', label: 'Difficulty issue', hint: 'Problem too hard/easy, bad test cases' },
  { id: 'other', label: 'Other', hint: 'Anything else' },
]

// Fire-and-report: the modal owns UX feedback, this only talks to the API.
// Route + UA are captured here so every submission is reproducible without
// asking the student to paste diagnostics.
export async function submitFeedback({ type, message, email }) {
  const res = await fetch(`${API}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      message,
      email: email?.trim() || null,
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    }),
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data?.detail) detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    } catch {}
    const err = new Error(detail)
    err.status = res.status
    throw err
  }
  return res.json()
}
