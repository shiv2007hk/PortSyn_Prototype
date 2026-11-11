from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ContainerStatus = Literal[
    "waiting", "allocated", "loading", "in_transit", "at_yard", "ready_for_dispatch", "delivered"
]


class AllocationRecommendRequest(BaseModel):
    ship_code: str
    kind: Literal["dock", "resources", "full"] = "full"
    dock_code: str | None = None
    container_code: str | None = None


class AllocationDecisionRequest(BaseModel):
    ship_code: str
    dock_code: str | None = None
    crane_code: str | None = None
    truck_codes: list[str] = Field(default_factory=list, max_length=6)
    driver_codes: list[str] = Field(default_factory=list, max_length=6)
    warehouse_code: str | None = None
    score: float = Field(default=0, ge=0, le=100)
    source: Literal["optimizer", "override"] = "optimizer"
    explanation: str | None = Field(default=None, max_length=2000)
    reason: str | None = Field(default=None, max_length=2000)
    container_code: str | None = None


class ContainerStatusUpdate(BaseModel):
    target_status: ContainerStatus
    crane_code: str | None = None
    vehicle_code: str | None = None
    warehouse_code: str | None = None
    note: str | None = Field(default=None, max_length=300)


class WarehouseAssignRequest(BaseModel):
    warehouse_code: str
    container_codes: list[str] = Field(min_length=1, max_length=100)
    note: str | None = Field(default=None, max_length=300)


class WarehouseUpdate(BaseModel):
    status: Literal["operational", "restricted", "maintenance"] | None = None
    threshold: float | None = Field(default=None, ge=50, le=100)
    capacity_teu: int | None = Field(default=None, ge=1, le=20000)


class DispatchCreateRequest(BaseModel):
    mode: Literal["road", "rail"]
    destination: str = Field(min_length=2, max_length=120)
    container_codes: list[str] = Field(min_length=1, max_length=50)
    scheduled_departure: datetime | None = None
    carrier: str | None = Field(default=None, max_length=80)
    vehicle_code: str | None = None
    notes: str | None = Field(default=None, max_length=500)


class DispatchStatusUpdate(BaseModel):
    status: Literal["pending", "scheduled", "in_transit", "completed", "cancelled"]


class SimulationRunRequest(BaseModel):
    scenario_type: Literal["crane_failure", "sudden_ship", "truck_breakdown", "warehouse_shortage"]
    params: dict = Field(default_factory=dict)


class SimulationApplyRequest(BaseModel):
    scenario_id: int


class MaintenanceTaskCreate(BaseModel):
    equipment_type: Literal["crane", "vehicle"]
    equipment_code: str
    reason: str | None = Field(default=None, max_length=200)
    scheduled_for: datetime | None = None
    notes: str | None = Field(default=None, max_length=500)


class MaintenanceStatusUpdate(BaseModel):
    status: Literal["scheduled", "in_progress", "completed"]


class AlertStatusUpdate(BaseModel):
    note: str | None = Field(default=None, max_length=300)


class HealthWeightsUpdate(BaseModel):
    dock_congestion: float = Field(ge=0, le=1)
    resource_availability: float = Field(ge=0, le=1)
    equipment_health: float = Field(ge=0, le=1)
    container_backlog: float = Field(ge=0, le=1)
    dispatch_performance: float = Field(ge=0, le=1)


class SimClockUpdate(BaseModel):
    running: bool | None = None
    speed: float | None = Field(default=None, ge=0.25, le=3)


class AssistantMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class AssistantRequest(BaseModel):
    message: str = Field(min_length=2, max_length=1000)
    history: list[AssistantMessage] = Field(default_factory=list, max_length=20)


class ResetRequest(BaseModel):
    confirm: str
