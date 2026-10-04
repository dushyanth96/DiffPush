import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Plus, Trash2, Users, Copy, Check, Globe, Lock, Timer,
} from 'lucide-react'
import {
  LOBBY_CODE, loadRooms, saveRooms,
  createRemoteRoom, listPublicRooms, fetchRoomMeta, pollFeed,
  readSolvingStatus,
  isExpired, formatLeft,
} from '../../data/rooms.js'
import { getTopics, getByTopic } from '../../data/curriculum.js'
import { navigate } from '../../data/route.js'
import { useRoomLive } from '../../hooks/useRoomLive.js'
import { RoomChat } from './RoomChat.jsx'

function useNow(stepMs = 30000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), stepMs)
    return () => clearInterval(t)
  }, [stepMs])
  return now
}

function topicLevelNames(topicId) {
  try {
    const names = new Map()
    for (const p of getByTopic(topicId)) names.set(p.level ?? p.levelName, p.levelName ?? p.level)
    return [...names.values()]
  } catch {
    return []
  }
}

function roomProblemIds(room) {
  const ids = []
  try {
    for (const t of room.topics ?? []) {
      for (const p of getByTopic(t)) {
        if ((room.levels ?? []).length && !room.levels.includes(p.levelName) && !room.levels.includes(p.level)) continue
        ids.push(p.id)
      }
    }
  } catch {}
  return ids
}

// /room → lobby + create + browser · /room/:code → live room.
export function RoomPage({ code, query, tracker, github, onBack }) {
  if (!github?.connected) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="border-b border-border bg-canvas px-4 py-2.5 flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-100">
            <ArrowLeft size={15} /> Back to Hub
          </button>
          <span className="font-mono text-[12px] text-slate-600">diffpush // rooms</span>
        </div>
        <div className="max-w-[520px] mx-auto px-4 py-10">
          <div className="card p-8 text-center">
            <Users size={24} className="text-diff-emerald mx-auto" />
            <h1 className="text-[16px] font-bold text-slate-100 mt-3">Rooms need your GitHub identity</h1>
            <p className="text-[13px] text-slate-500 mt-1">Live presence is tied to a verified login — no anonymous lurking, no spoofed stats.</p>
            <button onClick={() => window.dispatchEvent(new CustomEvent('builtdiff:connect'))} className="btn-emerald mt-4 px-5 h-10 rounded-md text-[14px] font-semibold">
              Connect GitHub to enter
            </button>
          </div>
        </div>
      </div>
    )
  }
  return <RoomsInner code={code} query={query} tracker={tracker} github={github} onBack={onBack} />
}

