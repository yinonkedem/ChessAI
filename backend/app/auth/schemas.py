from pydantic import BaseModel
from typing import Optional, List  # (List used in /me/items demo)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    disabled: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

# --- Demo response used in main code ----------
class Item(BaseModel):
    item_id: int
    owner: User
