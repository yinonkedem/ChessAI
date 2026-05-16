import logging

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from .models import Game, User
from .settings import MONGODB_DB_NAME, MONGODB_URI

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None


async def init_db() -> None:
    global _client
    _client = AsyncIOMotorClient(MONGODB_URI)
    await init_beanie(
        database=_client[MONGODB_DB_NAME],
        document_models=[User, Game],
    )
    logger.info("Mongo connected: db=%s", MONGODB_DB_NAME)


async def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
