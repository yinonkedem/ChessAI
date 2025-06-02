from pydantic import BaseModel

# ---------- Games ----------

class GameCreate(BaseModel):
    fen: str | None = None

class GameCreated(BaseModel):
    game_id: str
    fen: str

class MoveIn(BaseModel):
    uci: str

class GameState(BaseModel):
    fen: str
    moves: list[str]

# ---------- AI ----------

class BestMoveIn(BaseModel):
    fen: str
    depth: int = 18

class BestMoveOut(BaseModel):
    bestmove: str
    score: float
