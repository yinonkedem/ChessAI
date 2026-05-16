from beanie import PydanticObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.models import User
from app.settings import ALGORITHM, SECRET_KEY

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise cred_exc
    except JWTError:
        raise cred_exc

    try:
        oid = PydanticObjectId(user_id)
    except Exception:
        raise cred_exc

    user = await User.get(oid)
    if not user:
        raise cred_exc
    return user


async def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    if user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user
