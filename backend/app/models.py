from datetime import datetime
from typing import Literal

from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, EmailStr, Field
from pymongo import IndexModel


class UserStats(BaseModel):
    games_played: int = 0
    wins: int = 0
    losses: int = 0
    draws: int = 0


class TrainerStats(BaseModel):
    """Opening-trainer counters. Separate from UserStats, which is game W/L/D."""

    reviews: int = 0
    correct: int = 0
    day_streak: int = 0
    longest_streak: int = 0
    last_active_day: str | None = None   # "2026-09-20", the user's local day


class User(Document):
    username: Indexed(str, unique=True)
    email: Indexed(EmailStr, unique=True)
    password_hash: str
    disabled: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    stats: UserStats = Field(default_factory=UserStats)
    # Existing user documents predate this field; Beanie fills the default on
    # read, so no migration is needed.
    trainer: TrainerStats = Field(default_factory=TrainerStats)

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


class TrainingCard(Document):
    """One position the learner has to answer, in one repertoire.

    Keyed by the UCI path that reaches the position — the same key the opening
    tree uses — so a shared prefix like 1.e4 is a single card no matter how
    many lines pass through it.
    """

    user_id: PydanticObjectId
    repertoire_id: str
    path: str                 # "" is the start position
    box: int = 0
    due: datetime = Field(default_factory=datetime.utcnow)
    reps: int = 0
    lapses: int = 0
    last_reviewed: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "training_cards"
        # The first compound indexes in this codebase — the Indexed() field
        # wrapper used above can't express them. The unique one is what makes
        # review upserts idempotent when a device syncs twice.
        indexes = [
            IndexModel([("user_id", 1), ("due", 1)]),
            IndexModel(
                [("user_id", 1), ("repertoire_id", 1), ("path", 1)],
                unique=True,
                name="uniq_user_repertoire_path",
            ),
        ]
