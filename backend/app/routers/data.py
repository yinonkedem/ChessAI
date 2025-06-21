from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from ..db import get_session
from ..models import TrainingSample
from ..core.security import decode_access_token

router = APIRouter(prefix="/data", tags=["data"])

def get_current_user(token: str = Depends(lambda x: x.headers.get("Authorization"))):
    if not token or not token.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    payload = decode_access_token(token.split()[1])
    if payload is None:
        raise HTTPException(401, "Invalid token")
    return int(payload["sub"])

@router.post("/sample", status_code=status.HTTP_201_CREATED)
def save_sample(sample: TrainingSample,
                user_id: int = Depends(get_current_user),
                session: Session = Depends(get_session)):
    sample.owner_id = user_id
    session.add(sample)
    session.commit()
    return {"ok": True}
