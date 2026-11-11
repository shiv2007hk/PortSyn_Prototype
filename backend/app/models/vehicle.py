from sqlalchemy import CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutil import utcnow


class Vehicle(Base):
    __tablename__ = "vehicles"
    __table_args__ = (
        CheckConstraint(
            "status IN ('available','assigned','in_transit','idle','maintenance','fault')",
            name="ck_vehicle_status",
        ),
    )

    id = Column(Integer, primary_key=True)
    code = Column(String(12), unique=True, nullable=False, index=True)
    capacity_t = Column(Float, nullable=False, default=32.0)
    fuel = Column(Float, nullable=False, default=80.0)
    health = Column(Float, nullable=False, default=90.0)
    status = Column(String(20), nullable=False, default="available", index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    current_task = Column(String(140), nullable=True)
    x = Column(Float, nullable=False, default=0)
    y = Column(Float, nullable=False, default=0)
    route_key = Column(String(20), nullable=True)
    route_phase = Column(Float, nullable=False, default=0.0)
    odometer_km = Column(Float, nullable=False, default=0.0)
    total_trips = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    driver = relationship("Driver")
