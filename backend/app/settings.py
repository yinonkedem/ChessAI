import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

_IS_PROD = os.getenv("ENV", "").lower() in {"prod", "production"}


def _required(name: str, dev_default: str | None = None) -> str:
    value = os.getenv(name)
    if value:
        return value
    if _IS_PROD:
        raise RuntimeError(f"{name} must be set in production")
    if dev_default is None:
        raise RuntimeError(f"{name} is not set. Add it to backend/.env")
    return dev_default


MONGODB_URI = _required("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "chessai")

SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if _IS_PROD:
        raise RuntimeError("JWT_SECRET_KEY must be set in production")
    SECRET_KEY = "dev-only-insecure-key"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if o.strip()
]
