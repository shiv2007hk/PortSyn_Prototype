from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutil import utcnow


class Dock(Base):
    __tablename__ = "docks"
    __table_args__ = (
        CheckConstraint("status IN ('available','occupied','maintenance')", name="ck_dock_status"),
    )

    id = Column(Integer, primary_key=True)
    code = Column(String(12), unique=True, nullable=False, index=True)
    name = Column(String(80), nullable=False)
    capacity_teu = Column(Integer, nullable=False, default=4500)
    max_length_m = Column(Integer, nullable=False, default=366)
    max_draft_m = Column(Float, nullable=False, default=15.5)
    allowed_cargo = Column(String(200), nullable=False, default="general,reefer,hazardous,bulk")
    status = Column(String(20), nullable=False, default="available", index=True)
    maintenance_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    current_ship = relationship("Ship", back_populates="dock", uselist=False)
    cranes = relationship("Crane", back_populates="dock")
