"""GitHub REST client for the DiffPush commit-sync engine (httpx, async)."""
import base64
import json
import re

import httpx

GITHUB_API = "https://api.github.com"
API_VERSION = "2022-11-28"
TRACKER_PATH = ".builtdiff/tracker.json"
DEFAULT_REPO = "diffpush-solutions"

LANG_EXT = {"python": "py", "cpp": "cpp", "java": "java", "javascript": "js"}


def _safe_segment(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", (s or "").strip()).strip("-") or "general"


# Elo tiers mirrored from frontend useTracker.js — shown on the profile README.
TIERS = [
    (0, "Script Kiddie"),
    (2500, "Systems Operator"),
    (7500, "Kernel Hacker"),
    (15000, "Staff Architect"),
    (30000, "Built Different"),
]

SITE_URL = "https://diffpush.pages.dev"


def tier_for(score: int) -> str:
    name = TIERS[0][1]
    try:
        score = int(score or 0)
    except Exception:
        score = 0
    for minimum, tier_name in TIERS:
        if score >= minimum:
            name = tier_name
    return name


def _comment_prefix(ext: str) -> str:
    return "#" if ext == "py" else "//"


def _compact(value, limit: int = 180) -> str:
    """One-line JSON-ish rendering for test case values in comments."""
    try:
        s = json.dumps(value, ensure_ascii=False, sort_keys=True)
    except Exception:
        s = str(value)
    s = " ".join(s.split())
    return s if len(s) <= limit else s[: limit - 1] + "…"


def format_solution_file(*, title: str, topic: str, question_url: str,
                         code: str, ext: str, passed_tests) -> str:
    """Wrap raw solution code with the DiffPush header/footer comment block:

    header: question title + topic, full-question link on our site.
    footer: the test cases that passed, as comments.
    """
    p = _comment_prefix(ext)
    lines = [f"{p} {title} — {topic}"]
    if (question_url or "").strip():
        lines.append(f"{p} For full question visit: {question_url.strip()}")
    lines.append(f"{p} Solved via DiffPush — pushed from the workspace on green.")
    body = (code or "").rstrip("\n")
    tests = [t for t in (passed_tests or []) if isinstance(t, dict)][:8]
    if tests:
        footer = [f"{p} Passed test cases:"]
        for i, t in enumerate(tests, 1):
            footer.append(f"{p} {i}. Input: {_compact(t.get('input'))} => Expected: {_compact(t.get('expected'))}")
        return "\n".join(lines) + "\n" + body + "\n" + "\n".join(footer) + "\n"
    return "\n".join(lines) + "\n" + body + "\n"


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
                  "description": "Elite DSA solutions & telemetry powered by DiffPush",
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


def build_profile_readme(*, login: str, solved_total: int,
                         diff_score: int = 0, streak: int = 0,
                         last_active=None) -> str:
    """Profile README for the solutions repo: markets the platform and shows
    the owner's live status/progress to visitors. Refreshed on every push."""
    try:
        solved_total = int(solved_total or 0)
    except Exception:
        solved_total = 0
    try:
        streak = int(streak or 0)
    except Exception:
        streak = 0
    last = str(last_active or "—")
    return (
        f"# 🧠 {login}'s DSA solutions — powered by [DiffPush]({SITE_URL})\n"
        f"\n"
        f"> Master the complete A2Z DSA sheet with zero-latency browser execution, "
        f"automated GitHub commit pushing, and Leitner spaced repetition. "
        f"100% open-source — [start tracking free]({SITE_URL}).\n"
        f"\n"
        f"## 📊 Live progress (auto-updated on every solve)\n"
        f"\n"
        f"| Problems solved | Tier | DIFF score | Day streak | Last active |\n"
        f"|-- |-- |-- |-- |--|\n"
        f"| **{solved_total}** | **{tier_for(diff_score)}** | **{diff_score or 0}** | **🔥 {streak}** | {last} |\n"
        f"\n"
        f"## 🗂️ Solutions\n"
        f"\n"
        f"Browse by topic folders above — every file carries its Big-O in the "
        f"commit message, a header linking back to the full question on DiffPush, "
        f"and the test cases it passed. Green squares below are real commits, "
        f"earned one accepted solution at a time.\n"
    )


async def push_solution_commit(access_token: str, owner: str, repo_name: str,
                               commit_data: dict, branch: str = "main") -> dict:
    """Push solution file + merged tracker.json + refreshed profile README.
    Returns SHAs + repo URL."""
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
    sol_text = format_solution_file(
        title=commit_data["canonicalTitle"],
        topic=topic,
        question_url=commit_data.get("questionUrl") or "",
        code=commit_data["code"],
        ext=ext,
        passed_tests=commit_data.get("passedTests") or [],
    )
    sol_b64 = base64.b64encode(sol_text.encode("utf-8")).decode()

    headers = _headers(access_token)
    async with httpx.AsyncClient(timeout=30) as client:
        sol = await _put_file(client, headers, owner, repo_name, sol_path, sol_b64, sol_msg, branch)
        remote_state = await fetch_tracker_state(access_token, owner, repo_name, branch)
        merged = merge_tracker_states(remote_state, commit_data["trackerState"])
        tracker_b64 = base64.b64encode(json.dumps(merged, indent=2).encode("utf-8")).decode()
        trk = await _put_file(client, headers, owner, repo_name, TRACKER_PATH, tracker_b64,
                              "chore(sync): update DiffPush telemetry state", branch)
        stats = merged.get("stats", {}) if isinstance(merged, dict) else {}
        solved_total = len(merged.get("solvedMap", {}) or {})
        readme_text = build_profile_readme(
            login=owner,
            solved_total=solved_total,
            diff_score=stats.get("diffScore", 0),
            streak=stats.get("currentStreak", 0),
            last_active=stats.get("lastActiveDate"),
        )
        readme_b64 = base64.b64encode(readme_text.encode("utf-8")).decode()
        await _put_file(client, headers, owner, repo_name, "README.md", readme_b64,
                        f"docs(sync): refresh profile README — {solved_total} solved", branch)
        # Best-effort repo blurb so the repo header markets the platform too.
        # Never fails the push: a blurb is cosmetic, the solves are not.
        try:
            await client.patch(
                f"{GITHUB_API}/repos/{owner}/{repo_name}",
                headers=headers,
                json={"description": f"🧠 {solved_total} DSA solutions · {stats.get('currentStreak', 0)}-day streak · powered by DiffPush — {SITE_URL}"},
            )
        except Exception:
            pass
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
