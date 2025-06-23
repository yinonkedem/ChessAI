from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth, engine, data
from .db import init_db

# ---------- App ----------
app = FastAPI(title="Chess-AI backend")
app.include_router(auth.router)
app.include_router(engine.router)
app.include_router(data.router)

# ---------- CORS ----------
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.86.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# ---------- Startup ----------
@app.on_event("startup")
def _startup():
    init_db()

@app.get("/")
def root():
    return {"status": "ok"}
