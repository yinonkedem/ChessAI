from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlmodel import Session

from app.settings import SECRET_KEY, ALGORITHM
from app.db import get_session
from .models import User
from .utils import get_user_by_username

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")  # our login endpoint

async def get_current_user(
        token: str = Depends(oauth2_scheme),
        session: Session = Depends(get_session),
) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise cred_exc
    except JWTError:
        raise cred_exc

    user = get_user_by_username(session, username)
    if not user:
        raise cred_exc
    return user

async def get_current_active_user(
        user: User = Depends(get_current_user),
) -> User:
    if user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user
