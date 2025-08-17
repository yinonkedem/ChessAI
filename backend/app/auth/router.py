# app/auth/router.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select   # ✅ import select

from app.db import get_session
from .models import User
from .utils import authenticate_user, create_access_token, get_password_hash
from .dependencies import get_current_active_user

router = APIRouter(prefix="/auth", tags=["auth"])

class SignupBody(BaseModel):
    username: str
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    disabled: bool

@router.post("/signup", response_model=UserOut, status_code=201)
def signup(body: SignupBody, session: Session = Depends(get_session)):
    # ✅ SQLModel/SA 2.0 style
    if session.exec(select(User).where(User.username == body.username)).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    if session.exec(select(User).where(User.email == body.email)).first():
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=get_password_hash(body.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserOut(id=user.id, username=user.username, email=user.email, disabled=user.disabled)

@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = authenticate_user(session, form.username, form.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect username or password",
                            headers={"WWW-Authenticate": "Bearer"})
    token = create_access_token({"sub": user.username})
    return TokenOut(access_token=token)

@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_active_user)):
    return UserOut(id=current_user.id, username=current_user.username,
                   email=current_user.email, disabled=current_user.disabled)
