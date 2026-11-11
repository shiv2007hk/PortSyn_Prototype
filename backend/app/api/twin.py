from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import digital_twin

router = APIRouter(prefix="/twin", tags=["digital-twin"])


@router.get("")
def twin_state(db: Session = Depends(get_db)):
    return digital_twin.state(db)
