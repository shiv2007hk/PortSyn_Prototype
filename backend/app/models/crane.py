from sqlalchemy import CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutil import utcnow


class Crane(Base):
    __tablename__ = "cranes"
    __table_args__ = (
        CheckConstraint("status IN ('idle','active','maintenance','fault')", name="ck_crane_status"),
    )

    id = Column(Integer, primary_key=True)
    code = Column(String(12), unique=True, nullable=False, index=True)
    crane_type = Column(String(12), nullable=False, default="STS")
    capacity_t = Column(Float, nullable=False, default=40.0)
    health = Column(Float, nullable=False, default=90.0)
    utilization = Column(Float, nullable=False, default=0.0)
    status = Column(String(20), nullable=False, default="idle", index=True)
    dock_id = Column(Integer, ForeignKey("docks.id"), nullable=True, index=True)
    x = Column(Float, nullable=False, default=0)
    y = Column(Float, nullable=False, default=0)
    moves_total = Column(Integer, nullable=False, default=0)
    last_maintenance = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    dock = relationship("Dock", back_populates="cranes")
