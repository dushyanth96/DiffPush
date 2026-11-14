import React, { useEffect, useState } from 'react'
import { X, MessageSquareHeart, Send, Loader2, PartyPopper } from 'lucide-react'
import { FEEDBACK_TYPES, submitFeedback } from '../../data/feedback.js'
import { REPO_URL } from '../../data/repo.js'
import { track } from '../../lib/analytics.js'

// In-app feedback intake. One modal, four states: form → sending → done |
// error. On API failure the student still gets a way out: the prefilled
// GitHub-issue link (no backend required, always works).
export function FeedbackModal({ onClose }) {
  const [type, setType] = useState('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('form') // form | sending | done | error
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && status !== 'sending') onClose() }
    window.addEventListener('keydown', onKey)
    track('feedback_open', {})
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSubmit = message.trim().length >= 3 && status !== 'sending'

  const send = async () => {
    if (!canSubmit) return
    setStatus('sending')
    setError('')
    try {
      await submitFeedback({ type, message: message.trim(), email })
      setStatus('done')
      track('feedback_submitted', {})
    } catch (e) {
      setStatus('error')
      setError(e.status === 429 ? 'Too many submissions — try again in an hour.' : 'Could not send right now.')
      track('feedback_failed', {})
    }
  }

  const bugUrl = `${REPO_URL}/issues/new?labels=feedback&title=${encodeURIComponent('[Feedback] ' + type)}&body=${encodeURIComponent(message.trim())}`

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      onClick={() => { if (status !== 'sending') onClose() }}
    >
      <div className="card w-full max-w-md p-6 !bg-popover" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-raised hairline flex items-center justify-center text-diff-emerald shrink-0">
            <MessageSquareHeart size={17} />
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Feedback</p>
            <h2 id="feedback-title" className="text-[15px] font-bold text-slate-100 mt-1">
              {status === 'done' ? 'Thank you!' : 'Help make DiffPush better'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close feedback dialog"
            className="ml-auto text-slate-500 hover:text-slate-200 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {status === 'done' ? (
          <>
            <p className="text-[13px] text-slate-400 mt-3 leading-relaxed">
              Your note landed safely. Every submission gets read — bugs get fixed first, ideas that keep showing up get built.
            </p>
            <button onClick={onClose} autoFocus className="btn-emerald w-full h-10 rounded-md text-[14px] font-semibold mt-5">
              Back to grinding
            </button>
          </>
        ) : status === 'error' ? (
          <>
            <p className="text-[13px] text-diff-rose mt-3">{error}</p>
            <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">
              Your note is still in the box below — copy it over to GitHub and it reaches the same place.
            </p>
            <a href={bugUrl} target="_blank" rel="noreferrer" className="btn-emerald w-full h-10 rounded-md text-[14px] font-semibold mt-4 flex items-center justify-center gap-2">
              Open a GitHub issue <PartyPopper size={14} />
            </a>
            <button onClick={() => setStatus('form')} className="btn-ghost w-full h-10 rounded-md text-[13px] font-medium text-slate-200 mt-2">
              Try sending again
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {FEEDBACK_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  title={t.hint}
                  aria-pressed={type === t.id}
                  className={`px-2.5 h-7 rounded-full font-mono text-[11px] border transition-colors ${
                    type === t.id
                      ? 'text-diff-emerald border-diff-emerald/40 bg-diff-emerald/10'
                      : 'text-slate-500 border-border hover:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              autoFocus
              rows={5}
              placeholder="What happened, or what should exist? The page you're on is attached automatically."
              className="w-full mt-3 bg-surface hairline rounded-md p-3 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-diff-emerald/40 resize-none"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional — only if you want a reply)"
              className="w-full mt-2 bg-surface hairline rounded-md px-3 h-9 text-[13px] text-slate-200 placeholder:text-slate-600 outline-none focus:border-diff-emerald/40"
            />
            <p className="text-[11px] text-slate-600 mt-1.5">
              Sent with the current page and browser info — never your code, GitHub token, or API keys.
            </p>
            <button
              onClick={send}
              disabled={!canSubmit}
              className="btn-emerald w-full h-10 rounded-md text-[14px] font-semibold mt-4 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {status === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
              {status === 'sending' ? 'Sending…' : 'Send feedback'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
