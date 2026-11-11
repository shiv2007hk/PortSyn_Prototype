from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Priority = Literal["low", "normal", "high", "critical"]
CargoType = Literal["general", "reefer", "hazardous", "bulk"]


class ShipCreate(BaseModel):
    code: str | None = Field(default=None, pattern=r"^SH-\d{2,4}$")
    name: str = Field(min_length=2, max_length=100)
    cargo_type: CargoType = "general"
    cargo_qty: int = Field(ge=1, le=4000)
    priority: Priority = "normal"
    eta: datetime | None = None
    vessel_length_m: int = Field(default=280, ge=40, le=500)
    draft_m: float = Field(default=12.5, ge=2, le=25)
    handling_hours: float = Field(default=6.0, ge=0.5, le=72)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        return " ".join(value.split())


class ShipUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    cargo_type: CargoType | None = None
    cargo_qty: int | None = Field(default=None, ge=1, le=4000)
    priority: Priority | None = None
    eta: datetime | None = None
    handling_hours: float | None = Field(default=None, ge=0.5, le=72)


class DockUpdate(BaseModel):
    status: Literal["available", "occupied", "maintenance"] | None = None
    maintenance_until: datetime | None = None


class CraneCreate(BaseModel):
    code: str = Field(pattern=r"^CR-\d{2}$")
    crane_type: Literal["STS", "RTG", "MHC"] = "STS"
    capacity_t: float = Field(default=40, ge=5, le=120)
    health: float = Field(default=90, ge=0, le=100)
    status: Literal["idle", "active", "maintenance", "fault"] = "idle"
    dock_code: str | None = None


class CraneUpdate(BaseModel):
    crane_type: Literal["STS", "RTG", "MHC"] | None = None
    capacity_t: float | None = Field(default=None, ge=5, le=120)
    health: float | None = Field(default=None, ge=0, le=100)
    status: Literal["idle", "active", "maintenance", "fault"] | None = None
    dock_code: str | None = None


class VehicleCreate(BaseModel):
    code: str = Field(pattern=r"^TR-\d{2}$")
    capacity_t: float = Field(default=32, ge=5, le=80)
    fuel: float = Field(default=80, ge=0, le=100)
    health: float = Field(default=90, ge=0, le=100)
    status: Literal["available", "assigned", "in_transit", "idle", "maintenance", "fault"] = "available"
    driver_code: str | None = None


class VehicleUpdate(BaseModel):
    capacity_t: float | None = Field(default=None, ge=5, le=80)
    fuel: float | None = Field(default=None, ge=0, le=100)
    health: float | None = Field(default=None, ge=0, le=100)
    status: Literal["available", "assigned", "in_transit", "idle", "maintenance", "fault"] | None = None
    driver_code: str | None = None


class DriverCreate(BaseModel):
    code: str = Field(pattern=r"^DR-\d{2}$")
    name: str = Field(min_length=2, max_length=100)
    duty_status: Literal["on_duty", "off_duty", "on_break"] = "on_duty"
    shift: str = Field(default="Day 06:00-14:00", max_length=50)
    skills: str = Field(default="terminal-truck", max_length=120)
    workload: float = Field(default=0, ge=0, le=100)


class DriverUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    duty_status: Literal["on_duty", "off_duty", "on_break"] | None = None
    shift: str | None = Field(default=None, max_length=50)
    skills: str | None = Field(default=None, max_length=120)
    workload: float | None = Field(default=None, ge=0, le=100)
