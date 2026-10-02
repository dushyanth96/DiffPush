"""BYOK chat proxy for the AI coach.

Design contract (privacy-first):
- The provider API key arrives per-request in the X-LLM-Key header and is
  used ONLY to forward the single upstream call. It is never stored,
  never logged, and never echoed back in any response or error body.
- Keys live exclusively in the user's own browser (localStorage).
- Upstream failures are mapped to actionable codes so the UI can tell the
  user to check the key, retry, or switch provider.
"""
import time
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/chat", tags=["chat"])

PROVIDERS = {
    "gemini": {
        "label": "Google Gemini",
        "models": ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash-lite"],
        "default": "gemini-3.8-flash",
        "keyUrl": "https://aistudio.google.com/apikey",
        "note": "Free tier — if 3.8 is busy, drop to a lite model",
    },
    "groq": {
        "label": "Groq",
        "models": ["llama-3.1-8b-instant", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "openai/gpt-oss-120b"],
        "default": "llama-3.1-8b-instant",
        "keyUrl": "https://console.groq.com/keys",
        "note": "Free tier, very fast inference",
    },
    "openrouter": {
        "label": "OpenRouter",
        "models": ["meta-llama/llama-3.3-70b-instruct:free", "deepseek/deepseek-chat-v3-0324:free"],
        "default": "meta-llama/llama-3.3-70b-instruct:free",
        "keyUrl": "https://openrouter.ai/keys",
        "note": "Free :free-suffixed models",
        "anyModel": True,
    },
}

MAX_MESSAGES = 12
MAX_CONTENT_CHARS = 2000
MAX_SYSTEM_CHARS = 1000
MAX_TOKENS_CAP = 1024
UPSTREAM_TIMEOUT_S = 45.0

# Light per-IP throttle: 30 completions/minute (abuse guard, in-memory).
_RATE: dict[str, list[float]] = {}
RATE_LIMIT = 30
RATE_WINDOW_S = 60.0


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=MAX_CONTENT_CHARS)


class CompleteRequest(BaseModel):
    provider: str = ""
    model: str = ""
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    system: str = Field(default="", max_length=MAX_SYSTEM_CHARS)
    max_tokens: int = Field(default=512, ge=1, le=MAX_TOKENS_CAP)


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT_S)


def _throttled(ip: str) -> bool:
    now = time.monotonic()
    hits = _RATE.get(ip, [])
    hits = [t for t in hits if now - t < RATE_WINDOW_S]
    if len(hits) >= RATE_LIMIT:
        _RATE[ip] = hits
        return True
    hits.append(now)
    _RATE[ip] = hits
    return False


def _provider_or_400(provider: str) -> dict[str, Any]:
    cfg = PROVIDERS.get((provider or "").lower())
    if not cfg:
        raise HTTPException(400, f"UNKNOWN_PROVIDER — choose one of: {', '.join(PROVIDERS)}")
    return cfg


def _resolve_model(cfg: dict[str, Any], model: str) -> str:
    """Resolve to a usable model id. Unknown/retired names fall back to the
    provider default (models rotate out from under saved settings) instead
    of hard-failing; the effective model is always returned to the caller."""
    name = (model or "").strip()
    if cfg.get("anyModel"):
        if not name or len(name) > 120 or not all(c.isalnum() or c in "-_./:" for c in name):
            raise HTTPException(400, "BAD_MODEL — invalid OpenRouter model id")
        return name
    if name in cfg["models"]:
        return name
    return cfg["default"]


def _openai_messages(system: str, messages: list[ChatMessage]) -> list[dict[str, str]]:
    out = []
    if system.strip():
        out.append({"role": "system", "content": system.strip()})
    out.extend({"role": m.role, "content": m.content} for m in messages)
    return out


def _map_upstream(provider: str, status: int, text: str) -> HTTPException:
    """Map upstream failures to actionable codes. Never includes the key."""
    snippet = (text or "")[:300]
    if status in (401, 403):
        return HTTPException(401, f"INVALID_KEY — {provider} rejected the API key. Check it in settings or switch provider. [{snippet}]")
    if status == 402:
        return HTTPException(402, f"NO_CREDITS — {provider} reports no credits/quota left. Switch provider or top up. [{snippet}]")
    if status == 429:
        return HTTPException(429, f"RATE_LIMITED — {provider} is rate-limiting this key right now. Wait a minute or switch provider. [{snippet}]")
    if status == 404:
        return HTTPException(400, f"BAD_MODEL — {provider} does not know that model. Pick another model or switch provider. [{snippet}]")
    if status == 400:
        return HTTPException(400, f"BAD_MODEL — {provider} rejected the request (often the model id). Pick another model or switch provider. [{snippet}]")
    if 500 <= status:
        return HTTPException(502, f"PROVIDER_ERROR — {provider} errored ({status}). Retry, or switch provider. [{snippet}]")
    return HTTPException(502, f"PROVIDER_ERROR — {provider} returned {status}. Retry, or switch provider. [{snippet}]")


