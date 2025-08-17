from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import engine
from app.auth.router import router as auth_router
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="Chess-AI backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yinon-chess-ai.vercel.app",  # your prod frontend
        "http://localhost:3000",              # dev
        "http://127.0.0.1:3000",              # dev
    ],
    # If you also use Vercel preview URLs, allow all *.vercel.app:
    allow_origin_regex=r"https://.*\.vercel\.app$",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,  # needed if you send cookies
)

# Routers AFTER CORS
app.include_router(auth_router)
app.include_router(engine.router)

@app.get("/")
def health():
    return {"status": "ok"}
