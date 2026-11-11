from sqlalchemy import CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timeutil import utcnow


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        CheckConstraint("status IN ('active','released')", name="ck_assignment_status"),
    )

    id = Column(Integer, primary_key=True)
    kind = Column(String(20), nullable=False, index=True)
    resource_code = Column(String(20), nullable=False, index=True)
    resource_id = Column(Integer, nullable=True)
    ship_id = Column(Integer, ForeignKey("ships.id"), nullable=True, index=True)
    container_id = Column(Integer, ForeignKey("containers.id"), nullable=True)
    score = Column(Float, nullable=False, default=0.0)
    source = Column(String(20), nullable=False, default="optimizer")
    explanation = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active", index=True)
    created_by = Column(String(60), nullable=False, default="demo-supervisor")
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    released_at = Column(DateTime, nullable=True)

    ship = relationship("Ship")
