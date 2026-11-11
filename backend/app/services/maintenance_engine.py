"""Rule-based maintenance risk and operational alert detection.

The risk index is an advisory score derived from asset health, utilisation,
fuel level and maintenance age. It is not a trained failure-prediction model
and the UI labels it accordingly.
"""

from datetime import timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.timeutil import utcnow
from app.models import (
    Alert,
    Container,
    Crane,
    Dispatch,
    Dock,
    Driver,
    MaintenanceTask,
    Ship,
    Vehicle,
    Warehouse,
)
from app.services.common import create_alert_once, record_audit, record_event
from app.services.serializers import maintenance_out


def _level(risk: int) -> str:
    if risk >= 70:
        return "critical"
    if risk >= 45:
        return "warning"
    return "normal"


def crane_risk(crane: Crane) -> dict[str, Any]:
    days = (utcnow() - crane.last_maintenance).days if crane.last_maintenance else 120
    health_gap = max(0.0, 100 - crane.health)
    vibration = round(health_gap * 0.55 + crane.utilization * 0.22 + (crane.moves_total % 11) * 0.4, 1)
    risk = min(
        100,
        int(
            health_gap * 0.55
            + crane.utilization * 0.22
            + min(20, max(0, days - 30) * 0.8)
            + (10 if vibration > 40 else 0)
        ),
    )
    factors = [
        {"label": "Health", "value": f"{crane.health:.0f}%", "detail": "Asset health score"},
        {"label": "Utilisation", "value": f"{crane.utilization:.0f}%", "detail": "Share of recent operating hours"},
        {"label": "Maintenance age", "value": f"{days} d", "detail": "Days since last service"},
        {"label": "Vibration index", "value": f"{vibration}", "detail": "Simulated trend proxy (not sensor data)"},
    ]
    return {
        "equipment_type": "crane",
        "code": crane.code,
        "name": f"{crane.crane_type} crane · {crane.dock.code if crane.dock else 'unassigned'}",
        "risk_score": risk,
        "level": _level(risk),
        "factors": factors,
        "health": round(crane.health, 1),
        "utilization": round(crane.utilization, 1),
        "days_since_service": days,
        "status": crane.status,
        "recommendation": (
            "Remove from new allocations and schedule service"
            if risk >= 70
            else "Plan service window within 7 days"
            if risk >= 45
            else "No immediate action"
        ),
        "disclaimer": "Rule-based advisory indicator from health, utilisation and service age — not a failure prediction.",
    }


def vehicle_risk(vehicle: Vehicle) -> dict[str, Any]:
    days = (utcnow() - vehicle.created_at).days if vehicle.created_at else 90
    health_gap = max(0.0, 100 - vehicle.health)
    usage = min(100.0, vehicle.total_trips * 1.8)
    risk = min(
        100,
        int(
            health_gap * 0.60
            + usage * 0.18
            + (14 if vehicle.fuel < 20 else 0)
            + (12 if days > 60 else 0)
            + (20 if vehicle.status == "fault" else 0)
        ),
    )
    factors = [
        {"label": "Health", "value": f"{vehicle.health:.0f}%", "detail": "Asset health score"},
        {"label": "Fuel", "value": f"{vehicle.fuel:.0f}%", "detail": "Current tank level"},
        {"label": "Trips", "value": f"{vehicle.total_trips}", "detail": "Lifetime terminal trips"},
        {"label": "Vibration index", "value": f"{round(health_gap * 0.6 + usage * 0.25, 1)}", "detail": "Simulated trend proxy"},
    ]
    return {
        "equipment_type": "vehicle",
        "code": vehicle.code,
        "name": f"Terminal tractor · {vehicle.driver.name if vehicle.driver else 'unassigned'}",
        "risk_score": risk,
        "level": _level(risk),
        "factors": factors,
        "health": round(vehicle.health, 1),
        "utilization": round(usage, 1),
        "days_since_service": days,
        "status": vehicle.status,
        "recommendation": (
            "Ground the unit and dispatch maintenance"
            if risk >= 70
            else "Inspect at next idle window"
            if risk >= 45
            else "No immediate action"
        ),
        "disclaimer": "Rule-based advisory indicator from health, usage and fuel — not a failure prediction.",
    }


