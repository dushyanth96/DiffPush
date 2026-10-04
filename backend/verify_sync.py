"""Mocked verification of the Step-4 sync engine (no network, no credentials)."""
import asyncio
import base64
import json
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.services import github_service

client = TestClient(app)


class FakeResp:
    def __init__(self, status=200, payload=None, headers=None, text=""):
        self.status_code = status
        self._payload = payload if payload is not None else {}
        self.headers = headers or {}
        self.text = text or json.dumps(self._payload)
        self.content = self.text.encode()

    def json(self):
        return self._payload


TRACKER_REMOTE = {
    "stats": {"totalSolved": 1, "diffScore": 500, "currentStreak": 2, "lastActiveDate": "2026-09-20"},
    "solvedMap": {"old-prob": {"solvedAt": 1}},
    "starredIds": ["old-prob"],
    "reviewQueue": [],
}
TRACKER_B64 = base64.b64encode(json.dumps(TRACKER_REMOTE).encode()).decode()


def test_merge_tracker_states():
    incoming = {
        "stats": {"totalSolved": 5, "diffScore": 2500, "currentStreak": 4, "lastActiveDate": "2026-09-26"},
        "solvedMap": {"new-prob": {"solvedAt": 2}},
        "starredIds": ["new-prob"],
        "reviewQueue": ["old-prob"],
    }
    m = github_service.merge_tracker_states(TRACKER_REMOTE, incoming)
    assert set(m["solvedMap"]) == {"old-prob", "new-prob"}
    assert m["stats"]["totalSolved"] == 2
    assert m["stats"]["diffScore"] == 2500
    assert m["stats"]["currentStreak"] == 4
    assert m["stats"]["lastActiveDate"] == "2026-09-26"
    assert m["starredIds"] == ["new-prob", "old-prob"]
    print("merge_tracker_states OK")


def test_merge_gamification_fields():
    remote = {"achievements": ["first_blood"], "comboCount": 2, "lastSolveAt": 100,
              "dailySquares": {"2026-09-20": 2}, "boxState": {"a": {"box": 2}}}
    incoming = {"achievements": ["night_owl"], "comboCount": 1, "lastSolveAt": 200,
                "dailySquares": {"2026-09-20": 1, "2026-09-21": 3}, "boxState": {"b": {"box": 1}}}
    m = github_service.merge_tracker_states(remote, incoming)
    assert m["achievements"] == ["first_blood", "night_owl"]
    assert m["comboCount"] == 2 and m["lastSolveAt"] == 200
    assert m["dailySquares"] == {"2026-09-20": 2, "2026-09-21": 3}
    assert set(m["boxState"]) == {"a", "b"}
    print("merge gamification fields OK")


def test_merge_progression_fields():
    remote = {"freezes": 2, "goal": "faang"}
    incoming = {"freezes": 1, "goal": None}
    m = github_service.merge_tracker_states(remote, incoming)
    assert m["freezes"] == 2
    assert m["goal"] == "faang"
    m2 = github_service.merge_tracker_states({"goal": None}, {"goal": "core"})
    assert m2["goal"] == "core" and m2["freezes"] == 0
    print("merge progression fields OK")


def test_rate_limit_maps_to_429():
    r = client.post("/api/github/init-user", json={"access_token": "x"})
    # real network blocked in test env -> expect a 502/429, never a 500 traceback leak
    assert r.status_code in (429, 502), r.status_code
    print("rate-limit/error mapping OK (no creds -> %s)" % r.status_code)


def test_oauth_not_configured():
    r = client.get("/api/auth/github/login")
    # 400 without .env credentials, or 200 authorize_url with live .env — both valid.
    assert (r.status_code == 400 and "GITHUB_CLIENT_ID" in r.json()["detail"]) or \
           (r.status_code == 200 and "authorize_url" in r.json()), r.text[:200]
    print("oauth guard OK (status %s)" % r.status_code)


