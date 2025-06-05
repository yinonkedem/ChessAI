import asyncio, sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import FENRequest, BestMoveRequest
import chess
from fastapi import Query
from engines import ENGINE_REGISTRY
import pathlib, os

# ─── Engine config ───────────────────────────────────────────────
ENGINE_PATH = pathlib.Path(
    "engines/stockfish/stockfish.exe")  # adjust if needed
if not ENGINE_PATH.exists():
    raise RuntimeError(
        f"Stockfish binary not found at {ENGINE_PATH.resolve()}")

app = FastAPI()

# 🆕 --- CORS ---
origins = [
    "http://localhost:3000",  # React dev server
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # which sites may call us
    allow_credentials=True,
    allow_methods=["*"],  # allow all HTTP verbs
    allow_headers=["*"],  # allow all headers
)


# 🆕 --- end ---

@app.get("/")
async def root():
    return {"message": "Hello, Chess!"}


# 🆕 ----------------------------------------
@app.post("/legal-moves")
async def legal_moves(req: FENRequest):
    """
    Return all legal moves (in UCI format) for a given FEN.
    """
    try:
        board = chess.Board(req.fen)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    moves = [move.uci() for move in board.legal_moves]
    return {"fen": req.fen, "moves": moves}


# 🆕 ----------------------------------------
@app.post("/best-move")
async def best_move(req: BestMoveRequest,
                    engine: str = Query("stockfish",
                                        description="Which engine to use")):
    """
    Ask Stockfish for its best move at the requested depth.
    """
    try:
        board = chess.Board(req.fen)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # --- look up the requested engine ---------------------------
    if engine not in ENGINE_REGISTRY:
        raise HTTPException(status_code=400,
                            detail=f"Unknown engine '{engine}'. "
                                   f"Known: {list(ENGINE_REGISTRY)}")

    def compute_move() -> str:
        return ENGINE_REGISTRY[engine](req.fen, req.depth)

    best_move = await asyncio.to_thread(compute_move)

    return {
        "fen": req.fen,
        "depth": req.depth,
        "best_move": best_move,
        "engine": engine,
    }
