"""Mocked verification of the BYOK chat proxy (keys via headers, never stored)."""
import json
from unittest.mock import patch

import httpx

import app.routers.chat as chat_mod
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

FAKE_KEY = "sk-test-fakekey-12345"


def mock_client(handler):
    def _factory():
        return httpx.AsyncClient(transport=httpx.MockTransport(handler), timeout=5.0)
    return _factory


def ok_openai(request):
    body = json.loads(request.content.decode())
    assert request.headers["Authorization"] == f"Bearer {FAKE_KEY}"
    assert body["model"] == "llama-3.1-8b-instant"
    assert body["messages"][0]["role"] == "system"
    return httpx.Response(200, json={
        "choices": [{"message": {"role": "assistant", "content": "  Try two pointers.  "}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
    })


def ok_gemini(request):
    assert request.headers["x-goog-api-key"] == FAKE_KEY
    assert "generateContent" in str(request.url)
    body = json.loads(request.content.decode())
    assert body["contents"][0]["parts"][0]["text"] == "hello?"
    return httpx.Response(200, json={
        "candidates": [{"content": {"parts": [{"text": "Hi there."}], "role": "model"}}],
        "usageMetadata": {"promptTokenCount": 3, "totalTokenCount": 8},
    })


def post(provider, key=FAKE_KEY, **body):
    headers = {"X-LLM-Provider": provider, "X-LLM-Key": key} if key else {"X-LLM-Provider": provider}
    payload = {"messages": [{"role": "user", "content": "hello?"}], "system": "Be brief."}
    payload.update(body)
    return client.post("/api/chat/complete", json=payload, headers=headers)


def test_providers_shape():
    r = client.get("/api/chat/providers")
    assert r.status_code == 200, r.text
    ids = {p["id"] for p in r.json()["providers"]}
    assert ids == {"gemini", "groq", "openrouter"}, ids
    for p in r.json()["providers"]:
        assert p["keyUrl"].startswith("https://") and p["models"], p
    print("providers shape OK")


def test_missing_and_unknown():
    r = client.post("/api/chat/complete", json={"messages": [{"role": "user", "content": "hi"}]},
                    headers={"X-LLM-Provider": "groq"})
    assert r.status_code == 401 and "MISSING_KEY" in r.text, r.text
    r = post("nope")
    assert r.status_code == 400 and "UNKNOWN_PROVIDER" in r.text, r.text
    print("missing/unknown OK")


def test_groq_success_and_key_never_leaks():
    with patch.object(chat_mod, "_client", mock_client(ok_openai)):
        r = post("groq")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] and data["provider"] == "groq"
        assert data["reply"] == "Try two pointers."
        assert data["usage"]["total_tokens"] == 15
        assert FAKE_KEY not in r.text
    print("groq success + no key leak OK")


def test_gemini_success():
    with patch.object(chat_mod, "_client", mock_client(ok_gemini)):
        r = post("gemini", model="gemini-3.8-flash")
        assert r.status_code == 200, r.text
        assert r.json()["reply"] == "Hi there."
        assert r.json()["model"] == "gemini-3.8-flash"
        assert FAKE_KEY not in r.text
    print("gemini success OK")


def test_retired_model_falls_back_to_default():
    # Models rotate out from under saved settings — never hard-fail.
    seen = {}

    def handler(request):
        body = json.loads(request.content.decode())
        seen["model"] = body.get("model", str(request.url))
        if "generateContent" in str(request.url):
            return httpx.Response(200, json={
                "candidates": [{"content": {"parts": [{"text": "ok"}]}}]})
        return httpx.Response(200, json={
            "choices": [{"message": {"role": "assistant", "content": "ok"}}]})

    with patch.object(chat_mod, "_client", mock_client(handler)):
        r = post("gemini", model="gemini-2.0-flash")
        assert r.status_code == 200, r.text
        assert r.json()["model"] == "gemini-3.8-flash", r.text
        assert "gemini-3.8-flash" in seen["model"], seen
        seen.clear()
        r = post("groq", model="gpt-99")
        assert r.status_code == 200, r.text
        assert r.json()["model"] == "llama-3.1-8b-instant", r.text
        assert seen["model"] == "llama-3.1-8b-instant", seen
    # malformed openrouter ids still 400
    with patch.object(chat_mod, "_client", mock_client(ok_openai)):
        r = post("openrouter", model="!!!")
        assert r.status_code == 400 and "BAD_MODEL" in r.text, r.text
    print("retired-model fallback OK")


def test_upstream_error_mapping():
    cases = [
        (401, "INVALID_KEY", 401), (403, "INVALID_KEY", 401),
        (429, "RATE_LIMITED", 429), (402, "NO_CREDITS", 402),
        (500, "PROVIDER_ERROR", 502), (400, "BAD_MODEL", 400),
    ]
    for status, code, expect in cases:
        def handler(request, _s=status):
            return httpx.Response(_s, json={"error": {"message": "upstream says no"}})
        with patch.object(chat_mod, "_client", mock_client(handler)):
            r = post("groq")
            assert r.status_code == expect, (status, r.status_code, r.text)
            assert code in r.text, (status, r.text)
            assert FAKE_KEY not in r.text
    print("upstream error mapping OK")


def test_unreachable_is_503():
    def handler(request):
        raise httpx.ConnectError("dns down")
    with patch.object(chat_mod, "_client", mock_client(handler)):
        r = post("groq")
        assert r.status_code == 503 and "PROVIDER_UNREACHABLE" in r.text, r.text
        assert FAKE_KEY not in r.text
    print("unreachable 503 OK")


def test_validation_caps():
    # oversize content rejected by pydantic (422), empty messages rejected
    r = post("groq", messages=[{"role": "user", "content": "x" * 2001}])
    assert r.status_code == 422, r.status_code
    r = post("groq", messages=[])
    assert r.status_code == 422, r.status_code
    print("validation caps OK")


def test_throttle():
    chat_mod._RATE.clear()
    with patch.object(chat_mod, "_client", mock_client(ok_openai)):
        codes = [post("groq").status_code for _ in range(32)]
    assert codes[-1] == 429 and "SLOW_DOWN" in client.post(
        "/api/chat/complete",
        json={"messages": [{"role": "user", "content": "hi"}]},
        headers={"X-LLM-Provider": "groq", "X-LLM-Key": FAKE_KEY}).text
    chat_mod._RATE.clear()
    print("throttle OK")


if __name__ == "__main__":
    test_providers_shape()
    test_missing_and_unknown()
    test_groq_success_and_key_never_leaks()
    test_gemini_success()
    test_retired_model_falls_back_to_default()
    test_upstream_error_mapping()
    test_unreachable_is_503()
    test_validation_caps()
    test_throttle()
    print("ALL CHAT CHECKS PASSED (mocked)")
