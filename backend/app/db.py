from contextlib import contextmanager

from sqlmodel import create_engine, Session

from .core.config import settings

engine = create_engine(settings.db_url, echo=False, pool_pre_ping=True)

def init_db() -> None:
    """Call once to create all tables."""
    from .models import SQLModel  # import late to avoid circulars
    SQLModel.metadata.create_all(engine)

@contextmanager
def get_session():
    with Session(engine) as session:
        yield session