async def _complete_openai(*, base: str, key: str, model: str, system: str,
                           messages: list[ChatMessage], max_tokens: int,
                           extra_headers: Optional[dict[str, str]], provider: str) -> dict[str, Any]:
    payload = {
        "model": model,
        "messages": _openai_messages(system, messages),
        "max_tokens": max_tokens,
        "temperature": 0.4,
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    try:
        async with _client() as client:
            res = await client.post(base, json=payload, headers=headers)
    except httpx.HTTPError:
        raise HTTPException(503, f"PROVIDER_UNREACHABLE — could not reach {provider}. Check connection, retry, or switch provider.")
    if res.status_code != 200:
        raise _map_upstream(provider, res.status_code, res.text)
    try:
        data = res.json()
        text = data["choices"][0]["message"]["content"] or ""
        usage = data.get("usage") or {}
    except Exception:
        raise HTTPException(502, f"PROVIDER_ERROR — {provider} returned an unreadable reply. Retry or switch provider.")
    text = text.strip()
    if not text:
        raise HTTPException(502, f"PROVIDER_ERROR — {provider} returned an empty reply. Retry or switch provider.")
    return {"reply": text[:4000], "usage": {k: usage.get(k) for k in ("prompt_tokens", "completion_tokens", "total_tokens") if k in usage}}


async def _complete_gemini(*, key: str, model: str, system: str,
                           messages: list[ChatMessage], max_tokens: int) -> dict[str, Any]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    contents = []
    for m in messages:
        role = "model" if m.role == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": m.content}]})
    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.4},
    }
    if system.strip():
        payload["system_instruction"] = {"parts": [{"text": system.strip()}]}
    try:
        async with _client() as client:
            res = await client.post(url, json=payload, headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    except httpx.HTTPError:
        raise HTTPException(503, "PROVIDER_UNREACHABLE — could not reach gemini. Check connection, retry, or switch provider.")
    if res.status_code != 200:
        raise _map_upstream("gemini", res.status_code, res.text)
    try:
        data = res.json()
        parts = data["candidates"][0]["content"]["parts"]
        text = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
        usage = data.get("usageMetadata") or {}
    except Exception:
        raise HTTPException(502, "PROVIDER_ERROR — gemini returned an unreadable reply. Retry or switch provider.")
    if not text:
        raise HTTPException(502, "PROVIDER_ERROR — gemini returned an empty reply (possibly safety-blocked). Rephrase, retry, or switch provider.")
    return {"reply": text[:4000], "usage": {k: usage.get(k) for k in ("promptTokenCount", "candidatesTokenCount", "totalTokenCount") if k in usage}}


@router.get("/providers")
async def list_providers():
    return {"providers": [
        {"id": pid, "label": c["label"], "models": c["models"], "default": c["default"],
         "keyUrl": c["keyUrl"], "note": c["note"], "anyModel": bool(c.get("anyModel"))}
        for pid, c in PROVIDERS.items()
    ]}


@router.post("/complete")
async def complete(req: CompleteRequest, request: Request,
                   x_llm_provider: str = Header(default="", alias="X-LLM-Provider"),
                   x_llm_key: str = Header(default="", alias="X-LLM-Key")):
    # NOTE: the key is used for this single upstream call only. It is never
    # stored, never logged, and never reflected in any response.
    provider = (x_llm_provider or req.provider or "").lower()
    cfg = _provider_or_400(provider)
    key = (x_llm_key or "").strip()
    if not key or len(key) > 500:
        raise HTTPException(401, "MISSING_KEY — add your own free API key in the coach settings (keys stay in your browser only).")
    ip = ""
    try:
        ip = (request.client.host if request.client else "") or ""
    except Exception:
        ip = ""
    if ip and _throttled(ip):
        raise HTTPException(429, "SLOW_DOWN — too many coach requests. Wait a minute and retry.")
    model = _resolve_model(cfg, req.model)
    if provider == "gemini":
        out = await _complete_gemini(key=key, model=model, system=req.system, messages=req.messages, max_tokens=req.max_tokens)
    elif provider == "groq":
        out = await _complete_openai(base="https://api.groq.com/openai/v1/chat/completions",
                                     key=key, model=model, system=req.system, messages=req.messages,
                                     max_tokens=req.max_tokens, extra_headers=None, provider="groq")
    else:
        out = await _complete_openai(base="https://openrouter.ai/api/v1/chat/completions",
                                     key=key, model=model, system=req.system, messages=req.messages,
                                     max_tokens=req.max_tokens,
                                     extra_headers={"HTTP-Referer": "https://builtdiff.local", "X-Title": "BuiltDiff AI Coach"},
                                     provider="openrouter")
    return {"ok": True, "provider": provider, "model": model, **out}