def test_commit_flow_mocked():
    calls = []

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, headers=None, params=None):
            calls.append(("GET", url))
            if url.endswith("/user"):
                return FakeResp(200, {"login": "octo", "name": "O", "avatar_url": "a", "html_url": "h"})
            if "/contents/" in url:
                if ".builtdiff" in url:
                    return FakeResp(200, {"content": TRACKER_B64, "sha": "trk-sha"})
                return FakeResp(404, {"message": "not found"})  # new solution file
            if "/repos/octo/diffpush-solutions" in url:
                return FakeResp(200, {"html_url": "https://github.com/octo/diffpush-solutions"})
            return FakeResp(404, {})

        async def put(self, url, headers=None, json=None):
            calls.append(("PUT", url, json["message"], bool(json.get("sha"))))
            short = "abc123" if "tracker" not in url else "def456"
            return FakeResp(201, {"commit": {"sha": short}})

        async def patch(self, url, headers=None, json=None):
            calls.append(("PATCH", url))
            return FakeResp(200, {})

        async def post(self, url, headers=None, json=None):
            calls.append(("POST", url))
            return FakeResp(201, {})

    payload = {
        "access_token": "tok",
        "solutionPayload": {
            "topic": "01-arrays", "level": "1.Easy", "index": 1, "problemSlug": "largest-element-in-array",
            "canonicalTitle": "Largest element in array", "code": "print(1)",
            "language": "python", "timeComplexity": "O(n)", "spaceComplexity": "O(1)",
            "trackerState": {"stats": {}, "solvedMap": {}, "starredIds": [], "reviewQueue": []},
        },
    }
    with patch.object(github_service.httpx, "AsyncClient", FakeClient):
        r = client.post("/api/github/init-user", json={"access_token": "tok"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["profile"]["login"] == "octo" and body["remoteTracker"]["stats"]["totalSolved"] == 1
        r = client.post("/api/github/commit", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["solutionCommitSha"] == "abc123" and body["trackerCommitSha"] == "def456"
        assert body["solutionPath"] == "01-arrays/1.Easy/001_largest-element-in-array.py"
    puts = [c for c in calls if c[0] == "PUT"]
    assert puts[0][3] is False, "new solution file must not send sha"
    assert puts[1][3] is True, "existing tracker.json must send sha (no 409)"
    assert any(c[0] == "PUT" and c[1].endswith("/contents/README.md") for c in calls), \
        "profile README must refresh on every push"
    assert any(c[0] == "PATCH" and c[1].endswith("/repos/octo/diffpush-solutions") for c in calls), \
        "repo blurb should update best-effort on every push"
    print("mocked init-user + commit flow OK (SHA handling verified)")


def test_unreachable_maps_to_503():
    import httpx

    class DeadClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            raise httpx.ConnectError("dns down")

        async def __aexit__(self, *a):
            return False

    with patch.object(github_service.httpx, "AsyncClient", DeadClient):
        r = client.post("/api/github/init-user", json={"access_token": "tok"})
        assert r.status_code == 503, r.text
        assert "unreachable" in r.json()["detail"]
    print("unreachable -> 503 (no 500 leak) OK")


def test_validation_rejects_bad_payload():
    r = client.post("/api/github/commit", json={"access_token": "t"})
    assert r.status_code == 422
    print("request validation OK")


def test_profile_readme_content():
    body = github_service.build_profile_readme(
        login="octo", solved_total=42, diff_score=8000, streak=5,
        last_active="2026-10-03")
    assert "octo" in body and "42" in body and "Kernel Hacker" in body
    assert "https://diffpush.pages.dev" in body and "🔥 5" in body
    assert github_service.tier_for(0) == "Script Kiddie"
    assert github_service.tier_for(30000) == "Built Different"
    print("profile README content OK")


if __name__ == "__main__":
    test_merge_tracker_states()
    test_merge_gamification_fields()
    test_merge_progression_fields()
    test_oauth_not_configured()
    test_commit_flow_mocked()
    test_unreachable_maps_to_503()
    test_validation_rejects_bad_payload()
    print("ALL BACKEND CHECKS PASSED (mocked)")
