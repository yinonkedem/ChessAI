from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.routers import engine
from app.auth.router import router as auth_router
import time
import random
import logging

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
logger = logging.getLogger("chess-backend")

@app.get("/")
def health():
    return {"status": "ok"}

# 1️⃣ FAIL ENDPOINT — generate errors
@app.get("/fail")
def fail():
    logger.error("Simulated failure endpoint triggered!")
    raise HTTPException(status_code=500, detail="Simulated internal server error")


# 2️⃣ SLOW ENDPOINT — latency simulation
@app.get("/slow/{seconds}")
def slow(seconds: int):
    logger.warning(f"Slow endpoint triggered, sleeping {seconds} seconds")
    time.sleep(seconds)
    return {"slept_for": seconds}


# 3️⃣ RANDOM ERROR endpoint — useful for log patterns
@app.get("/random")
def random_fail():
    r = random.random()
    if r < 0.5:
        logger.error("Random failure generated!")
        raise HTTPException(status_code=500, detail="Random failure occurred")
    logger.info("Random endpoint succeeded")
    return {"status": "success", "value": r}


# 4️⃣ HIGH LOAD endpoint — spike CPU
@app.get("/load/{n}")
def load(n: int):
    logger.warning(f"Load endpoint triggered with n={n}")
    total = 0
    for i in range(n * 100000):
        total += i*i
    return {"result": total, "operations": n * 100000}


# 5️⃣ LOG SPAM endpoint — generate a lot of logs
@app.get("/logs/{count}")
def logs(count: int):
    for i in range(count):
        logger.info(f"Log spam line {i+1}/{count}")
    return {"generated_logs": count}


# 6️⃣ HEALTH CHECK — required for monitoring
@app.get("/health")
def health():
    logger.info("Health check OK")
    return {"health": "ok", "uptime": time.time()}
