from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, sync, rooms, chat

app = FastAPI(title="DiffPush API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sync.router)
app.include_router(rooms.router)
app.include_router(chat.router)


@app.get("/api/health")
async def health():
    return {"ok": True, "service": "diffpush-backend"}
