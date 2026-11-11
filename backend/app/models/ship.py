from sqlalchemy import CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutil import utcnow


class Ship(Base):
    __tablename__ = "ships"
    __table_args__ = (
        CheckConstraint("status IN ('approaching','arrived','waiting','docked','unloading','departed')", name="ck_ship_status"),
        CheckConstraint("priority IN ('low','normal','high','critical')", name="ck_ship_priority"),
    )

    id = Column(Integer, primary_key=True)
    code = Column(String(16), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    cargo_type = Column(String(40), nullable=False, default="general")
    cargo_qty = Column(Integer, nullable=False, default=0)
    priority = Column(String(12), nullable=False, default="normal", index=True)
    eta = Column(DateTime, nullable=False)
    arrived_at = Column(DateTime, nullable=True)
    departed_at = Column(DateTime, nullable=True)
    vessel_length_m = Column(Integer, nullable=False, default=280)
    draft_m = Column(Float, nullable=False, default=12.5)
    handling_hours = Column(Float, nullable=False, default=6.0)
    status = Column(String(20), nullable=False, default="approaching", index=True)
    dock_id = Column(Integer, ForeignKey("docks.id"), nullable=True, index=True)
    handling_progress = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    dock = relationship("Dock", back_populates="current_ship")
    containers = relationship("Container", back_populates="ship")
