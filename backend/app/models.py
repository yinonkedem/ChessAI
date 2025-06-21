from datetime import datetime

from sqlmodel import Field, SQLModel, Relationship
from typing import Optional, List

# ---------- User ---------
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str = Field(unique=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    samples: List["TrainingSample"] = Relationship(back_populates="owner")


# ---------- Samples for future AI training ---------
class TrainingSample(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    fen: str
    move: str
    result: int  # 1, 0, -1  (win / draw / loss)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    owner_id: int = Field(foreign_key="user.id")
    owner: Optional[User] = Relationship(back_populates="samples")
