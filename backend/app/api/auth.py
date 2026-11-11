from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password, password_issues, verify_password
from app.models import AuthSession, User
from app.schemas import LoginRequest, SignupRequest
from app.services.auth_service import (
    clear_session_cookie,
    create_session,
    public_user,
    session_payload,
    set_session_cookie,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _next_user_code(db: Session) -> str:
    highest = db.query(func.max(User.id)).scalar() or 0
    return f"USR-{highest + 1:02d}"


@router.post("/login")
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    token, session = create_session(db, user, payload.remember)
    set_session_cookie(response, request, token, payload.remember)
    return session_payload(user, session)


@router.post("/signup", status_code=201)
def signup(payload: SignupRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    issues = password_issues(payload.password)
    if issues:
        raise HTTPException(status_code=422, detail=" ".join(issues))
    existing = db.query(User).filter(func.lower(User.email) == payload.email).first()
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user = User(
        code=_next_user_code(db),
        name=payload.name,
        email=payload.email,
        role="viewer",
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token, session = create_session(db, user, remember=False)
    set_session_cookie(response, request, token, remember=False)
    return session_payload(user, session)


@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    user = request.state.user
    session = request.state.session
    if user is None or session is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session_payload(user, session)


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    session = request.state.session
    if session is not None:
        db.query(AuthSession).filter(AuthSession.id == session.id).delete(synchronize_session=False)
        db.commit()
    clear_session_cookie(response)
    return {"message": "Signed out", "read_only": True}


@router.get("/session-policy")
def session_policy():
    return {
        "session_hours": settings.session_hours,
        "remember_days": settings.remember_days,
        "min_password_length": 8,
        "signup_role": "viewer",
        "demo_users_seeded": settings.seed_demo_users,
    }
