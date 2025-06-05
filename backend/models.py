# models.py
from pydantic import BaseModel, Field

class FENRequest(BaseModel):
    fen: str = Field(
        ...,
        example="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        description="FEN string",
    )

class BestMoveRequest(FENRequest):
    depth: int = Field(15, ge=1, le=30, description="Search depth for Stockfish")
