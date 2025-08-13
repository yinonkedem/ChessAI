from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import engine
from app.auth.router import router as auth_router

app = FastAPI(title="Chess-AI backend")

# Routers
app.include_router(auth_router)
app.include_router(engine.router)

# CORS (unchanged)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.86.1:3000",
    "https://yinon-chess-ai.vercel.app",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.get("/")
def health():
    return {"status": "ok"}
