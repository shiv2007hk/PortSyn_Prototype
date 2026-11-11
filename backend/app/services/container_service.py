from typing import Any

from sqlalchemy.orm import Session

from app.core.constants import CONTAINER_TRANSITIONS
from app.core.timeutil import utcnow
from app.models import Container, ContainerEvent, Crane, Vehicle, Warehouse
from app.services.common import record_audit, record_event
from app.services.allocation_engine import AllocationError


def _container_event(db: Session, container: Container, previous: str, note: str, actor: str) -> None:
    db.add(
        ContainerEvent(
            container_id=container.id,
            from_status=previous,
            to_status=container.status,
            note=note,
            actor=actor,
        )
    )


def _release_vehicle(db: Session, vehicle: Vehicle) -> None:
    remaining = (
        db.query(Container)
        .filter(Container.vehicle_id == vehicle.id, Container.status == "in_transit")
        .count()
    )
    if remaining == 0:
        vehicle.status = "available"
        vehicle.current_task = None
        vehicle.route_key = None
        vehicle.route_phase = 0.0
    vehicle.total_trips += 1
    vehicle.odometer_km = round(vehicle.odometer_km + 2.4, 1)
    vehicle.fuel = max(0.0, round(vehicle.fuel - 1.1, 1))


def assign_to_warehouse(db: Session, container: Container, warehouse: Warehouse, actor: str) -> None:
    if warehouse.status != "operational":
        raise AllocationError(f"{warehouse.code} is {warehouse.status}; storage is blocked")
    if warehouse.available <= 0:
        raise AllocationError(f"{warehouse.code} has no available capacity (hard constraint)")
    previous = container.status
    if container.warehouse_id and container.warehouse_id != warehouse.id:
        old = db.get(Warehouse, container.warehouse_id)
        if old:
            old.occupancy = max(0, old.occupancy - 1)
    if container.warehouse_id != warehouse.id:
        warehouse.occupancy += 1
    container.warehouse_id = warehouse.id
    container.status = "at_yard"
    container.location = f"{warehouse.code} · {warehouse.zone}"
    if container.vehicle_id:
        vehicle = db.get(Vehicle, container.vehicle_id)
        if vehicle:
            _release_vehicle(db, vehicle)
    container.updated_at = utcnow()
    _container_event(db, container, previous, f"Storage assigned to {warehouse.code}", actor)


