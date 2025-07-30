from sqlmodel import create_engine, Session
from .core.config import settings

url = settings.db_url
connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
engine = create_engine(url, echo=False, pool_pre_ping=True, connect_args=connect_args)

def init_db() -> None:
    from .models import SQLModel
    SQLModel.metadata.create_all(engine)
