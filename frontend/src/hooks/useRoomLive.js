import { useEffect, useRef, useState } from 'react'
import { startHeartbeat, pollFeed, sendMessage, setActiveRoom } from '../data/rooms.js'

// Shared live-room state: heartbeat presence (20s) + chat poll (4s),
// fail-silent when the relay is unreachable.
// Returns { roster, messages, typingNames, send, markTyping, connected }.
export function useRoomLive({ code, token, login, getPayload, enabled = true }) {
  const [roster, setRoster] = useState([])
  const [messages, setMessages] = useState([])
  const [typingNames, setTypingNames] = useState([])
  const [connected, setConnected] = useState(false)
  const typingRef = useRef(false)
  const typingTimer = useRef(0)
  const lastTsRef = useRef(0)
  const seenRef = useRef(new Set())
  const syncedRef = useRef(false)
  const payloadRef = useRef(getPayload)
  payloadRef.current = getPayload

  const mergeMessages = (incoming) => {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => `${m.ts}:${m.login}:${m.text}`))
      const fresh = (incoming ?? []).filter((m) => !seen.has(`${m.ts}:${m.login}:${m.text}`))
      if (!fresh.length) return prev
      const next = [...prev, ...fresh].sort((a, b) => a.ts - b.ts).slice(-100)
      lastTsRef.current = Math.max(lastTsRef.current, ...next.map((m) => m.ts))
      return next
    })
  }

  useEffect(() => {
    if (!enabled || !code || !token) return
    setActiveRoom(code)
    seenRef.current = new Set()
    syncedRef.current = false
    lastTsRef.current = 0
    setMessages([])
    setRoster([])
    setConnected(false)
    const apply = (feed) => {
      if (!feed) return
      setConnected(true)
      const current = feed.roster ?? []
      setRoster(current)
      setTypingNames(current.filter((m) => m.typing && m.login !== login).map((m) => m.login))
      // Join announcements from roster diff — skipped on first sync
      // (existing members aren't "joining").
      const fresh = syncedRef.current
        ? current.filter((m) => m.login !== login && !seenRef.current.has(m.login))
        : []
      current.forEach((m) => seenRef.current.add(m.login))
      syncedRef.current = true
      if (feed.messages) mergeMessages(feed.messages)
      if (fresh.length) {
        setMessages((prev) => [...prev, ...fresh.map((m) => ({
          login: 'room', kind: 'system', text: `@${m.login} joined`, link: '',
          ts: Date.now() / 1000 + Math.random() / 1000,
        }))].sort((a, b) => a.ts - b.ts).slice(-100))
      }
    }
    const stopBeat = startHeartbeat({
      token,
      room: code,
      getPayload: () => {
        const p = payloadRef.current()
        return { stats: p.stats ?? {}, status: p.status ?? 'idle', typing: typingRef.current }
      },
      onUpdate: apply,
    })
    const poll = setInterval(async () => {
      const f = await pollFeed(code, lastTsRef.current)
      if (f) {
        setRoster(f.roster ?? [])
        setTypingNames((f.roster ?? []).filter((m) => m.typing && m.login !== login).map((m) => m.login))
        if (f.messages?.length) mergeMessages(f.messages)
      }
    }, 4000)
    return () => {
      stopBeat()
      clearInterval(poll)
      setActiveRoom(null)
    }
  }, [code, token, enabled])

  const send = async (text, kind = 'chat', link = '') => {
    const t = (text ?? '').trim().slice(0, 500)
    if (!t && !link) return false
    typingRef.current = false
    try {
      await sendMessage({ token, code, kind, text: t, link })
      const f = await pollFeed(code, lastTsRef.current)
      if (f?.messages?.length) mergeMessages(f.messages)
      return true
    } catch {
      return false
    }
  }

  const markTyping = () => {
    typingRef.current = true
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => { typingRef.current = false }, 3000)
  }

  return { roster, messages, typingNames, connected, send, markTyping }
}
