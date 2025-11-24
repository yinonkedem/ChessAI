from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

# ---------- User ---------
class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str     = Field(index=True, unique=True)
    email: str        = Field(unique=True)
    password_hash: str
    disabled: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Game(SQLModel, table=True):
    __tablename__ = "games"
    id: Optional[int] = Field(default=None, primary_key=True)
    white_user_id: int = Field(foreign_key="users.id")
    black_user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    result: str       # "white" / "black" / "draw"
    reason: str       # "checkmate" / "resign" / "time" / ...
    moves_pgn: str    # (PGN/JSON)
    created_at: datetime = Field(default_factory=datetime.utcnow)