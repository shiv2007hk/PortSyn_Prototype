from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutil import utcnow


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True)
    token_hash = Column(String(64), unique=True, nullable=False)
    csrf_token = Column(String(64), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    last_seen_at = Column(DateTime, default=utcnow, nullable=False)

    user = relationship("User", lazy="joined")
