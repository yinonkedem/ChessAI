import os

# Render will inject these. Keep simple & robust:
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")
SECRET_KEY   = os.getenv("SECRET_KEY", "CHANGE_ME_IN_RENDER")
ALGORITHM    = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
