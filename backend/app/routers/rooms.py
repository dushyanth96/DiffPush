"""Ephemeral rooms relay (SQLite TTL buffer — no permanent chat storage).

Tables hold ONLY live state: room registry (public metadata), presence
(90s TTL), messages (cap 100/room, die with the room). Prune runs on every
request. Worst case ~15MB. RAM stays flat (disk-backed).
"""
import json
import sqlite3
import threading
import time

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import github_service

router = APIRouter(prefix="/api/rooms", tags=["rooms"])

DB_PATH = "rooms.db"
MAX_ROOMS = 500
MAX_MSGS_PER_ROOM = 100
MAX_MSG_LEN = 500
HEARTBEAT_MIN_S = 10
MSG_MIN_S = 2
PRESENCE_TTL_S = 90

_lock = threading.Lock()
_token_cache: dict[str, tuple[float, dict]] = {}  # token -> (validated_at, profile)


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA auto_vacuum=FULL")
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS rooms(
      code TEXT PRIMARY KEY, name TEXT, topics TEXT, levels TEXT,
      visibility TEXT, owner TEXT, createdAt INTEGER, expiresAt INTEGER);
    CREATE INDEX IF NOT EXISTS idx_rooms_vis ON rooms(visibility, expiresAt);
    CREATE TABLE IF NOT EXISTS presence(
      room TEXT, login TEXT, avatar TEXT, stats TEXT, status TEXT,
      typing INTEGER, last_seen REAL, PRIMARY KEY(room, login));
    CREATE TABLE IF NOT EXISTS messages(
      id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, login TEXT,
      kind TEXT, text TEXT, link TEXT, ts REAL);
    CREATE INDEX IF NOT EXISTS idx_msg_room ON messages(room, ts);
    """)
    return conn


def _prune(conn: sqlite3.Connection) -> None:
    now = time.time()
    conn.execute("DELETE FROM rooms WHERE expiresAt > 0 AND expiresAt <= ?", (int(now * 1000),))
    conn.execute("DELETE FROM presence WHERE last_seen < ?", (now - PRESENCE_TTL_S,))
    conn.execute("""DELETE FROM messages WHERE id NOT IN (
      SELECT id FROM messages AS m2 WHERE m2.room = messages.room
      ORDER BY ts DESC LIMIT ?)""", (MAX_MSGS_PER_ROOM * 4,))
    conn.execute("""DELETE FROM messages WHERE room IN (
      SELECT code FROM rooms WHERE expiresAt > 0 AND expiresAt <= ?)""", (int(now * 1000),))
    conn.commit()


async def _verify_token(token: str) -> dict:
    now = time.time()
    cached = _token_cache.get(token)
    if cached and now - cached[0] < 3600:
        return cached[1]
    try:
        profile = await github_service.get_user_profile(token)
    except github_service.GitHubError:
        raise HTTPException(401, "LOGIN_REQUIRED")
    _token_cache[token] = (now, profile)
    return profile


class CreateRoomRequest(BaseModel):
    token: str
    name: str = "Untitled room"
    topics: list[str] = []
    levels: list[str] = []
    visibility: str = "public"
    hours: float = 6


class HeartbeatRequest(BaseModel):
    token: str
    room: str
    stats: dict = {}
    status: str = "idle"
    typing: bool = False


class MessageRequest(BaseModel):
    token: str
    kind: str = "chat"
    text: str = ""
    link: str = ""


_last_beat: dict[tuple[str, str], float] = {}
_last_msg: dict[tuple[str, str], float] = {}


@router.post("")
async def create_room(req: CreateRoomRequest):
    profile = await _verify_token(req.token)
    import secrets
    import string
    code = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(6))
    now = int(time.time() * 1000)
    hours = max(1, min(72, req.hours or 6))
    with _lock:
        conn = _db()
        try:
            count = conn.execute(
                "SELECT COUNT(*) c FROM rooms WHERE expiresAt = 0 OR expiresAt > ?", (now,)).fetchone()["c"]
            if count >= MAX_ROOMS:
                raise HTTPException(429, "ROOMS_FULL — try again later")
            conn.execute(
                "INSERT INTO rooms(code,name,topics,levels,visibility,owner,createdAt,expiresAt)"
                " VALUES(?,?,?,?,?,?,?,?)",
                (code, req.name.strip()[:40] or "Untitled room", json.dumps(req.topics[:16]),
                 json.dumps(req.levels[:16]), "private" if req.visibility == "private" else "public",
                 profile["login"], now, now + int(hours * 3600 * 1000)))
            _prune(conn)
            conn.commit()
        finally:
            conn.close()
    return {"code": code}


@router.get("/public")
async def list_public(sort: str = "members", page: int = 1):
    now_ms = int(time.time() * 1000)
    now_s = time.time()
    with _lock:
        conn = _db()
        try:
            _prune(conn)
            rows = conn.execute(
                "SELECT code,name,topics,levels,owner,createdAt,expiresAt FROM rooms"
                " WHERE visibility='public' AND (expiresAt = 0 OR expiresAt > ?)", (now_ms,)).fetchall()
            out = []
            for r in rows:
                members = conn.execute(
                    "SELECT COUNT(*) c FROM presence WHERE room = ? AND last_seen > ?",
                    (r["code"], now_s - PRESENCE_TTL_S)).fetchone()["c"]
                out.append({"code": r["code"], "name": r["name"],
                            "topics": json.loads(r["topics"] or "[]"),
                            "levels": json.loads(r["levels"] or "[]"),
                            "owner": r["owner"], "createdAt": r["createdAt"],
                            "expiresAt": r["expiresAt"], "members": members})
        finally:
            conn.close()
    out.sort(key=lambda x: (-x["members"], -x["createdAt"]) if sort != "newest"
             else (-x["createdAt"], -x["members"]))
    start = max(0, (page - 1)) * 50
    return {"rooms": out[start:start + 50], "total": len(out)}


@router.get("/{code}/meta")
async def room_meta(code: str):
    with _lock:
        conn = _db()
        try:
            _prune(conn)
            r = conn.execute("SELECT * FROM rooms WHERE code = ?", (code,)).fetchone()
        finally:
            conn.close()
    if not r:
        raise HTTPException(404, "ROOM_NOT_FOUND")
    return {"code": r["code"], "name": r["name"], "topics": json.loads(r["topics"] or "[]"),
            "levels": json.loads(r["levels"] or "[]"), "visibility": r["visibility"],
            "owner": r["owner"], "createdAt": r["createdAt"], "expiresAt": r["expiresAt"]}


@router.post("/heartbeat")
async def heartbeat(req: HeartbeatRequest):
    profile = await _verify_token(req.token)
    login = profile["login"]
    now = time.time()
    key = (req.room, login)
    with _lock:
        if now - _last_beat.get(key, 0) < HEARTBEAT_MIN_S:
            pass  # too frequent: still return fresh feed below
        else:
            _last_beat[key] = now
            conn = _db()
            try:
                conn.execute(
                    "INSERT INTO presence(room,login,avatar,stats,status,typing,last_seen)"
                    " VALUES(?,?,?,?,?,?,?)"
                    " ON CONFLICT(room,login) DO UPDATE SET avatar=excluded.avatar,"
                    " stats=excluded.stats, status=excluded.status, typing=excluded.typing,"
                    " last_seen=excluded.last_seen",
                    (req.room, login, profile.get("avatar_url"),
                     json.dumps(req.stats or {})[:2000], (req.status or "idle")[:80],
                     1 if req.typing else 0, now))
                _prune(conn)
                conn.commit()
            finally:
                conn.close()
        conn = _db()
        try:
            roster = conn.execute(
                "SELECT login,avatar,stats,status,typing,last_seen FROM presence"
                " WHERE room = ? AND last_seen > ?", (req.room, now - PRESENCE_TTL_S)).fetchall()
            msgs = conn.execute(
                "SELECT login,kind,text,link,ts FROM messages WHERE room = ?"
                " ORDER BY ts DESC LIMIT 100", (req.room,)).fetchall()
        finally:
            conn.close()
    return {
        "login": login,
        "roster": [{"login": r["login"], "avatar": r["avatar"],
                    "stats": json.loads(r["stats"] or "{}"), "status": r["status"],
                    "typing": bool(r["typing"])} for r in roster],
        "messages": [{"login": m["login"], "kind": m["kind"], "text": m["text"],
                      "link": m["link"], "ts": m["ts"]} for m in reversed(msgs)],
        "serverTime": now,
    }


@router.post("/{code}/messages")
async def post_message(code: str, req: MessageRequest):
    profile = await _verify_token(req.token)
    login = profile["login"]
    now = time.time()
    key = (code, login)
    with _lock:
        if now - _last_msg.get(key, 0) < MSG_MIN_S:
            raise HTTPException(429, "SLOW_DOWN")
        _last_msg[key] = now
        text = (req.text or "")[:MAX_MSG_LEN]
        if not text and not req.link:
            raise HTTPException(400, "EMPTY_MESSAGE")
        kind = req.kind if req.kind in ("chat", "code", "system") else "chat"
        conn = _db()
        try:
            conn.execute(
                "INSERT INTO messages(room,login,kind,text,link,ts) VALUES(?,?,?,?,?,?)",
                (code, login, kind, text, (req.link or "")[:500], now))
            conn.execute("""DELETE FROM messages WHERE room = ? AND id NOT IN (
              SELECT id FROM messages WHERE room = ? ORDER BY ts DESC LIMIT ?)""",
                         (code, code, MAX_MSGS_PER_ROOM))
            _prune(conn)
            conn.commit()
        finally:
            conn.close()
    return {"ok": True, "ts": now}


@router.get("/{code}/feed")
async def room_feed(code: str, since: float = 0):
    now = time.time()
    with _lock:
        conn = _db()
        try:
            roster = conn.execute(
                "SELECT login,avatar,stats,status,typing,last_seen FROM presence"
                " WHERE room = ? AND last_seen > ?", (code, now - PRESENCE_TTL_S)).fetchall()
            msgs = conn.execute(
                "SELECT login,kind,text,link,ts FROM messages WHERE room = ? AND ts > ?"
                " ORDER BY ts ASC LIMIT 100", (code, since)).fetchall()
        finally:
            conn.close()
    return {
        "roster": [{"login": r["login"], "avatar": r["avatar"],
                    "stats": json.loads(r["stats"] or "{}"), "status": r["status"],
                    "typing": bool(r["typing"])} for r in roster],
        "messages": [{"login": m["login"], "kind": m["kind"], "text": m["text"],
                      "link": m["link"], "ts": m["ts"]} for m in msgs],
        "serverTime": now,
    }
