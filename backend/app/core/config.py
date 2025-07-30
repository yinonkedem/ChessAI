from pydantic import BaseSettings

class Settings(BaseSettings):
    db_url: str = "sqlite:///./app.db"
    jwt_secret_key: str
    access_token_expire_minutes: int = 60

    class Config:
        env_file = ".env"
        extra = "ignore"
        fields = {"db_url": {"env": ["DB_URL", "DATABASE_URL"]}}

settings = Settings()   # import this everywhere
