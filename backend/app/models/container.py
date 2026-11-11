from sqlalchemy import CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutil import utcnow


class Container(Base):
    __tablename__ = "containers"
    __table_args__ = (
        CheckConstraint(
            "status IN ('waiting','allocated','loading','in_transit','at_yard','ready_for_dispatch','delivered')",
            name="ck_container_status",
        ),
    )

    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    ship_id = Column(Integer, ForeignKey("ships.id"), nullable=True, index=True)
    cargo_type = Column(String(40), nullable=False, default="general")
    priority = Column(String(12), nullable=False, default="normal", index=True)
    status = Column(String(24), nullable=False, default="waiting", index=True)
    location = Column(String(80), nullable=False, default="Vessel hold")
    destination = Column(String(100), nullable=False, default="Inland DC")
    weight_t = Column(Float, nullable=False, default=18.0)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True, index=True)
    crane_id = Column(Integer, ForeignKey("cranes.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    dispatched_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False, index=True)

    ship = relationship("Ship", back_populates="containers")
    warehouse = relationship("Warehouse", back_populates="containers")
    crane = relationship("Crane")
    vehicle = relationship("Vehicle")
    history = relationship("ContainerEvent", back_populates="container", order_by="ContainerEvent.ts")


class ContainerEvent(Base):
    __tablename__ = "container_events"

    id = Column(Integer, primary_key=True)
    container_id = Column(Integer, ForeignKey("containers.id"), nullable=False, index=True)
    from_status = Column(String(24), nullable=True)
    to_status = Column(String(24), nullable=False)
    note = Column(Text, nullable=True)
    actor = Column(String(60), nullable=False, default="system")
    ts = Column(DateTime, default=utcnow, nullable=False, index=True)

    container = relationship("Container", back_populates="history")
