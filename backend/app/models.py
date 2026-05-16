from datetime import datetime
from typing import Literal

from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, EmailStr, Field


class UserStats(BaseModel):
    games_played: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0


class User(Document):
    username: Indexed(str, unique=True)
    email: Indexed(EmailStr, unique=True)
    password_hash: str
    disabled: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    stats: UserStats = Field(default_factory=UserStats)

    class Settings:
        name = "users"


class Game(Document):
    user_id: PydanticObjectId
    user_color: Literal["w", "b"]
    opponent_type: Literal["ai", "rand", "human"]
    result: Literal["win", "loss", "draw"]
    reason: str
    moves: list[str] = Field(default_factory=list)
    final_fen: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "games"