def risk_register(db: Session) -> list[dict[str, Any]]:
    rows = [crane_risk(c) for c in db.query(Crane).all()]
    rows += [vehicle_risk(v) for v in db.query(Vehicle).all()]
    rows.sort(key=lambda r: r["risk_score"], reverse=True)
    return rows


def scan_operational_alerts(db: Session) -> list[Alert]:
    created: list[Alert] = []
    now = utcnow()

    def add(**kwargs) -> None:
        alert = create_alert_once(db, **kwargs)
        if alert:
            created.append(alert)

    vehicles = db.query(Vehicle).all()
    for vehicle in vehicles:
        if vehicle.fuel < 10:
            add(
                severity="critical",
                category="low_fuel",
                title=f"{vehicle.code} fuel critically low",
                message=f"Fuel at {vehicle.fuel:.0f}%. Refuel before dispatch; the 20% floor blocks allocation.",
                entity_type="vehicle",
                entity_code=vehicle.code,
            )
        elif vehicle.fuel < 20:
            add(
                severity="warning",
                category="low_fuel",
                title=f"{vehicle.code} low fuel",
                message=f"Fuel at {vehicle.fuel:.0f}%, below the 20% dispatch floor.",
                entity_type="vehicle",
                entity_code=vehicle.code,
            )
        if vehicle.status == "fault":
            add(
                severity="critical",
                category="truck_breakdown",
                title=f"{vehicle.code} reported a fault",
                message="Vehicle is withdrawn from allocation until maintenance clears the fault.",
                entity_type="vehicle",
                entity_code=vehicle.code,
            )

    for crane in db.query(Crane).all():
        risk = crane_risk(crane)
        if risk["risk_score"] >= 70:
            add(
                severity="critical",
                category="equipment_risk",
                title=f"{crane.code} maintenance risk {risk['risk_score']}/100",
                message=risk["recommendation"] + " Rule-based health indicator, not a failure prediction.",
                entity_type="crane",
                entity_code=crane.code,
            )
        elif risk["risk_score"] >= 45:
            add(
                severity="warning",
                category="equipment_risk",
                title=f"{crane.code} service window suggested",
                message=risk["recommendation"] + " Rule-based health indicator, not a failure prediction.",
                entity_type="crane",
                entity_code=crane.code,
            )
        if crane.health < 55:
            add(
                severity="warning",
                category="equipment_health",
                title=f"{crane.code} health below 55%",
                message=f"Crane health {crane.health:.0f}%. Track for maintenance planning.",
                entity_type="crane",
                entity_code=crane.code,
            )

    for wh in db.query(Warehouse).all():
        if wh.utilization >= 95:
            add(
                severity="critical",
                category="warehouse_capacity",
                title=f"{wh.code} storage near saturation",
                message=f"{wh.occupancy}/{wh.capacity_teu} TEU used ({wh.utilization}%). Divert incoming cargo.",
                entity_type="warehouse",
                entity_code=wh.code,
            )
        elif wh.utilization >= wh.threshold:
            add(
                severity="warning",
                category="warehouse_capacity",
                title=f"{wh.code} above capacity threshold",
                message=f"{wh.utilization}% used, threshold {wh.threshold}%. Plan dispatch to free capacity.",
                entity_type="warehouse",
                entity_code=wh.code,
            )

    queue = db.query(Container).filter(Container.status.in_(["waiting", "allocated"])).all()
    old_queue = [c for c in queue if c.created_at and (now - c.created_at) > timedelta(hours=24)]
    if old_queue:
        severe = len(old_queue) >= 15
        add(
            severity="critical" if severe else "warning",
            category="container_backlog",
            title=f"{len(old_queue)} container(s) waiting over 24 h",
            message=f"{len(queue)} container(s) in the queue; {len(old_queue)} exceed the 24 h service target.",
            entity_type="container",
            entity_code=None,
        )

    docks = db.query(Dock).all()
    usable = [d for d in docks if d.status != "maintenance"]
    occupied = [d for d in usable if d.status == "occupied"]
    ratio = len(occupied) / len(usable) if usable else 1
    if ratio >= 0.75:
        add(
            severity="critical" if ratio >= 1 else "warning",
            category="dock_congestion",
            title="Berth congestion elevated",
            message=f"{len(occupied)}/{len(usable)} usable berths occupied ({round(ratio * 100)}%).",
            entity_type="dock",
            entity_code=None,
        )

    on_duty = db.query(Driver).filter(Driver.duty_status == "on_duty").count()
    if on_duty < 4:
        add(
            severity="warning",
            category="driver_shortage",
            title="Driver pool thin",
            message=f"Only {on_duty} driver(s) on duty. Dispatch options may be constrained.",
            entity_type="driver",
            entity_code=None,
        )

    for ship in db.query(Ship).filter(Ship.status.in_(["approaching", "arrived", "waiting"])).all():
        if ship.eta < now - timedelta(hours=1):
            add(
                severity="warning",
                category="ship_delay",
                title=f"{ship.code} awaiting berth",
                message=f"ETA passed {abs(round((now - ship.eta).total_seconds() / 3600, 1))} h ago; vessel is {ship.status}.",
                entity_type="ship",
                entity_code=ship.code,
            )
        elif ship.status == "approaching" and timedelta(0) <= (ship.eta - now) <= timedelta(hours=2):
            add(
                severity="info",
                category="ship_arrival",
                title=f"{ship.code} arriving within 2 h",
                message=f"{ship.name} ETA {ship.eta.strftime('%d %b %H:%M')} UTC · {ship.cargo_qty} TEU · {ship.priority} priority.",
                entity_type="ship",
                entity_code=ship.code,
            )

    for dispatch in db.query(Dispatch).filter(Dispatch.status.in_(["pending", "scheduled"])).all():
        if dispatch.scheduled_departure < now:
            delay = round((now - dispatch.scheduled_departure).total_seconds() / 3600, 1)
            add(
                severity="warning" if dispatch.status == "scheduled" else "critical",
                category="dispatch_delay",
                title=f"{dispatch.code} departure overdue",
                message=f"{dispatch.code} to {dispatch.destination} is {delay} h late ({dispatch.status}).",
                entity_type="dispatch",
                entity_code=dispatch.code,
            )

    for task in db.query(MaintenanceTask).filter(MaintenanceTask.status == "scheduled").all():
        if task.scheduled_for and task.scheduled_for < now:
            add(
                severity="warning",
                category="maintenance_overdue",
                title=f"{task.code} maintenance overdue",
                message=f"{task.equipment_code} service was scheduled for {task.scheduled_for.strftime('%d %b %H:%M')} UTC.",
                entity_type=task.equipment_type,
                entity_code=task.equipment_code,
            )

    db.commit()
    return created


