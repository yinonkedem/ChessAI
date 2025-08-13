from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from .config import SECRET_KEY, ALGORITHM, USERS_DB
from .schemas import TokenData, UserInDB
from .utils import get_user

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# ---------- dependency chain ----------
async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise cred_exc
        token_data = TokenData(username=username)
    except JWTError:
        raise cred_exc

    user = get_user(USERS_DB, token_data.username)
    if not user:
        raise cred_exc
    return user

async def get_current_active_user(
        current_user: UserInDB = Depends(get_current_user),
) -> UserInDB:
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
