from typing import Any

from app.models import (
    Alert,
    Assignment,
    Container,
    Crane,
    Dispatch,
    Dock,
    Driver,
    MaintenanceTask,
    OperationalEvent,
    Ship,
    Vehicle,
    Warehouse,
)


def iso(dt) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def dock_out(d: Dock) -> dict[str, Any]:
    ship = d.current_ship
    return {
        "id": d.id,
        "code": d.code,
        "name": d.name,
        "capacity_teu": d.capacity_teu,
        "max_length_m": d.max_length_m,
        "max_draft_m": d.max_draft_m,
        "allowed_cargo": [c for c in d.allowed_cargo.split(",") if c],
        "status": d.status,
        "maintenance_until": iso(d.maintenance_until),
        "ship": {
            "id": ship.id,
            "code": ship.code,
            "name": ship.name,
            "priority": ship.priority,
            "status": ship.status,
        }
        if ship and ship.status not in ("departed",)
        else None,
        "utilization": 100.0 if d.status == "occupied" else 0.0,
    }


def ship_out(s: Ship) -> dict[str, Any]:
    return {
        "id": s.id,
        "code": s.code,
        "name": s.name,
        "cargo_type": s.cargo_type,
        "cargo_qty": s.cargo_qty,
        "priority": s.priority,
        "eta": iso(s.eta),
        "arrived_at": iso(s.arrived_at),
        "departed_at": iso(s.departed_at),
        "handling_hours": s.handling_hours,
        "status": s.status,
        "dock_id": s.dock_id,
        "dock_code": s.dock.code if s.dock else None,
        "handling_progress": round(s.handling_progress, 1),
        "vessel_length_m": s.vessel_length_m,
        "draft_m": s.draft_m,
        "containers_total": len(s.containers) if s.containers is not None else 0,
        "created_at": iso(s.created_at),
        "updated_at": iso(s.updated_at),
    }


def crane_out(c: Crane) -> dict[str, Any]:
    return {
        "id": c.id,
        "code": c.code,
        "crane_type": c.crane_type,
        "capacity_t": c.capacity_t,
        "health": round(c.health, 1),
        "utilization": round(c.utilization, 1),
        "status": c.status,
        "dock_id": c.dock_id,
        "dock_code": c.dock.code if c.dock else None,
        "x": c.x,
        "y": c.y,
        "moves_total": c.moves_total,
        "last_maintenance": iso(c.last_maintenance),
    }


def driver_out(d: Driver, vehicle_code: str | None = None) -> dict[str, Any]:
    return {
        "id": d.id,
        "code": d.code,
        "name": d.name,
        "duty_status": d.duty_status,
        "shift": d.shift,
        "skills": [s for s in d.skills.split(",") if s],
        "workload": round(d.workload, 1),
        "vehicle_code": vehicle_code,
    }


def vehicle_out(v: Vehicle) -> dict[str, Any]:
    return {
        "id": v.id,
        "code": v.code,
        "capacity_t": v.capacity_t,
        "fuel": round(v.fuel, 1),
        "health": round(v.health, 1),
        "status": v.status,
        "driver_id": v.driver_id,
        "driver_code": v.driver.code if v.driver else None,
        "driver_name": v.driver.name if v.driver else None,
        "current_task": v.current_task,
        "x": v.x,
        "y": v.y,
        "route_key": v.route_key,
        "route_phase": round(v.route_phase, 3),
        "odometer_km": round(v.odometer_km, 1),
        "total_trips": v.total_trips,
    }


def warehouse_out(w: Warehouse) -> dict[str, Any]:
    return {
        "id": w.id,
        "code": w.code,
        "name": w.name,
        "zone": w.zone,
        "capacity_teu": w.capacity_teu,
        "occupancy": w.occupancy,
        "available": w.available,
        "utilization": w.utilization,
        "status": w.status,
        "threshold": w.threshold,
        "above_threshold": w.utilization >= w.threshold,
    }


def container_out(c: Container, include_ship: bool = True) -> dict[str, Any]:
    waiting_hours = None
    if c.status in ("waiting", "allocated") and c.created_at:
        from app.core.timeutil import utcnow

        waiting_hours = round((utcnow() - c.created_at).total_seconds() / 3600, 1)
    return {
        "id": c.id,
        "code": c.code,
        "ship_id": c.ship_id,
        "ship_code": c.ship.code if include_ship and c.ship else None,
        "cargo_type": c.cargo_type,
        "priority": c.priority,
        "status": c.status,
        "location": c.location,
        "destination": c.destination,
        "weight_t": c.weight_t,
        "warehouse_code": c.warehouse.code if c.warehouse else None,
        "crane_code": c.crane.code if c.crane else None,
        "vehicle_code": c.vehicle.code if c.vehicle else None,
        "dispatched_at": iso(c.dispatched_at),
        "created_at": iso(c.created_at),
        "updated_at": iso(c.updated_at),
        "waiting_hours": waiting_hours,
    }


def dispatch_out(d: Dispatch) -> dict[str, Any]:
    containers = [item.container for item in d.items if item.container]
    return {
        "id": d.id,
        "code": d.code,
        "mode": d.mode,
        "destination": d.destination,
        "status": d.status,
        "scheduled_departure": iso(d.scheduled_departure),
        "completed_at": iso(d.completed_at),
        "carrier": d.carrier,
        "vehicle_code": d.vehicle.code if d.vehicle else None,
        "capacity_teu": d.capacity_teu,
        "container_codes": [c.code for c in containers],
        "container_count": len(containers),
        "notes": d.notes,
        "created_at": iso(d.created_at),
    }


def alert_out(a: Alert) -> dict[str, Any]:
    return {
        "id": a.id,
        "severity": a.severity,
        "category": a.category,
        "title": a.title,
        "message": a.message,
        "entity_type": a.entity_type,
        "entity_code": a.entity_code,
        "status": a.status,
        "source": a.source,
        "created_at": iso(a.created_at),
        "acknowledged_at": iso(a.acknowledged_at),
        "resolved_at": iso(a.resolved_at),
    }


def maintenance_out(m: MaintenanceTask) -> dict[str, Any]:
    return {
        "id": m.id,
        "code": m.code,
        "equipment_type": m.equipment_type,
        "equipment_code": m.equipment_code,
        "reason": m.reason,
        "risk_score": m.risk_score,
        "status": m.status,
        "scheduled_for": iso(m.scheduled_for),
        "completed_at": iso(m.completed_at),
        "notes": m.notes,
        "created_at": iso(m.created_at),
    }


def event_out(e: OperationalEvent) -> dict[str, Any]:
    return {
        "id": e.id,
        "type": e.type,
        "severity": e.severity,
        "title": e.title,
        "message": e.message,
        "entity_type": e.entity_type,
        "entity_code": e.entity_code,
        "payload": e.payload,
        "ts": iso(e.ts),
    }


def assignment_out(a: Assignment) -> dict[str, Any]:
    return {
        "id": a.id,
        "kind": a.kind,
        "resource_code": a.resource_code,
        "ship_id": a.ship_id,
        "ship_code": a.ship.code if a.ship else None,
        "score": a.score,
        "source": a.source,
        "explanation": a.explanation,
        "status": a.status,
        "created_by": a.created_by,
        "created_at": iso(a.created_at),
        "released_at": iso(a.released_at),
    }