def create_maintenance_task(
    db: Session,
    equipment_type: str,
    equipment_code: str,
    actor: str,
    reason: str | None = None,
    scheduled_for=None,
    notes: str | None = None,
) -> MaintenanceTask:
    from app.services.allocation_engine import AllocationError

    if equipment_type == "crane":
        equipment = db.query(Crane).filter(Crane.code == equipment_code).first()
        if not equipment:
            raise AllocationError(f"Crane {equipment_code} not found")
        risk = crane_risk(equipment)
    elif equipment_type == "vehicle":
        equipment = db.query(Vehicle).filter(Vehicle.code == equipment_code).first()
        if not equipment:
            raise AllocationError(f"Vehicle {equipment_code} not found")
        risk = vehicle_risk(equipment)
    else:
        raise AllocationError("equipment_type must be crane or vehicle")

    rows = db.query(MaintenanceTask.code).all()
    numbers = [int(r.code.split("-")[-1]) for r in rows if r.code.split("-")[-1].isdigit()]
    task = MaintenanceTask(
        code=f"MNT-{max(numbers + [100]) + 1:04d}",
        equipment_type=equipment_type,
        equipment_code=equipment_code,
        reason=reason or risk["recommendation"],
        risk_score=risk["risk_score"],
        status="scheduled",
        scheduled_for=scheduled_for or (utcnow() + timedelta(days=1)),
        notes=notes or risk["disclaimer"],
    )
    db.add(task)
    equipment.status = "maintenance"
    from app.models import Assignment

    for assignment in (
        db.query(Assignment)
        .filter(
            Assignment.resource_code == equipment_code,
            Assignment.kind == ("crane" if equipment_type == "crane" else "vehicle"),
            Assignment.status == "active",
        )
        .all()
    ):
        assignment.status = "released"
        assignment.released_at = utcnow()
    record_audit(
        db,
        actor=actor,
        action="maintenance_scheduled",
        entity_type=equipment_type,
        entity_code=equipment_code,
        detail=f"{task.code} · risk {task.risk_score}",
    )
    event = record_event(
        db,
        type="maintenance_scheduled",
        severity="warning",
        title=f"{equipment_code} maintenance scheduled",
        message=f"{equipment_code} removed from allocation. {task.reason}",
        entity_type=equipment_type,
        entity_code=equipment_code,
        payload={"task": task.code, "risk": task.risk_score},
    )
    db.commit()
    db.refresh(task)
    return task, event


