from sqlalchemy import JSON, Column, DateTime, Integer, String, Text

from app.core.database import Base
from app.core.timeutil import utcnow


class OperationalEvent(Base):
    __tablename__ = "operational_events"

    id = Column(Integer, primary_key=True)
    type = Column(String(40), nullable=False, index=True)
    severity = Column(String(12), nullable=False, default="info", index=True)
    title = Column(String(160), nullable=False)
    message = Column(Text, nullable=False)
    entity_type = Column(String(24), nullable=True)
    entity_code = Column(String(24), nullable=True, index=True)
    payload = Column(JSON, nullable=True)
    ts = Column(DateTime, default=utcnow, nullable=False, index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    actor = Column(String(60), nullable=False, default="demo-supervisor")
    action = Column(String(60), nullable=False, index=True)
    entity_type = Column(String(24), nullable=False)
    entity_code = Column(String(40), nullable=False)
    detail = Column(Text, nullable=True)
    ts = Column(DateTime, default=utcnow, nullable=False, index=True)
