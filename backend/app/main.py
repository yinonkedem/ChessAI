from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import engine
from app.auth.router import router as auth_router


app = FastAPI(title="Chess-AI backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yinon-chess-ai.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app$",
    allow_methods=["GET", "POST", "OPTIONS"],           # explicit
    allow_headers=["Content-Type", "Authorization", "depth"],  # include any custom header you send
    allow_credentials=True,                             # only if you actually send cookies
    max_age=86400,
)

# Routers AFTER CORS
app.include_router(auth_router)
app.include_router(engine.router)

@app.get("/")
def health():
    return {"status": "ok"}
