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
