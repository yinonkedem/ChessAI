from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr

from app.models import User, UserStats

from .dependencies import get_current_active_user
from .utils import authenticate_user, create_access_token, get_password_hash

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupBody(BaseModel):
    username: str
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    disabled: bool
    stats: UserStats


def _to_out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        username=user.username,
        email=user.email,
        disabled=user.disabled,
        stats=user.stats,
    )


@router.post("/signup", response_model=UserOut, status_code=201)
async def signup(body: SignupBody):
    if await User.find_one(User.username == body.username):
        raise HTTPException(status_code=409, detail="Username already exists")
    if await User.find_one(User.email == body.email):
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=get_password_hash(body.password),
    )
    await user.insert()
    return _to_out(user)


@router.post("/login", response_model=TokenOut)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": str(user.id)})
    return TokenOut(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_active_user)):
    return _to_out(current_user)
