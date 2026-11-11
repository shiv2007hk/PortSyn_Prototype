from sqlalchemy import CheckConstraint, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutil import utcnow


class Warehouse(Base):
    __tablename__ = "warehouses"
    __table_args__ = (
        CheckConstraint("status IN ('operational','restricted','maintenance')", name="ck_warehouse_status"),
    )

    id = Column(Integer, primary_key=True)
    code = Column(String(12), unique=True, nullable=False, index=True)
    name = Column(String(80), nullable=False)
    zone = Column(String(40), nullable=False, default="Zone A")
    capacity_teu = Column(Integer, nullable=False, default=1200)
    occupancy = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="operational", index=True)
    threshold = Column(Float, nullable=False, default=85.0)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    containers = relationship("Container", back_populates="warehouse")

    @property
    def available(self) -> int:
        return max(self.capacity_teu - self.occupancy, 0)

    @property
    def utilization(self) -> float:
        return round(self.occupancy / self.capacity_teu * 100, 1) if self.capacity_teu else 0.0
