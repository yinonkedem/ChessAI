from pydantic import BaseModel, Field

class FENRequest(BaseModel):
    fen: str = Field(
        ...,
        example="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        description="A full FEN string representing the current board",
    )
