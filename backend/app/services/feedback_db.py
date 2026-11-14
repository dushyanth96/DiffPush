"""Feedback store (SQLite, one file: feedback.db).

Append-only intake for the in-app feedback modal. No threads, no WAL churn
beyond a single small table — worst case grows by a few KB per submission.
Read path is admin-only (token-gated in the router), so this stays simple.
"""
import sqlite3
import threading
import time

DB_PATH = "feedback.db"

_lock = threading.Lock()


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS feedback(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      email TEXT,
      route TEXT,
      user_agent TEXT,
      status TEXT DEFAULT 'new',
      created_at INTEGER);
    CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
    """)
    return conn


def init() -> None:
    with _lock:
        conn = _db()
        conn.commit()
        conn.close()


def insert(payload: dict) -> int:
    with _lock:
        conn = _db()
        cur = conn.execute(
            "INSERT INTO feedback(type, message, email, route, user_agent, created_at)"
            " VALUES(?,?,?,?,?,?)",
            (
                payload["type"],
                payload["message"],
                payload.get("email"),
                payload.get("route"),
                payload.get("userAgent"),
                int(time.time()),
            ),
        )
        conn.commit()
        row_id = cur.lastrowid
        conn.close()
        return row_id


def list_feedback(limit: int = 200) -> list[dict]:
    with _lock:
        conn = _db()
        rows = conn.execute(
            "SELECT * FROM feedback ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        conn.close()
    return [dict(r) for r in rows]
