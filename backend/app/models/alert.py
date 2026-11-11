from sqlalchemy import CheckConstraint, Column, DateTime, Integer, String, Text

from app.core.database import Base
from app.core.timeutil import utcnow


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        CheckConstraint("severity IN ('critical','warning','info')", name="ck_alert_severity"),
        CheckConstraint("status IN ('active','acknowledged','resolved')", name="ck_alert_status"),
    )

    id = Column(Integer, primary_key=True)
    severity = Column(String(12), nullable=False, index=True)
    category = Column(String(40), nullable=False, index=True)
    title = Column(String(140), nullable=False)
    message = Column(Text, nullable=False)
    entity_type = Column(String(24), nullable=True)
    entity_code = Column(String(24), nullable=True, index=True)
    status = Column(String(16), nullable=False, default="active", index=True)
    source = Column(String(24), nullable=False, default="engine")
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"
    __table_args__ = (
        CheckConstraint("status IN ('scheduled','in_progress','completed')", name="ck_maintenance_status"),
        CheckConstraint("equipment_type IN ('crane','vehicle')", name="ck_maintenance_equipment"),
    )

    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True, nullable=False)
    equipment_type = Column(String(12), nullable=False, index=True)
    equipment_code = Column(String(20), nullable=False, index=True)
    reason = Column(String(200), nullable=False)
    risk_score = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="scheduled", index=True)
    scheduled_for = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
