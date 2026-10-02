from fastapi import APIRouter, HTTPException
from httpx import HTTPError
from pydantic import BaseModel

from app.services import github_service

router = APIRouter(prefix="/api/github", tags=["github"])


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
async def init_user(req: InitUserRequest):
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
async def commit_solution(req: CommitRequest):
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
