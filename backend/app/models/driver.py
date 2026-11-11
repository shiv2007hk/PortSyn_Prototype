from sqlalchemy import CheckConstraint, Column, Float, Integer, String

from app.core.database import Base
from app.core.timeutil import utcnow
from sqlalchemy import DateTime


class Driver(Base):
    __tablename__ = "drivers"
    __table_args__ = (
        CheckConstraint("duty_status IN ('on_duty','off_duty','on_break')", name="ck_driver_duty"),
    )

    id = Column(Integer, primary_key=True)
    code = Column(String(12), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    duty_status = Column(String(20), nullable=False, default="on_duty", index=True)
    shift = Column(String(30), nullable=False, default="Day 06:00-14:00")
    skills = Column(String(120), nullable=False, default="terminal-truck")
    workload = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=utcnow, nullable=False)
