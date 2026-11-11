from datetime import timedelta

from fastapi import Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import new_token, token_digest
from app.core.timeutil import utcnow
from app.models import AuthSession, User


def public_user(user: User) -> dict:
    return {
        "id": user.id,
        "code": user.code,
        "name": user.name,
        "role": user.role,
        "email": user.email,
    }


def create_session(db: Session, user: User, remember: bool) -> tuple[str, AuthSession]:
    token = new_token()
    csrf_token = new_token()
    lifetime = timedelta(days=settings.remember_days) if remember else timedelta(hours=settings.session_hours)
    session = AuthSession(
        token_hash=token_digest(token),
        csrf_token=csrf_token,
        user_id=user.id,
        expires_at=utcnow() + lifetime,
        last_seen_at=utcnow(),
    )
    db.add(session)
    db.query(AuthSession).filter(AuthSession.expires_at <= utcnow()).delete(synchronize_session=False)
    db.commit()
    return token, session


def session_payload(user: User, session: AuthSession) -> dict:
    return {
        "user": public_user(user),
        "csrf_token": session.csrf_token,
        "expires_at": session.expires_at.isoformat() + "Z",
    }


def set_session_cookie(response: Response, request: Request, token: str, remember: bool) -> None:
    secure = settings.environment.lower() in ("production", "staging") or request.url.scheme == "https"
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
        max_age=settings.remember_days * 24 * 3600 if remember else None,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=settings.session_cookie_name, path="/", samesite="lax")


def current_session(db: Session, request: Request) -> AuthSession | None:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    session = (
        db.query(AuthSession)
        .filter(AuthSession.token_hash == token_digest(token), AuthSession.expires_at > utcnow())
        .first()
    )
    return session
