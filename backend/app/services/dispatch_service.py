from datetime import timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.timeutil import utcnow
from app.models import Container, Dispatch, DispatchItem, Vehicle, Warehouse
from app.services.allocation_engine import AllocationError
from app.services.common import record_audit, record_event


FLOW = {
    "pending": ["scheduled", "cancelled"],
    "scheduled": ["in_transit", "cancelled"],
    "in_transit": ["completed"],
    "completed": [],
    "cancelled": [],
}


def next_dispatch_code(db: Session) -> str:
    rows = db.query(Dispatch.code).all()
    numbers = [int(r.code.split("-")[-1]) for r in rows if r.code.split("-")[-1].isdigit()]
    return f"DSP-{max(numbers + [1000]) + 1:04d}"


def create_dispatch(db: Session, payload, actor: str) -> tuple[Dispatch, Any]:
    codes = list(dict.fromkeys(payload.container_codes))
    if not codes:
        raise AllocationError("Select at least one container")
    containers = db.query(Container).filter(Container.code.in_(codes)).all()
    if len(containers) != len(codes):
        found = {c.code for c in containers}
        raise AllocationError(f"Unknown container(s): {', '.join(set(codes) - found)}")
    for container in containers:
        if container.status != "ready_for_dispatch":
            raise AllocationError(
                f"{container.code} is {container.status.replace('_', ' ')}; only ready-for-dispatch containers can leave"
            )
        active = (
            db.query(DispatchItem)
            .join(Dispatch, Dispatch.id == DispatchItem.dispatch_id)
            .filter(
                DispatchItem.container_id == container.id,
                Dispatch.status.in_(["pending", "scheduled", "in_transit"]),
            )
            .first()
        )
        if active:
            raise AllocationError(f"{container.code} is already on another active dispatch")

    total_weight = sum(c.weight_t for c in containers)
    vehicle = None
    if payload.vehicle_code:
        vehicle = db.query(Vehicle).filter(Vehicle.code == payload.vehicle_code).first()
        if not vehicle:
            raise AllocationError(f"Vehicle {payload.vehicle_code} not found")
        if vehicle.status not in ("available", "assigned"):
            raise AllocationError(f"{vehicle.code} is not available ({vehicle.status})")
        if vehicle.capacity_t < total_weight:
            raise AllocationError(
                f"Load {total_weight:.1f} t exceeds {vehicle.code} capacity {vehicle.capacity_t} t"
            )
        if not vehicle.driver or vehicle.driver.duty_status != "on_duty":
            raise AllocationError(f"{vehicle.code} requires an on-duty driver")
        if payload.mode == "rail":
            raise AllocationError("Rail dispatch does not use a terminal truck")
    elif payload.mode == "road":
        candidate = (
            db.query(Vehicle)
            .filter(Vehicle.status == "available", Vehicle.fuel >= 20, Vehicle.health >= 50)
            .order_by(Vehicle.fuel.desc())
            .first()
        )
        if not candidate:
            raise AllocationError("No road vehicle available for this dispatch")
        if candidate.capacity_t < total_weight:
            raise AllocationError(
                f"Best available truck {candidate.code} cannot carry {total_weight:.1f} t (max {candidate.capacity_t} t)"
            )
        vehicle = candidate

    departure = payload.scheduled_departure or (utcnow() + timedelta(hours=2))
    dispatch = Dispatch(
        code=next_dispatch_code(db),
        mode=payload.mode,
        destination=payload.destination,
        status="scheduled" if (vehicle or payload.mode == "rail") else "pending",
        scheduled_departure=departure,
        carrier=payload.carrier or ("Konkan Rail Freight" if payload.mode == "rail" else "PortSync Haulage"),
        vehicle_id=vehicle.id if vehicle else None,
        capacity_teu=len(containers) * 2,
        notes=payload.notes,
    )
    db.add(dispatch)
    db.flush()
    for container in containers:
        db.add(DispatchItem(dispatch_id=dispatch.id, container_id=container.id))
    if vehicle:
        vehicle.status = "assigned"
        vehicle.current_task = f"{dispatch.code} → {dispatch.destination}"
        vehicle.route_key = "gate"
        vehicle.route_phase = 0.02

    record_audit(
        db,
        actor=actor,
        action="dispatch_created",
        entity_type="dispatch",
        entity_code=dispatch.code,
        detail=f"{payload.mode} · {len(containers)} containers · {payload.destination}",
    )
    event = record_event(
        db,
        type="dispatch_created",
        title=f"{dispatch.code} planned · {payload.mode.title()}",
        message=(
            f"{len(containers)} container(s) staged for {payload.destination} "
            f"via {payload.mode}. Departure {departure.strftime('%d %b %H:%M')} UTC."
        ),
        entity_type="dispatch",
        entity_code=dispatch.code,
        payload={"containers": len(containers), "mode": payload.mode},
    )
    db.commit()
    db.refresh(dispatch)
    return dispatch, event


