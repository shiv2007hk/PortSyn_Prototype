from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutil import utcnow


class Dispatch(Base):
    __tablename__ = "dispatches"
    __table_args__ = (
        CheckConstraint("mode IN ('road','rail')", name="ck_dispatch_mode"),
        CheckConstraint("status IN ('pending','scheduled','in_transit','completed','cancelled')", name="ck_dispatch_status"),
    )

    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    mode = Column(String(10), nullable=False, default="road")
    destination = Column(String(120), nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    scheduled_departure = Column(DateTime, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    carrier = Column(String(80), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    capacity_teu = Column(Integer, nullable=False, default=2)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)

    items = relationship("DispatchItem", back_populates="dispatch", cascade="all, delete-orphan")
    vehicle = relationship("Vehicle")


class DispatchItem(Base):
    __tablename__ = "dispatch_items"

    id = Column(Integer, primary_key=True)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id"), nullable=False, index=True)
    container_id = Column(Integer, ForeignKey("containers.id"), nullable=False, index=True)

    dispatch = relationship("Dispatch", back_populates="items")
    container = relationship("Container")