function RoomsInner({ code, query, tracker, github, onBack }) {
  const [rooms, setRooms] = useState(loadRooms)
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [hours, setHours] = useState(6)
  const [selTopics, setSelTopics] = useState([])
  const [selLevels, setSelLevels] = useState([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [pubSort, setPubSort] = useState('members')
  const [pubList, setPubList] = useState(null)
  const [lobbyCount, setLobbyCount] = useState(null)

  const topics = useMemo(() => {
    try { return getTopics() } catch { return [] }
  }, [])
  const levelUnion = useMemo(() => {
    const out = []
    for (const t of selTopics) for (const l of topicLevelNames(t)) if (!out.includes(l)) out.push(l)
    return out
  }, [selTopics, topics])

  useEffect(() => {
    let cancelled = false
    listPublicRooms(pubSort).then((d) => { if (!cancelled) setPubList(d) })
    pollFeed(LOBBY_CODE, 0).then((f) => { if (!cancelled && f) setLobbyCount(f.roster.length) })
    return () => { cancelled = true }
  }, [pubSort, code])

  const create = async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const roomCode = await createRemoteRoom({
        token: github.token, name, topics: selTopics, levels: selLevels, visibility, hours,
      })
      const room = {
        code: roomCode, name: name.trim() || 'Untitled room', visibility,
        topics: selTopics, levels: selLevels,
        createdAt: Date.now(), expiresAt: Date.now() + hours * 3600 * 1000,
      }
      const next = [...rooms, room]
      setRooms(next)
      saveRooms(next)
      setName('')
      navigate(`/room/${roomCode}`)
    } catch (e) {
      setCreateError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const drop = (target) => {
    const next = rooms.filter((r) => r.code !== target)
    setRooms(next)
    saveRooms(next)
  }

  if (code) {
    return <ActiveRoom code={code} query={query} tracker={tracker} github={github} onBack={onBack} myRooms={rooms} />
  }

  return (
    <div className="pt-16 min-h-screen">
      <div className="border-b border-border bg-canvas px-4 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-100">
          <ArrowLeft size={15} /> Back to Hub
        </button>
        <span className="font-mono text-[12px] text-slate-600">builtdiff // rooms</span>
      </div>
      <div className="max-w-[720px] mx-auto px-4 py-6 space-y-4">
        <button
            onClick={() => navigate('/room/lobby')}
          className="card card-hover w-full p-4 flex items-center gap-3 text-left transition-colors border-diff-emerald/30"
        >
          <span className="w-9 h-9 rounded-md bg-raised hairline flex items-center justify-center shrink-0">
            <Users size={16} className="text-diff-emerald" />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-slate-100">Global Lobby {lobbyCount != null && <span className="font-mono text-[11px] text-diff-emerald">· {lobbyCount} inside</span>}</span>
            <span className="block text-[12px] text-slate-500">Always open. Anyone can join — pick up rivals here.</span>
          </span>
        </button>

        <div className="card p-4">
          <h2 className="text-[14px] font-bold tracking-tight text-slate-100">Create a room</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">Pick topics to grind together. Expires {hours}h after creation.</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Room name (e.g. graphs weekend)"
            className="mt-3 w-full bg-surface hairline rounded-md h-9 px-3 text-[13px] text-slate-200 placeholder:text-slate-500 outline-none"
          />
          <p className="mt-3 mb-1.5 font-mono text-[10px] text-slate-500">TOPICS ({selTopics.length} selected)</p>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => {
              const on = selTopics.includes(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => setSelTopics(on ? selTopics.filter((x) => x !== t.id) : [...selTopics, t.id])}
                  className={`px-2.5 h-7 rounded-full text-[12px] font-medium transition-colors ${on ? 'bg-diff-emerald/15 text-diff-emerald border border-diff-emerald/30' : 'text-slate-500 hover:text-slate-300 hairline'}`}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
          {levelUnion.length > 0 && (
            <>
              <p className="mt-3 mb-1.5 font-mono text-[10px] text-slate-500">LEVELS (empty = all)</p>
              <div className="flex flex-wrap gap-1.5">
                {levelUnion.map((l) => {
                  const on = selLevels.includes(l)
                  return (
                    <button
                      key={l}
                      onClick={() => setSelLevels(on ? selLevels.filter((x) => x !== l) : [...selLevels, l])}
                      className={`px-2.5 h-7 rounded-full text-[12px] font-medium transition-colors ${on ? 'bg-diff-violet/15 text-diff-violet border border-diff-violet/30' : 'text-slate-500 hover:text-slate-300 hairline'}`}
                    >
                      {l}
                    </button>
                  )
                })}
              </div>
            </>
          )}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {['public', 'private'].map((v) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className={`px-3 h-8 rounded-md text-[12px] font-medium transition-colors ${visibility === v ? 'bg-raised text-slate-100 hairline' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {v === 'public' ? 'Public — listed' : 'Private — link only'}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
              expires in
              <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="bg-surface hairline rounded h-8 px-1.5 text-slate-300">
                {[2, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </label>
          </div>
          {createError && <p className="mt-2 text-[12px] text-diff-rose">{createError}</p>}
          <button onClick={create} disabled={creating} className="btn-emerald mt-3 w-full h-9 rounded-md text-[13px] font-semibold disabled:opacity-50">
            {creating ? 'Creating…' : 'Create room'}
          </button>
        </div>

        {rooms.filter((r) => r.code !== LOBBY_CODE).length > 0 && (
          <div className="card p-4">
            <h2 className="text-[14px] font-bold tracking-tight text-slate-100">My rooms</h2>
            <div className="mt-2.5 space-y-1.5">
              {rooms.filter((r) => r.code !== LOBBY_CODE).map((r) => (
                <div key={r.code} className="flex items-center gap-3 bg-surface hairline rounded-md px-3 h-11">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-200 truncate">{r.name}</p>
                    <p className="font-mono text-[10px] text-slate-500">#{r.code} · {r.visibility}</p>
                  </div>
                  <button onClick={() => navigate(`/room/${r.code}`)} className="btn-ghost ml-auto px-3 h-8 rounded-md text-[12px] text-slate-200 shrink-0">
                    Join
                  </button>
                  <button onClick={() => drop(r.code)} className="text-slate-600 hover:text-diff-rose shrink-0" aria-label={`Delete ${r.name}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-bold tracking-tight text-slate-100">Public rooms</h2>
            <div className="ml-auto flex gap-1">
              {[['members', 'Most members'], ['newest', 'Newest']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPubSort(id)}
                  className={`px-2.5 h-7 rounded-md font-mono text-[11px] transition-colors ${pubSort === id ? 'bg-raised text-slate-100 hairline' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {!pubList && <p className="text-[12px] text-slate-600 py-2 text-center">Loading live rooms…</p>}
            {pubList && pubList.rooms.length === 0 && (
              <p className="text-[12px] text-slate-600 py-2 text-center">No public rooms right now — create the first one above.</p>
            )}
            {(pubList?.rooms ?? []).map((r) => (
              <div key={r.code} className="flex items-center gap-3 bg-surface hairline rounded-md px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-slate-200 truncate">{r.name}</p>
                  <p className="font-mono text-[10px] text-slate-500 truncate">
                    {r.members} inside · {formatLeft((r.expiresAt ?? 0) - Date.now())}
                  </p>
                </div>
                <button onClick={() => navigate(`/room/${r.code}`)} className="btn-emerald px-4 h-8 rounded-md text-[12px] font-semibold shrink-0">
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActiveRoom({ code, query, tracker, github, onBack }) {
  const [meta, setMeta] = useState(null)
  const [metaMissing, setMetaMissing] = useState(false)
  const [emptyNoticed, setEmptyNoticed] = useState(false)
  const [emptyChoice, setEmptyChoice] = useState(null) // 'solo' once dismissed
  const [expiredView, setExpiredView] = useState(null)
  const [copied, setCopied] = useState(false)
  const lastRosterRef = useRef([])
  const now = useNow()
  void query

  const roomDef = useMemo(() => {
    if (code === LOBBY_CODE) {
      return { code, name: 'Global Lobby', topics: [], levels: [], visibility: 'public', expiresAt: 0 }
    }
    return null // resolved from relay meta below
  }, [code])

  // Resolve room definition: local record → relay meta → gone.
  useEffect(() => {
    if (code === LOBBY_CODE) return
    let cancelled = false
    const local = loadRooms().find((r) => r.code === code)
    if (local && !isExpiredLocal(local)) { setMeta(local); return }
    fetchRoomMeta(code).then((m) => {
      if (cancelled) return
      if (m) setMeta({ ...m, peers: [] })
      else setMetaMissing(true)
    })
    return () => { cancelled = true }
  }, [code])

  const room = code === LOBBY_CODE ? roomDef : meta
  const expired = room ? room.code !== LOBBY_CODE && (room.expiresAt ?? 0) <= Date.now() : false

  // Shared live state: heartbeat presence + chat poll (fail-silent).
  const { roster, messages, typingNames, send, markTyping } = useRoomLive({
    code,
    token: github.token,
    login: github.profile.login,
    getPayload: () => {
      let topicSolves = 0
      try {
        const ids = new Set(roomProblemIds(room))
        topicSolves = Object.keys(tracker.solvedMap).filter((id) => ids.has(id)).length
      } catch {}
      return {
        stats: {
          total: Object.keys(tracker.solvedMap).length,
          streak: tracker.stats.currentStreak,
          topicSolves,
        },
        status: readSolvingStatus(),
      }
    },
    enabled: !!room && !expired,
  })

  useEffect(() => {
    lastRosterRef.current = roster
  }, [roster])

  // Empty-room popup: others never showed up 10s after our first heartbeat.
  useEffect(() => {
    if (!room || expired || emptyChoice || sessionStorage.getItem(`builtdiff:empty:${code}`)) return
    if (!roster.length) return
    const others = roster.filter((m) => m.login !== github.profile.login)
    if (roster.length > 0 && others.length === 0) {
      const t = setTimeout(() => {
        setEmptyNoticed(true)
        try { sessionStorage.setItem(`builtdiff:empty:${code}`, '1') } catch {}
      }, 10000)
      return () => clearTimeout(t)
    }
  }, [room, expired, roster])

  // Expiry standings: freeze the last known roster into a final board.
  useEffect(() => {
    if (room && expired && !expiredView) {
      setExpiredView(lastRosterRef.current)
    }
  }, [expired])

  const copyInvite = async () => {
    try {
      const base = `${window.location.origin}/room/${room.code}`
      const q = new URLSearchParams({ n: room.name, exp: String(room.expiresAt ?? 0) })
      await navigator.clipboard.writeText(`${base}?${q.toString()}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {}
  }

  if (metaMissing) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="max-w-[520px] mx-auto px-4 py-10">
          <div className="card p-8 text-center">
            <p className="text-[15px] font-semibold text-slate-200">Room not found</p>
            <p className="text-[13px] text-slate-500 mt-1">It expired or the code is wrong.</p>
            <button onClick={onBack} className="btn-ghost mt-4 px-4 h-9 rounded-md text-[13px] text-slate-200">Back to Hub</button>
          </div>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="max-w-[520px] mx-auto px-4 py-10">
          <div className="card p-10 text-center font-mono text-[13px] text-slate-500">Resolving room…</div>
        </div>
      </div>
    )
  }

  const ids = new Set(roomProblemIds(room))
  const board = [...roster].sort((a, b) => {
    const sa = topicCount(a, ids)
    const sb = topicCount(b, ids)
    return sb - sa || (b.stats?.streak ?? 0) - (a.stats?.streak ?? 0)
  })
  const typists = roster.filter((m) => m.typing && m.login !== github.profile.login)

  return (
    <div className="pt-16 min-h-screen">
      <div className="border-b border-border bg-canvas px-4 py-2.5 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-slate-100">
          <ArrowLeft size={15} /> Back to Hub
        </button>
        <span className="font-mono text-[12px] text-slate-600">builtdiff // rooms</span>
      </div>
      <div className="max-w-[720px] mx-auto px-4 py-6 space-y-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[16px] font-bold tracking-tight text-slate-100">{room.name}</h1>
              <span className="ml-auto font-mono text-[11px] text-slate-500 flex items-center gap-1">
                <Timer size={11} />
                {room.code === LOBBY_CODE ? 'always open' : formatLeft((room.expiresAt ?? 0) - now)}
              </span>
            </div>
            {(room.topics ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(room.topics ?? []).map((t) => (
                  <span key={t} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-raised hairline text-slate-300">{topicName(t)}</span>
                ))}
                {(room.levels ?? []).map((l) => (
                  <span key={l} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-diff-violet/10 border border-diff-violet/30 text-diff-violet">{l}</span>
                ))}
              </div>
            )}
            <div className="mt-2.5 flex gap-1.5">
              <button onClick={() => navigate(`/room/${room.code}/arena`)} className="btn-emerald flex items-center gap-1.5 px-3.5 h-8 rounded-md text-[12px] font-semibold">
                Enter arena
              </button>
              <button onClick={copyInvite} className="btn-ghost flex items-center gap-1.5 px-3 h-8 rounded-md text-[12px] text-slate-200">
                {copied ? <Check size={13} className="text-diff-emerald" /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy invite'}
              </button>
              <button onClick={() => navigate('/room')} className="font-mono text-[11px] text-slate-500 hover:text-slate-300 px-2">
                ← all rooms
              </button>
            </div>
          </div>

          <div className="p-3">
            <p className="px-1 pb-2 font-mono text-[10px] text-slate-500">
              LIVE · {board.length} inside{typists.length > 0 && ` · ${typists.map((t) => t.login).join(', ')} typing…`}
            </p>
            {expired && expiredView ? (
              <div className="rounded-md bg-surface hairline p-3">
                <p className="text-[12px] font-semibold text-slate-200">Final standings</p>
                {expiredView.map((m, i) => (
                  <p key={m.login} className="mt-1 font-mono text-[12px] text-slate-400">
                    #{i + 1} @{m.login} — {topicCount(m, ids)} topic solves
                  </p>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {board.map((m, i) => (
                  <div key={m.login} className="flex items-center gap-2.5 bg-surface hairline rounded-md px-3 py-2">
                    <span className="font-mono text-[11px] text-slate-600 w-6">#{i + 1}</span>
                    {m.avatar
                      ? <img src={m.avatar} alt={m.login} width={28} height={28} className="w-7 h-7 rounded-full object-cover hairline shrink-0" />
                      : <span className="w-7 h-7 rounded-full bg-raised hairline flex items-center justify-center font-mono text-[11px] text-slate-400 shrink-0">{m.login[0]?.toUpperCase()}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[12px] text-slate-200 truncate">@{m.login}{m.login === github.profile.login ? ' (you)' : ''}</p>
                      <p className="font-mono text-[10px] text-slate-500 truncate">
                        {topicCount(m, ids)} topic · {m.stats?.total ?? 0} total · {m.stats?.streak ?? 0}d
                        {m.status && m.status !== 'idle' ? ` · ${m.status.replace('solving:', 'on ')}` : ''}
                        {m.typing ? ' · typing…' : ''}
                      </p>
                    </div>
                  </div>
                ))}
                {board.length === 0 && (
                  <p className="text-[12px] text-slate-600 py-2 text-center sm:col-span-2">Connecting to live relay…</p>
                )}
              </div>
            )}
          </div>

          {!expired && (
            <div className="border-t border-border h-[380px] flex flex-col">
              <RoomChat messages={messages} typingNames={typingNames} onSend={(t) => send(t)} onTyping={markTyping} />
            </div>
          )}
        </div>

        {emptyNoticed && !emptyChoice && !expired && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-label="Empty room">
            <div className="card w-full max-w-sm p-6 !bg-popover text-center">
              <Users size={22} className="text-slate-500 mx-auto" />
              <h2 className="text-[15px] font-bold text-slate-100 mt-2">Nobody else is here yet</h2>
              <p className="text-[13px] text-slate-500 mt-1">Don't burn session time waiting. Solve solo and others will find you — or jump to a live room.</p>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { setEmptyChoice('solo'); try { sessionStorage.setItem(`builtdiff:empty:${code}:choice`, 'solo') } catch {} }}
                  className="btn-emerald flex-1 h-9 rounded-md text-[13px] font-semibold"
                >
                  Practice solo here
                </button>
                <button
                  onClick={() => navigate('/room')}
                  className="btn-ghost flex-1 h-9 rounded-md text-[13px] text-slate-200"
                >
                  Browse rooms
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function isExpiredLocal(room) {
  return room.code !== LOBBY_CODE && room.expiresAt && room.expiresAt <= Date.now()
}

function topicCount(member, ids) {
  return member?.stats?.topicSolves ?? 0
}

function topicName(topicId) {
  try {
    const t = getTopics().find((x) => x.id === topicId)
    return t?.name ?? topicId
  } catch {
    return topicId
  }
}