def update_dispatch_status(db: Session, dispatch: Dispatch, target: str, actor: str) -> Any:
    if target not in FLOW:
        raise AllocationError(f"Unknown dispatch status {target}")
    if target not in FLOW.get(dispatch.status, []):
        raise AllocationError(f"Invalid dispatch transition {dispatch.status} → {target}")
    previous = dispatch.status
    now = utcnow()

    if target == "cancelled":
        if dispatch.vehicle:
            dispatch.vehicle.status = "available"
            dispatch.vehicle.current_task = None
            dispatch.vehicle.route_key = None
    elif target == "in_transit":
        if dispatch.vehicle:
            dispatch.vehicle.status = "in_transit"
            dispatch.vehicle.route_key = "gate"
            dispatch.vehicle.route_phase = 0.1
    elif target == "completed":
        for item in dispatch.items:
            container = item.container
            if container is None or container.status == "delivered":
                continue
            if container.status != "ready_for_dispatch":
                raise AllocationError(
                    f"{container.code} is {container.status}; it must be ready for dispatch before delivery"
                )
            container.status = "delivered"
            container.dispatched_at = now
            container.location = f"Delivered · {dispatch.destination}"
            if container.warehouse_id:
                wh = db.get(Warehouse, container.warehouse_id)
                if wh:
                    wh.occupancy = max(0, wh.occupancy - 1)
            from app.models import ContainerEvent

            db.add(
                ContainerEvent(
                    container_id=container.id,
                    from_status="ready_for_dispatch",
                    to_status="delivered",
                    note=f"Delivered via {dispatch.code} ({dispatch.mode}) to {dispatch.destination}",
                    actor=actor,
                )
            )
        dispatch.completed_at = now
        if dispatch.vehicle:
            dispatch.vehicle.status = "available"
            dispatch.vehicle.current_task = None
            dispatch.vehicle.route_key = None
            dispatch.vehicle.route_phase = 0.0
            dispatch.vehicle.total_trips += 1
            dispatch.vehicle.odometer_km = round(dispatch.vehicle.odometer_km + 62.0, 1)
            dispatch.vehicle.fuel = max(0.0, round(dispatch.vehicle.fuel - 9.0, 1))

    dispatch.status = target
    record_audit(
        db,
        actor=actor,
        action=f"dispatch_{target}",
        entity_type="dispatch",
        entity_code=dispatch.code,
        detail=f"{previous} → {target}",
    )
    event = record_event(
        db,
        type=f"dispatch_{target}",
        severity="info",
        title=f"{dispatch.code} {target.replace('_', ' ')}",
        message=(
            f"{dispatch.code} ({dispatch.mode} · {dispatch.destination}) moved {previous} → {target}. "
            f"{len(dispatch.items)} container(s) on manifest."
        ),
        entity_type="dispatch",
        entity_code=dispatch.code,
        payload={"from": previous, "to": target},
    )
    db.commit()
    db.refresh(dispatch)
    return event
