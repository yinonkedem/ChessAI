from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..engines import ENGINE_REGISTRY

router = APIRouter(prefix="/engine", tags=["engine"])

class BestMoveIn(BaseModel):
    fen: str = Field(..., example="startpos")
    depth: int = Field(ge=1, le=30, default=15)

@router.post("/best-move")
def best_move(pay: BestMoveIn, engine: str = Query("stockfish")):
    if engine not in ENGINE_REGISTRY:
        raise HTTPException(status_code=404, detail="Unknown engine")
    return ENGINE_REGISTRY[engine](pay.fen, pay.depth)
