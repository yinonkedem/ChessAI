from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field

from app.models import Game, TrainingCard, User, UserStats

from .dependencies import get_current_active_user
from .utils import (
    authenticate_user,
    create_access_token,
    get_password_hash,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# bcrypt only reads the first 72 BYTES of a password and silently ignores the
# rest, so anything longer is a lie about how strong the password is. Reject it
# up front instead. (Also why requirements.txt pins bcrypt==4.0.1 — 4.1+ raises
# instead of truncating, which breaks passlib 1.7.4's self-test.)
Password = Annotated[str, Field(min_length=8, max_length=72)]


class SignupBody(BaseModel):
    username: str
    email: EmailStr
    password: Password


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: Password


class DeleteAccountBody(BaseModel):
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


@router.post("/change-password", status_code=204, response_class=Response)
async def change_password(
    body: ChangePasswordBody,
    current_user: User = Depends(get_current_active_user),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=403, detail="Current password is incorrect")
    if body.new_password == body.current_password:
        raise HTTPException(
            status_code=400, detail="New password must be different from the current one"
        )

    current_user.password_hash = get_password_hash(body.new_password)
    await current_user.save()
    # Existing tokens stay valid: the JWT subject is the user id, and we have no
    # token blocklist. Changing the password does not sign other sessions out.
    return Response(status_code=204)


@router.delete("/me", status_code=204, response_class=Response)
async def delete_account(
    body: DeleteAccountBody,
    current_user: User = Depends(get_current_active_user),
):
    """Permanently delete the signed-in user and everything owned by them.

    Owned documents go first, so a partial failure can never leave rows
    pointing at a user id that no longer exists. Anything new that references
    user_id must be added here too.
    """
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=403, detail="Password is incorrect")

    await Game.find(Game.user_id == current_user.id).delete()
    await TrainingCard.find(TrainingCard.user_id == current_user.id).delete()
    await current_user.delete()
    return Response(status_code=204)
