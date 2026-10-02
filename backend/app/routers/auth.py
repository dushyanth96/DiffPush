from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException
from httpx import HTTPError
from pydantic import BaseModel

from app.config import settings
from app.services import github_service

router = APIRouter(prefix="/api/auth/github", tags=["auth"])


class ExchangeRequest(BaseModel):
    code: str


@router.get("/login")
async def github_login():
    if not settings.github_client_id:
        raise HTTPException(400, "GitHub OAuth not configured: set GITHUB_CLIENT_ID (see .env.example)")
    qs = urlencode({
        "client_id": settings.github_client_id,
        "scope": "repo,read:user",
        "redirect_uri": settings.github_redirect_uri,
    })
    return {"authorize_url": f"https://github.com/login/oauth/authorize?{qs}"}


@router.post("/exchange")
async def github_exchange(req: ExchangeRequest):
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(400, "GitHub OAuth not configured: set GITHUB_CLIENT_ID/SECRET")
    try:
        return await github_service.exchange_oauth_code(
            settings.github_client_id, settings.github_client_secret,
            req.code, settings.github_redirect_uri)
    except github_service.GitHubError as e:
        raise HTTPException(e.status or 502, str(e))
    except HTTPError:
        raise HTTPException(503, "GitHub is unreachable from the server — check connection and retry")
