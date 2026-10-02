import React, { useState } from 'react'
import { MessageSquareText, Send } from 'lucide-react'

// Shared side-discussion panel for rooms (RoomPage + ArenaView).
export function RoomChat({ messages, typingNames, onSend, onTyping }) {
  const [draft, setDraft] = useState('')
  const send = () => {
    if (!draft.trim()) return
    onSend(draft)
    setDraft('')
  }
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="shrink-0 flex items-center gap-1.5 px-3 h-10 border-b border-border">
        <MessageSquareText size={13} className="text-diff-emerald" />
        <span className="text-[12px] font-semibold text-slate-200">Room Discussion</span>
        {typingNames.length > 0 && (
          <span className="ml-auto font-mono text-[10px] text-slate-500 truncate">
            {typingNames.join(', ')} typing…
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
        {messages.length === 0 && (
          <p className="text-[12px] text-slate-600 py-2 text-center">No messages yet — say hi, then go solve something.</p>
        )}
        {messages.map((m, i) => (
          <div key={`${m.ts}:${i}`} className="rounded-md bg-surface hairline px-3 py-2">
            <p className="font-mono text-[10px] text-slate-500">
              @{m.login} · {new Date(m.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {m.kind !== 'chat' && <span className="ml-1.5 px-1 rounded bg-raised text-slate-400">{m.kind}</span>}
            </p>
            {m.text && <p className="text-[13px] text-slate-300 mt-0.5 break-words">{m.text}</p>}
            {m.link && <a href={m.link} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-diff-emerald hover:underline break-all">{m.link}</a>}
          </div>
        ))}
      </div>
      <div className="shrink-0 p-2 border-t border-border flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); onTyping?.() }}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Message the room…"
          maxLength={500}
          className="flex-1 min-w-0 bg-surface hairline rounded-md h-9 px-3 text-[13px] text-slate-200 placeholder:text-slate-500 outline-none"
        />
        <button onClick={send} className="btn-ghost w-9 h-9 rounded-md flex items-center justify-center text-slate-300 shrink-0" aria-label="Send message">
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
