from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import FENRequest
import chess

app = FastAPI()

# 🆕 --- CORS ---
origins = [
    "http://localhost:3000",      # React dev server
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # which sites may call us
    allow_credentials=True,
    allow_methods=["*"],          # allow all HTTP verbs
    allow_headers=["*"],          # allow all headers
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
