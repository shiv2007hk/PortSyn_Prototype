from sqlalchemy import JSON, Column, DateTime, Integer, String

from app.core.database import Base
from app.core.timeutil import utcnow


class SimulationScenario(Base):
    __tablename__ = "simulation_scenarios"

    id = Column(Integer, primary_key=True)
    scenario_type = Column(String(32), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    params = Column(JSON, nullable=False, default=dict)
    status = Column(String(20), nullable=False, default="draft", index=True)
    result = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    applied_at = Column(DateTime, nullable=True)
