# app/db.py
from typing import Generator
from sqlmodel import create_engine, Session
from .settings import DATABASE_URL

import logging
logger = logging.getLogger(__name__)
logger.info(f"*** USING DATABASE_URL = {DATABASE_URL}")

engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)

# ✅ FastAPI dependency that YIELDS a real Session
def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
