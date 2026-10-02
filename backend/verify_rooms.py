"""Mocked verification of the rooms relay (SQLite TTL buffer, zero stored chats)."""
import os
import time
from unittest.mock import patch

import app.routers.rooms as rooms_mod
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# Isolate test DB.
rooms_mod.DB_PATH = "rooms_test.db"
if os.path.exists("rooms_test.db"):
    os.remove("rooms_test.db")


async def fake_profile(token):
    if token == "bad":
        from fastapi import HTTPException
        raise HTTPException(401, "LOGIN_REQUIRED")
    return {"login": f"user_{token}", "avatar_url": f"https://a/{token}"}


def test_create_and_cap():
    with patch.object(rooms_mod, "_verify_token", side_effect=fake_profile):
        r = client.post("/api/rooms", json={"token": "t1", "name": "R", "topics": ["01-arrays"],
                                            "levels": [], "visibility": "public", "hours": 6})
        assert r.status_code == 200, r.text
        code = r.json()["code"]
        assert len(code) == 6
        # invalid token rejected
        r = client.post("/api/rooms", json={"token": "bad", "name": "X"})
        assert r.status_code == 401
    print("create + auth OK")


def test_heartbeat_roster_and_expiry():
    import asyncio

    async def beats():
        with patch.object(rooms_mod, "_verify_token", side_effect=fake_profile):
            r = client.post("/api/rooms/heartbeat", json={"token": "t1", "room": "lobby",
                                                          "stats": {"total": 3}, "status": "idle"})
            assert r.status_code == 200
            assert any(m["login"] == "user_t1" for m in r.json()["roster"])
            r = client.post("/api/rooms/heartbeat", json={"token": "t2", "room": "lobby",
                                                          "stats": {"total": 1}, "status": "solving:x"})
            assert len(r.json()["roster"]) == 2
            # expire t2 by backdating
            conn = rooms_mod._db()
            conn.execute("UPDATE presence SET last_seen = ? WHERE login = 'user_t2'",
                         (time.time() - 9999,))
            conn.commit()
            conn.close()
            r = client.post("/api/rooms/heartbeat", json={"token": "t1", "room": "lobby"})
            assert [m["login"] for m in r.json()["roster"]] == ["user_t1"]
    asyncio.run(beats())
    print("heartbeat roster + TTL expiry OK")


def test_messages_flow_and_throttle():
    import asyncio

    async def flow():
        with patch.object(rooms_mod, "_verify_token", side_effect=fake_profile):
            rooms_mod._last_msg.clear()
            r = client.post("/api/rooms/lobby/messages",
                            json={"token": "t1", "kind": "chat", "text": "hello"})
            assert r.status_code == 200
            r = client.post("/api/rooms/lobby/messages",
                            json={"token": "t1", "kind": "chat", "text": "spam"})
            assert r.status_code == 429  # throttle
            r = client.get("/api/rooms/lobby/feed?since=0")
            texts = [m["text"] for m in r.json()["messages"]]
            assert "hello" in texts and "spam" not in texts
            r = client.get("/api/rooms/lobby/feed?since=9999999999")
            assert r.json()["messages"] == []
    asyncio.run(flow())
    print("message flow + throttle + since-filter OK")


def test_public_registry_and_prune():
    import asyncio

    async def reg():
        with patch.object(rooms_mod, "_verify_token", side_effect=fake_profile):
            client.post("/api/rooms", json={"token": "t1", "name": "Pub",
                                            "visibility": "public", "hours": 6})
            client.post("/api/rooms", json={"token": "t1", "name": "Priv",
                                            "visibility": "private", "hours": 6})
            r = client.get("/api/rooms/public?sort=newest")
            names = [x["name"] for x in r.json()["rooms"]]
            assert "Pub" in names and "Priv" not in names
            # expire everything manually, prune on next hit
            conn = rooms_mod._db()
            conn.execute("UPDATE rooms SET expiresAt = 1 WHERE code != 'x'")
            conn.commit()
            conn.close()
            r = client.get("/api/rooms/public")
            assert r.json()["total"] == 0
    asyncio.run(reg())
    print("public registry + prune OK")


if __name__ == "__main__":
    test_create_and_cap()
    test_heartbeat_roster_and_expiry()
    test_messages_flow_and_throttle()
    test_public_registry_and_prune()
    if os.path.exists("rooms_test.db"):
        os.remove("rooms_test.db")
    for f in ("rooms_test.db-wal", "rooms_test.db-shm"):
        if os.path.exists(f):
            os.remove(f)
    print("ALL ROOMS CHECKS PASSED (mocked)")
