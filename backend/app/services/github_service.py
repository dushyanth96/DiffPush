"""GitHub REST client for the BuiltDiff commit-sync engine (httpx, async)."""
import base64
import json
import re

import httpx

GITHUB_API = "https://api.github.com"
API_VERSION = "2022-11-28"
TRACKER_PATH = ".builtdiff/tracker.json"
DEFAULT_REPO = "builtdiff-solutions"

LANG_EXT = {"python": "py", "cpp": "cpp", "java": "java", "javascript": "js"}


def _safe_segment(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", (s or "").strip()).strip("-") or "general"


class GitHubError(Exception):
    def __init__(self, message, status=None, retriable=False):
        super().__init__(message)
        self.status = status
        self.retriable = retriable


def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
    }


def _raise_for_rate_limit(resp: httpx.Response) -> None:
    if resp.status_code in (403, 429):
        remaining = resp.headers.get("x-ratelimit-remaining", "?")
        raise GitHubError(
            f"GitHub rate limit hit (remaining={remaining}). Retry after "
            f"{resp.headers.get('retry-after', resp.headers.get('x-ratelimit-reset', '?'))}.",
            status=resp.status_code,
            retriable=True,
        )


async def exchange_oauth_code(client_id: str, client_secret: str, code: str, redirect_uri: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            json={"client_id": client_id, "client_secret": client_secret,
                  "code": code, "redirect_uri": redirect_uri},
        )
    data = resp.json()
    if resp.status_code != 200 or "access_token" not in data:
        raise GitHubError(f"OAuth exchange failed: {data.get('error_description', data)}",
                          status=resp.status_code)
    return {"access_token": data["access_token"], "token_type": data.get("token_type", "bearer"),
            "scope": data.get("scope", "")}


async def get_user_profile(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"{GITHUB_API}/user", headers=_headers(access_token))
    _raise_for_rate_limit(resp)
    if resp.status_code != 200:
        raise GitHubError(f"GET /user failed: {resp.text[:200]}", status=resp.status_code)
    u = resp.json()
    return {"login": u.get("login"), "name": u.get("name"),
            "avatar_url": u.get("avatar_url"), "html_url": u.get("html_url")}


async def get_or_create_repo(access_token: str, owner: str, repo_name: str = DEFAULT_REPO) -> dict:
    headers = _headers(access_token)
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"{GITHUB_API}/repos/{owner}/{repo_name}", headers=headers)
        if resp.status_code == 200:
            return {"repo": resp.json(), "created": False}
        if resp.status_code != 404:
            _raise_for_rate_limit(resp)
            raise GitHubError(f"Repo lookup failed: {resp.text[:200]}", status=resp.status_code)
        create = await client.post(
            f"{GITHUB_API}/user/repos",
            headers=headers,
            json={"name": repo_name, "private": False,
                  "description": "Elite DSA solutions & telemetry powered by BuiltDiff",
                  "auto_init": True},
        )
        _raise_for_rate_limit(create)
        if create.status_code not in (200, 201):
            raise GitHubError(f"Repo creation failed: {create.text[:200]}", status=create.status_code)
        return {"repo": create.json(), "created": True}


async def _get_file_sha(client: httpx.AsyncClient, headers: dict, owner: str,
                        repo: str, path: str, branch: str) -> str | None:
    resp = await client.get(
        f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
        headers=headers, params={"ref": branch})
    if resp.status_code == 200:
        return resp.json().get("sha")
    return None


async def _put_file(client: httpx.AsyncClient, headers: dict, owner: str, repo: str,
                    path: str, b64: str, message: str, branch: str) -> dict:
    sha = await _get_file_sha(client, headers, owner, repo, path, branch)
    payload = {"message": message, "content": b64, "branch": branch}
    if sha:
        payload["sha"] = sha  # update path — avoids 409/422 on existing files
    resp = await client.put(f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
                            headers=headers, json=payload)
    _raise_for_rate_limit(resp)
    if resp.status_code not in (200, 201):
        raise GitHubError(f"PUT {path} failed: {resp.text[:200]}", status=resp.status_code)
    return resp.json()


