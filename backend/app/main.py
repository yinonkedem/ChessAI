import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.db import close_db, init_db
from app.routers import engine, games
from app.settings import CORS_ORIGINS


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(title="Chess-AI backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth_router)
app.include_router(engine.router)
app.include_router(games.router)

logger = logging.getLogger("chess-backend")


@app.get("/health")
def health():
    return {"status": "ok"}
