"""Student feedback intake.

Public POST for the in-app feedback modal (no login required — friction is
the enemy of signal). Optional admin GET guarded by a shared token from the
environment (FEEDBACK_ADMIN_TOKEN); unset token disables the read endpoint
entirely.
"""
import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services import feedback_db
from app.services.rate_limit import RateLimiter, enforce

# 5 submissions per hour per IP — generous for a human, useless for spam.
_LIMITER = RateLimiter(5, 3600.0, "feedback")

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

ALLOWED_TYPES = {"bug", "feature", "difficulty", "other"}
MAX_MESSAGE_LEN = 4000
MAX_EMAIL_LEN = 120
MAX_ROUTE_LEN = 200


class FeedbackIn(BaseModel):
    type: str = "other"
    message: str
    email: str | None = None
    route: str | None = None
    userAgent: str | None = None


@router.post("")
async def submit_feedback(fb: FeedbackIn, request: Request):
    enforce(_LIMITER, request, "FEEDBACK_RATE_LIMITED")

    if fb.type not in ALLOWED_TYPES:
        raise HTTPException(422, "INVALID_TYPE")

    message = (fb.message or "").strip()
    if len(message) < 3:
        raise HTTPException(422, "MESSAGE_TOO_SHORT")
    if len(message) > MAX_MESSAGE_LEN:
        raise HTTPException(422, "MESSAGE_TOO_LONG")

    email = (fb.email or "").strip() or None
    if email and ("@" not in email or len(email) > MAX_EMAIL_LEN):
        raise HTTPException(422, "INVALID_EMAIL")

    route = (fb.route or "")[:MAX_ROUTE_LEN] or None
    user_agent = (fb.userAgent or "")[:300] or None

    row_id = feedback_db.insert({
        "type": fb.type,
        "message": message,
        "email": email,
        "route": route,
        "userAgent": user_agent,
    })
    return {"ok": True, "id": row_id}


@router.get("")
async def read_feedback(request: Request, token: str = "", limit: int = 200):
    expected = os.getenv("FEEDBACK_ADMIN_TOKEN", "")
    if not expected or token != expected:
        raise HTTPException(403, "FORBIDDEN")
    return {"items": feedback_db.list_feedback(min(max(limit, 1), 500))}