def merge_tracker_states(remote: dict, incoming: dict) -> dict:
    """Union of solved IDs (incoming wins per-problem), max streak, latest stats."""
    remote = remote or {}
    incoming = incoming or {}
    r_solved, i_solved = remote.get("solvedMap", {}), incoming.get("solvedMap", {})
    merged_solved = {**r_solved, **i_solved}
    r_stats, i_stats = remote.get("stats", {}), incoming.get("stats", {})
    merged_stats = {
        "totalSolved": len(merged_solved),
        "diffScore": max(r_stats.get("diffScore", 0), i_stats.get("diffScore", 0)),
        "currentStreak": max(r_stats.get("currentStreak", 0), i_stats.get("currentStreak", 0)),
        "lastActiveDate": max(str(r_stats.get("lastActiveDate") or ""),
                              str(i_stats.get("lastActiveDate") or "")) or None,
    }
    squares = dict(remote.get("dailySquares", {}) or {})
    for k, v in (incoming.get("dailySquares", {}) or {}).items():
        squares[k] = max(squares.get(k, 0), v or 0)
    return {
        "stats": merged_stats,
        "solvedMap": merged_solved,
        "starredIds": sorted(set(remote.get("starredIds", [])) | set(incoming.get("starredIds", []))),
        "reviewQueue": sorted(set(remote.get("reviewQueue", [])) | set(incoming.get("reviewQueue", []))),
        "boxState": {**(remote.get("boxState", {}) or {}), **(incoming.get("boxState", {}) or {})},
        "achievements": sorted(set(remote.get("achievements", []) or []) | set(incoming.get("achievements", []) or [])),
        "comboCount": max(remote.get("comboCount", 0) or 0, incoming.get("comboCount", 0) or 0),
        "lastSolveAt": max(remote.get("lastSolveAt", 0) or 0, incoming.get("lastSolveAt", 0) or 0) or None,
        "dailySquares": squares,
        "freezes": max(remote.get("freezes", 0) or 0, incoming.get("freezes", 0) or 0),
        "goal": incoming.get("goal") or remote.get("goal"),
    }


async def push_solution_commit(access_token: str, owner: str, repo_name: str,
                               commit_data: dict, branch: str = "main") -> dict:
    """Push solution file + merged tracker.json. Returns SHAs + repo URL."""
    for k in ("topic", "problemSlug", "canonicalTitle", "code", "language", "trackerState"):
        if not commit_data.get(k):
            raise GitHubError(f"commit_data missing required field: {k}", status=400)
    topic = commit_data["topic"]
    slug = commit_data["problemSlug"]
    ext = LANG_EXT.get(commit_data["language"], "py")
    index = str(commit_data.get("index", 0)).zfill(3)
    # Mirror the curriculum hierarchy in the repo: topic/level/file.
    level = _safe_segment(commit_data.get("level") or "")
    sol_path = f"{topic}/{level}/{index}_{slug}.{ext}" if level != "general" else f"{topic}/{index}_{slug}.{ext}"
    tc, sc = commit_data.get("timeComplexity", "?"), commit_data.get("spaceComplexity", "?")
    sol_msg = f"feat({topic}): solve {commit_data['canonicalTitle']} [Time: {tc} | Space: {sc}]"
    sol_b64 = base64.b64encode(commit_data["code"].encode("utf-8")).decode()

    headers = _headers(access_token)
    async with httpx.AsyncClient(timeout=30) as client:
        sol = await _put_file(client, headers, owner, repo_name, sol_path, sol_b64, sol_msg, branch)
        remote_state = await fetch_tracker_state(access_token, owner, repo_name, branch)
        merged = merge_tracker_states(remote_state, commit_data["trackerState"])
        tracker_b64 = base64.b64encode(json.dumps(merged, indent=2).encode("utf-8")).decode()
        trk = await _put_file(client, headers, owner, repo_name, TRACKER_PATH, tracker_b64,
                              "chore(sync): update BuiltDiff telemetry state", branch)
    return {
        "solutionCommitSha": (sol.get("commit") or {}).get("sha"),
        "solutionPath": sol_path,
        "trackerCommitSha": (trk.get("commit") or {}).get("sha"),
        "repoUrl": f"https://github.com/{owner}/{repo_name}",
    }


async def fetch_tracker_state(access_token: str, owner: str,
                              repo_name: str = DEFAULT_REPO, branch: str = "main") -> dict:
    headers = _headers(access_token)
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{GITHUB_API}/repos/{owner}/{repo_name}/contents/{TRACKER_PATH}",
            headers=headers, params={"ref": branch})
    if resp.status_code == 404:
        return {}
    _raise_for_rate_limit(resp)
    if resp.status_code != 200:
        raise GitHubError(f"Tracker fetch failed: {resp.text[:200]}", status=resp.status_code)
    try:
        return json.loads(base64.b64decode(resp.json()["content"]).decode("utf-8"))
    except Exception as e:
        raise GitHubError(f"Tracker decode failed: {e}", status=resp.status_code)
