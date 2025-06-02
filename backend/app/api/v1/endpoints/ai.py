from fastapi import APIRouter
from app.models.schemas import BestMoveIn, BestMoveOut

router = APIRouter()

@router.post("/best-move", response_model=BestMoveOut)
def best_move(req: BestMoveIn):
    # TODO: plug real Stockfish; placeholder returns random suggestion
    return BestMoveOut(bestmove="0000", score=0.0)
