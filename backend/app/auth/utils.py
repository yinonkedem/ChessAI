from datetime import datetime
from jose import jwt
from passlib.context import CryptContext
from typing import Dict

from .config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE, USERS_DB
from .schemas import UserInDB

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ---------- password helpers ----------
def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)

def get_password_hash(password: str) -> str:
    return _pwd_context.hash(password)

# ---------- user helpers ----------
def get_user(db: Dict[str, dict], username: str) -> UserInDB | None:
    if username in db:
        return UserInDB(**db[username])

def authenticate_user(db, username: str, password: str) -> UserInDB | bool:
    user = get_user(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

# ---------- JWT helpers ----------
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + TOKEN_EXPIRE
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ---------- demo only: seed initial pwd ----------
def init_dummy_user():
    if not USERS_DB["yinon"]["hashed_password"]:
        USERS_DB["yinon"]["hashed_password"] = get_password_hash("secret123")
