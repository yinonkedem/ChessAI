from datetime import datetime
from typing import Literal

from beanie import PydanticObjectId
from beanie.operators import Inc
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_active_user
from app.models import Game, User, UserStats

router = APIRouter(prefix="/games", tags=["games"])


class GameIn(BaseModel):
    user_color: Literal["w", "b"]
    opponent_type: Literal["ai", "rand", "human"]
    result: Literal["win", "loss", "draw"]
    reason: str = Field(min_length=1, max_length=64)
    moves: list[str] = Field(default_factory=list)
    final_fen: str


class GameOut(BaseModel):
    id: str
    user_color: Literal["w", "b"]
    opponent_type: Literal["ai", "rand", "human"]
    result: Literal["win", "loss", "draw"]
    reason: str
    moves: list[str]
    final_fen: str
    created_at: datetime


def _to_out(game: Game) -> GameOut:
    return GameOut(
        id=str(game.id),
        user_color=game.user_color,
        opponent_type=game.opponent_type,
        result=game.result,
        reason=game.reason,
        moves=game.moves,
        final_fen=game.final_fen,
        created_at=game.created_at,
    )


_RESULT_FIELD = {"win": "stats.wins", "loss": "stats.losses", "draw": "stats.draws"}


@router.post("", response_model=GameOut, status_code=201)
async def create_game(
    body: GameIn,
    current_user: User = Depends(get_current_active_user),
):
    game = Game(user_id=current_user.id, **body.model_dump())
    await game.insert()

    await current_user.update(
        Inc({"stats.games_played": 1, _RESULT_FIELD[body.result]: 1})
    )
    return _to_out(game)


@router.get("", response_model=list[GameOut])
async def list_games(
    current_user: User = Depends(get_current_active_user),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    games = (
        await Game.find(Game.user_id == current_user.id)
        .sort(-Game.created_at)
        .skip(skip)
        .limit(limit)
        .to_list()
    )
    return [_to_out(g) for g in games]


@router.get("/{game_id}", response_model=GameOut)
async def get_game(
    game_id: str,
    current_user: User = Depends(get_current_active_user),
):
    try:
        oid = PydanticObjectId(game_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Game not found")

    game = await Game.get(oid)
    if not game or game.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Game not found")
    return _to_out(game)


__all__ = ["router", "UserStats"]