def update_task_status(db: Session, task: MaintenanceTask, target: str, actor: str) -> MaintenanceTask:
    from app.services.allocation_engine import AllocationError

    if target not in ("scheduled", "in_progress", "completed"):
        raise AllocationError("Invalid maintenance status")
    if target == "completed":
        task.completed_at = utcnow()
        if task.equipment_type == "crane":
            crane = db.query(Crane).filter(Crane.code == task.equipment_code).first()
            if crane:
                crane.health = min(100.0, crane.health + 8)
                crane.last_maintenance = utcnow()
                if crane.status == "maintenance":
                    crane.status = "idle"
        else:
            vehicle = db.query(Vehicle).filter(Vehicle.code == task.equipment_code).first()
            if vehicle:
                vehicle.health = min(100.0, vehicle.health + 8)
                if vehicle.status in ("maintenance", "fault"):
                    vehicle.status = "available"
        for alert in (
            db.query(Alert)
            .filter(
                Alert.entity_code == task.equipment_code,
                Alert.category.in_(["equipment_risk", "maintenance_overdue", "equipment_health"]),
                Alert.status.in_(["active", "acknowledged"]),
            )
            .all()
        ):
            alert.status = "resolved"
            alert.resolved_at = utcnow()
        db.add(
            record_event(
                db,
                type="maintenance_completed",
                title=f"{task.equipment_code} maintenance completed",
                message=f"{task.code} closed. Asset returned to the ready pool.",
                entity_type=task.equipment_type,
                entity_code=task.equipment_code,
            )
        )
    task.status = target
    record_audit(
        db,
        actor=actor,
        action=f"maintenance_{target}",
        entity_type=task.equipment_type,
        entity_code=task.equipment_code,
        detail=task.code,
    )
    db.commit()
    db.refresh(task)
    return task


def maintenance_overview(db: Session) -> dict[str, Any]:
    risks = risk_register(db)
    tasks = db.query(MaintenanceTask).order_by(MaintenanceTask.created_at.desc()).all()
    return {
        "risks": risks,
        "tasks": [maintenance_out(t) for t in tasks],
        "summary": {
            "critical": sum(1 for r in risks if r["level"] == "critical"),
            "warning": sum(1 for r in risks if r["level"] == "warning"),
            "normal": sum(1 for r in risks if r["level"] == "normal"),
            "open_tasks": sum(1 for t in tasks if t.status != "completed"),
        },
        "disclaimer": "Risk scores are rule-based advisory indicators derived from health, utilisation and service age. They are not validated mechanical failure predictions.",
    }
