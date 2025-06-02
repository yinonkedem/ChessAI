from fastapi import APIRouter, HTTPException
from app.core.game_manager import game_manager
from app.models.schemas import GameCreate, GameCreated, MoveIn, GameState

router = APIRouter()

@router.post("", response_model=GameCreated, status_code=201)
def create_game(req: GameCreate):
    game_id = game_manager.create_game(req.fen)
    board = game_manager.get_board(game_id)
    return GameCreated(game_id=game_id, fen=board.fen())

@router.get("/{game_id}", response_model=GameState)
def get_game(game_id: str):
    try:
        board = game_manager.get_board(game_id)
    except KeyError:
        raise HTTPException(404, "Game not found")
    return GameState(fen=board.fen(), moves=[m.uci() for m in board.move_stack])

@router.post("/{game_id}/move", response_model=GameState)
def play_move(game_id: str, move: MoveIn):
    try:
        board = game_manager.move(game_id, move.uci)
    except KeyError:
        raise HTTPException(404, "Game not found")
    except ValueError:
        raise HTTPException(400, "Illegal move")
    return GameState(fen=board.fen(), moves=[m.uci() for m in board.move_stack])
