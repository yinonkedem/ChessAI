from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from typing import List

from .config import USERS_DB
from .schemas import Token, User, Item
from .utils import authenticate_user, create_access_token, init_dummy_user
from .dependencies import get_current_active_user

router = APIRouter(prefix="/auth", tags=["auth"])

init_dummy_user()  # seed demo user once 🤫

@router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(USERS_DB, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=User)
async def read_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.get("/me/items", response_model=list[Item])
async def read_my_items(
        current_user: User = Depends(get_current_active_user),
):
    return [Item(item_id=1, owner=current_user)]
