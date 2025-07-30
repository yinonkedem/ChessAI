from contextlib import contextmanager

from sqlmodel import create_engine, Session

from .core.config import settings

url = settings.db_url
connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
engine = create_engine(url, echo=False, pool_pre_ping=True, connect_args=connect_args)

def init_db() -> None:
    """Call once to create all tables."""
    from .models import SQLModel  # import late to avoid circulars
    SQLModel.metadata.create_all(engine)

@contextmanager
def get_session():
    with Session(engine) as session:
        yield session
