"""Shared per-IP throttle for the public API.

In-process and single-worker by design: the API runs as one uvicorn process
(same assumption as the rooms store), so a dict is enough. Every 429 carries
a Retry-After header so clients can back off instead of hammering.
"""
import time
from typing import Optional

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, limit: int, window_s: float, name: str = "") -> None:
        self.limit = limit
        self.window_s = window_s
        self.name = name
        self._hits: dict[str, list[float]] = {}

    def retry_after(self, key: str) -> int:
        """Record a hit. Returns 0 when allowed, else seconds to wait."""
        now = time.monotonic()
        hits = [t for t in self._hits.get(key, ()) if now - t < self.window_s]
        if len(hits) >= self.limit:
            self._hits[key] = hits
            return max(1, int(self.window_s - (now - hits[0])) + 1)
        hits.append(now)
        self._hits[key] = hits
        if len(self._hits) > 4096:
            self._prune(now)
        return 0

    def reset(self) -> None:
        self._hits.clear()

    def _prune(self, now: float) -> None:
        stale = [k for k, hits in self._hits.items()
                 if not hits or now - hits[-1] >= self.window_s]
        for k in stale:
            self._hits.pop(k, None)


def client_ip(request: Request) -> str:
    """Real client IP behind Cloudflare / reverse proxies."""
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return (request.client.host if request.client else "") or "unknown"


def enforce(limiter: RateLimiter, request: Request, detail: str) -> None:
    retry = limiter.retry_after(client_ip(request))
    if retry:
        raise HTTPException(429, detail, headers={"Retry-After": str(retry)})
