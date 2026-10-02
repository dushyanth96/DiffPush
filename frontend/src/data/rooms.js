// Zero-database rooms: definitions + invites live in localStorage + links.
// LIVE state (presence, chat) flows through the ephemeral relay (RAM/SQLite
// TTL buffer, auto-deleted) and degrades silently when unreachable.
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const ROOMS_KEY = 'builtdiff:rooms:v1'
const LEGACY_PEERS_KEY = 'builtdiff:room'

export const ROOM_TTL_MS = 6 * 3600 * 1000 // 6h default expiry
export const LOBBY_CODE = 'lobby'

export function makeCode() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const buf = new Uint32Array(6)
  crypto.getRandomValues(buf)
  for (const n of buf) out += chars[n % chars.length]
  return out
}

function legacyPeers() {
  try { return JSON.parse(localStorage.getItem(LEGACY_PEERS_KEY) ?? '[]') } catch { return [] }
}

export function loadRooms() {
  let rooms = []
  try { rooms = JSON.parse(localStorage.getItem(ROOMS_KEY) ?? '[]') } catch { rooms = [] }
  const now = Date.now()
  const live = rooms.filter((r) => r.code === LOBBY_CODE || !r.expiresAt || r.expiresAt > now)
  if (live.length !== rooms.length) saveRooms(live)
  return live
}

export function saveRooms(rooms) {
  try { localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms)) } catch {}
}

export function lobbyRoom() {
  return {
    code: LOBBY_CODE,
    name: 'Global Lobby',
    visibility: 'public',
    peers: [...new Set([...loadRooms().find((r) => r.code === LOBBY_CODE)?.peers ?? [], ...legacyPeers()])],
    createdAt: 0,
    expiresAt: 0, // lobby never expires
  }
}

export function createRoom({ name, visibility = 'public', hours = 6 }) {
  const now = Date.now()
  return {
    code: makeCode(),
    name: name.trim().slice(0, 40) || 'Untitled room',
    visibility: visibility === 'private' ? 'private' : 'public',
    peers: [],
    createdAt: now,
    expiresAt: now + Math.max(1, Math.min(72, Number(hours) || 6)) * 3600 * 1000,
  }
}

export function inviteLink(room) {
  const base = `${window.location.origin}${window.location.pathname}#/room/${room.code}`
  const q = new URLSearchParams({
    n: room.name,
    p: (room.peers ?? []).join(','),
    exp: String(room.expiresAt ?? 0),
  })
  return `${base}?${q.toString()}`
}

export function isExpired(room) {
  return room.code !== LOBBY_CODE && room.expiresAt && room.expiresAt <= Date.now()
}

function decodeB64(b64) {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export async function fetchPeer(login) {
  const r = await fetch(`https://api.github.com/repos/${login}/builtdiff-solutions/contents/.builtdiff/tracker.json`)
  if (!r.ok) throw new Error(r.status === 404 ? 'no BuiltDiff repo' : `GitHub ${r.status}`)
  const j = await r.json()
  const t = JSON.parse(decodeB64(j.content))
  const today = new Date().toISOString().slice(0, 10)
  return {
    solves: Object.keys(t.solvedMap ?? {}).length,
    streak: t.stats?.currentStreak ?? 0,
    today: t.dailySquares?.[today] ?? 0,
  }
}

export function formatLeft(ms) {
  if (ms <= 0) return 'expired'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`
}

// ---- live relay client (fail-silent: null/false on any failure) ----

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 401) {
    const err = new Error('LOGIN_REQUIRED')
    err.status = 401
    throw err
  }
  if (!res.ok) throw new Error(`relay ${res.status}`)
  return res.json()
}

export async function createRemoteRoom({ token, name, topics, levels, visibility, hours }) {
  const data = await api('/api/rooms', { token, name, topics, levels, visibility, hours })
  return data.code
}

export async function listPublicRooms(sort = 'members') {
  try {
    const res = await fetch(`${API}/api/rooms/public?sort=${sort}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function fetchRoomMeta(code) {
  try {
    const res = await fetch(`${API}/api/rooms/${code}/meta`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Heartbeat loop: calls onUpdate({roster, messages}) with the relay feed.
// getPayload() supplies {stats, status, typing}. Returns a stop function.
export function startHeartbeat({ token, room, getPayload, onUpdate, onAuthFail }) {
  let stopped = false
  let timer = 0
  const beat = async () => {
    if (stopped) return
    try {
      const p = getPayload()
      const feed = await api('/api/rooms/heartbeat', {
        token, room, stats: p.stats ?? {}, status: p.status ?? 'idle', typing: !!p.typing,
      })
      onUpdate(feed)
    } catch (e) {
      if (e.status === 401 && onAuthFail) onAuthFail()
    } finally {
      if (!stopped) timer = setTimeout(beat, 20000)
    }
  }
  beat()
  return () => { stopped = true; clearTimeout(timer) }
}

export async function pollFeed(code, since) {
  try {
    const res = await fetch(`${API}/api/rooms/${code}/feed?since=${since}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function sendMessage({ token, code, kind, text, link }) {
  return api(`/api/rooms/${code}/messages`, { token, kind, text, link })
}

// Workspace presence: Workspace.jsx writes {slug, at} on every run;
// the heartbeat reader below picks it up while fresh.
const STATUS_KEY = 'builtdiff:status'
const ACTIVE_ROOM_KEY = 'builtdiff:active-room'

export function readSolvingStatus() {
  try {
    const s = JSON.parse(localStorage.getItem(STATUS_KEY) ?? 'null')
    if (s && Date.now() - s.at < 5 * 60 * 1000) return `solving:${s.slug}`
  } catch {}
  return 'idle'
}

export function setActiveRoom(code) {
  try {
    if (code) localStorage.setItem(ACTIVE_ROOM_KEY, code)
    else localStorage.removeItem(ACTIVE_ROOM_KEY)
  } catch {}
}

export function getActiveRoom() {
  try { return localStorage.getItem(ACTIVE_ROOM_KEY) } catch { return null }
}