def advance_container(db: Session, container: Container, payload, actor: str) -> dict[str, Any]:
    target = payload.target_status
    current = container.status
    if target == current:
        raise AllocationError(f"Container is already {current}")
    allowed = CONTAINER_TRANSITIONS.get(current, [])
    if target == "delivered":
        raise AllocationError(
            "Delivered is only reachable by completing a dispatch. Create or complete a dispatch for this container."
        )
    if target not in allowed:
        raise AllocationError(
            f"Invalid transition {current} → {target}. Allowed next state(s): {', '.join(allowed) or 'none'}."
        )

    note = payload.note or ""

    if target == "allocated":
        crane = None
        if payload.crane_code:
            crane = db.query(Crane).filter(Crane.code == payload.crane_code).first()
            if not crane:
                raise AllocationError(f"Crane {payload.crane_code} not found")
            if crane.status in ("maintenance", "fault"):
                raise AllocationError(f"{crane.code} is unavailable ({crane.status})")
        container.crane_id = crane.id if crane else container.crane_id
        container.location = f"Quay · {crane.code}" if crane else "Quay allocation pending"
        note = note or "Crane allocation issued"

    elif target == "loading":
        crane = db.query(Crane).filter(Crane.id == container.crane_id).first() if container.crane_id else None
        if payload.crane_code:
            crane = db.query(Crane).filter(Crane.code == payload.crane_code).first()
        if not crane:
            raise AllocationError("A valid crane is required before loading can start")
        if crane.status in ("maintenance", "fault"):
            raise AllocationError(f"{crane.code} cannot load cargo ({crane.status})")
        crane.status = "active"
        crane.moves_total += 1
        container.crane_id = crane.id
        container.location = f"Under crane · {crane.code}"
        note = note or f"Loaded by {crane.code}"

    elif target == "in_transit":
        if not payload.vehicle_code:
            raise AllocationError("A truck must be assigned before a container can move")
        vehicle = db.query(Vehicle).filter(Vehicle.code == payload.vehicle_code).first()
        if not vehicle:
            raise AllocationError(f"Truck {payload.vehicle_code} not found")
        if vehicle.status in ("maintenance", "fault"):
            raise AllocationError(f"{vehicle.code} is unavailable ({vehicle.status})")
        if vehicle.fuel < 15:
            raise AllocationError(f"{vehicle.code} fuel {vehicle.fuel:.0f}% below the 15% transit floor")
        if vehicle.capacity_t < container.weight_t:
            raise AllocationError(
                f"Container {container.weight_t} t exceeds {vehicle.code} payload {vehicle.capacity_t} t"
            )
        if not vehicle.driver or vehicle.driver.duty_status != "on_duty":
            raise AllocationError(f"{vehicle.code} needs an on-duty driver")
        if container.vehicle_id and container.vehicle_id != vehicle.id:
            old = db.get(Vehicle, container.vehicle_id)
            if old:
                _release_vehicle(db, old)
        vehicle.status = "in_transit"
        vehicle.current_task = f"Haul {container.code} → {container.destination}"
        vehicle.route_key = (
            f"d{container.crane.dock.code[-1]}" if container.crane and container.crane.dock else "yard"
        )
        vehicle.route_phase = 0.05
        container.vehicle_id = vehicle.id
        container.location = f"In transit · {container.destination}"
        note = note or f"Onboard {vehicle.code}"

    elif target == "at_yard":
        warehouse = None
        if payload.warehouse_code:
            warehouse = db.query(Warehouse).filter(Warehouse.code == payload.warehouse_code).first()
            if not warehouse:
                raise AllocationError(f"Warehouse {payload.warehouse_code} not found")
        elif container.warehouse:
            warehouse = container.warehouse
        if not warehouse:
            raise AllocationError("Select a warehouse with available capacity")
        if warehouse.status != "operational":
            raise AllocationError(f"{warehouse.code} is {warehouse.status}; storage is blocked")
        if warehouse.available <= 0:
            raise AllocationError(f"{warehouse.code} is at capacity ({warehouse.occupancy}/{warehouse.capacity_teu} TEU)")
        if container.warehouse_id != warehouse.id:
            warehouse.occupancy += 1
            if container.warehouse_id:
                old = db.get(Warehouse, container.warehouse_id)
                if old:
                    old.occupancy = max(0, old.occupancy - 1)
        container.warehouse_id = warehouse.id
        container.location = f"{warehouse.code} · {warehouse.zone}"
        if container.vehicle_id:
            vehicle = db.get(Vehicle, container.vehicle_id)
            if vehicle:
                _release_vehicle(db, vehicle)
        note = note or f"Received into {warehouse.code}"

    elif target == "ready_for_dispatch":
        container.location = (
            f"{container.warehouse.code} · dispatch lane" if container.warehouse else "Dispatch lane"
        )
        note = note or "Staged for outbound dispatch"

    container.status = target
    container.updated_at = utcnow()
    _container_event(db, container, current, note, actor)
    record_audit(
        db,
        actor=actor,
        action="container_status_changed",
        entity_type="container",
        entity_code=container.code,
        detail=f"{current} → {target}: {note}",
    )
    event = record_event(
        db,
        type="container_moved",
        title=f"{container.code} · {current.replace('_', ' ')} → {target.replace('_', ' ')}",
        message=f"{container.code} ({container.cargo_type}, {container.weight_t} t) {note or 'status updated'}.",
        entity_type="container",
        entity_code=container.code,
        payload={"from": current, "to": target},
    )
    db.commit()
    db.refresh(container)
    return {"container": container, "event": event}
