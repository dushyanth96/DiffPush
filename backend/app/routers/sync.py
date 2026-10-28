from fastapi import APIRouter, HTTPException, Request
from httpx import HTTPError
from pydantic import BaseModel

from app.services import github_service
from app.services.rate_limit import RateLimiter, enforce

router = APIRouter(prefix="/api/github", tags=["github"])

# Two token-bearing endpoints that fan out into several GitHub calls each.
_INIT_LIMITER = RateLimiter(20, 60.0, "init-user")
_COMMIT_LIMITER = RateLimiter(40, 60.0, "commit")


class InitUserRequest(BaseModel):
    access_token: str


class CommitPayload(BaseModel):
    topic: str
    level: str = ""
    index: int = 0
    problemSlug: str
    canonicalTitle: str
    code: str
    language: str = "python"
    timeComplexity: str = "?"
    spaceComplexity: str = "?"
    questionUrl: str = ""
    passedTests: list = []
    trackerState: dict


class CommitRequest(BaseModel):
    access_token: str
    solutionPayload: CommitPayload
    branch: str = "main"


def _gh_error(e: github_service.GitHubError) -> HTTPException:
    status = 429 if e.retriable else (e.status or 502)
    if isinstance(status, int) and status < 400:
        status = 502
    return HTTPException(status, str(e))


def _unreachable() -> HTTPException:
    # DNS / TCP / TLS / timeout between server and GitHub — never a 500 leak.
    return HTTPException(503, "GitHub is unreachable from the server — check connection and retry")


@router.post("/init-user")
async def init_user(req: InitUserRequest, request: Request):
    enforce(_INIT_LIMITER, request, "SLOW_DOWN — too many GitHub init requests. Retry shortly.")
    try:
        profile = await github_service.get_user_profile(req.access_token)
        repo = await github_service.get_or_create_repo(req.access_token, profile["login"])
        remote = await github_service.fetch_tracker_state(req.access_token, profile["login"])
    except github_service.GitHubError as e:
        raise _gh_error(e)
    except HTTPError:
        raise _unreachable()
    return {"profile": profile, "repoCreated": repo["created"],
            "repoUrl": (repo["repo"] or {}).get("html_url"), "remoteTracker": remote}


@router.post("/commit")
async def commit_solution(req: CommitRequest, request: Request):
    enforce(_COMMIT_LIMITER, request, "SLOW_DOWN — too many commit requests. Retry shortly.")
    try:
        profile = await github_service.get_user_profile(req.access_token)
        result = await github_service.push_solution_commit(
            req.access_token, profile["login"], github_service.DEFAULT_REPO,
            req.solutionPayload.model_dump(), branch=req.branch)
    except github_service.GitHubError as e:
        raise _gh_error(e)
    except HTTPError:
        raise _unreachable()
    return {"ok": True, **result}
