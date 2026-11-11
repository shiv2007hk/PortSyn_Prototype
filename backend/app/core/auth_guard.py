import hmac

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import token_digest
from app.core.timeutil import utcnow
from app.models import AuthSession

PUBLIC_API_PATHS = (
    "/api/health",
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/session-policy",
    "/api/public/",
)
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _is_public(path: str) -> bool:
    if path in ("/api", "/api/"):
        return True
    return any(path == prefix.rstrip("/") or path.startswith(prefix) for prefix in PUBLIC_API_PATHS)


def _json(status: int, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail})


class AuthGuardMiddleware(BaseHTTPMiddleware):
    """Session enforcement, CSRF verification and read-only viewer enforcement."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        request.state.user = None
        request.state.session = None

        if request.method == "OPTIONS" or not path.startswith("/api"):
            return await call_next(request)

        token = request.cookies.get(settings.session_cookie_name)
        if token:
            db = SessionLocal()
            try:
                session = (
                    db.query(AuthSession)
                    .filter(AuthSession.token_hash == token_digest(token), AuthSession.expires_at > utcnow())
                    .first()
                )
                if session is not None:
                    request.state.user = session.user
                    request.state.session = session
                    if session.last_seen_at is None or (utcnow() - session.last_seen_at).total_seconds() > 300:
                        session.last_seen_at = utcnow()
                        db.commit()
            finally:
                db.close()

        if _is_public(path):
            return await call_next(request)

        user = request.state.user
        session = request.state.session
        if user is None or session is None:
            return _json(401, "Authentication required. Sign in to continue.")

        if request.method not in SAFE_METHODS:
            supplied = request.headers.get(settings.csrf_header, "")
            if not supplied or not hmac.compare_digest(supplied, session.csrf_token):
                return _json(403, "CSRF verification failed. Refresh the page and try again.")
            if user.role == "viewer" and path != "/api/auth/logout":
                return _json(403, "Your account has read-only access. Ask a supervisor for operator permissions.")

        return await call_next(request)
