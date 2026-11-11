import random
from typing import Any

from sqlalchemy.orm import Session

from app.core.timeutil import utcnow
from app.models import Assignment, Container, ContainerEvent, Crane, Ship
from app.services.allocation_engine import AllocationError, release_ship_assignments
from app.services.common import record_audit, record_event


DESTINATIONS = [
    "Inland DC · Nashik",
    "JNPT Rail Hub",
    "Pune CFS",
    "Mumbai Distribution Centre",
    "Ahmedabad Logistics Park",
]


def next_ship_code(db: Session) -> str:
    codes = [row.code for row in db.query(Ship.code).all()]
    numbers = []
    for code in codes:
        tail = code.split("-")[-1]
        if tail.isdigit():
            numbers.append(int(tail))
    return f"SH-{max(numbers + [99]) + 1}"


def create_ship(db: Session, payload, actor: str) -> Ship:
    existing = db.query(Ship).filter(Ship.code == payload.code).first() if getattr(payload, "code", None) else None
    if existing:
        raise AllocationError(f"Ship code {payload.code} already exists")
    ship = Ship(
        code=payload.code or next_ship_code(db),
        name=payload.name,
        cargo_type=payload.cargo_type,
        cargo_qty=payload.cargo_qty,
        priority=payload.priority,
        eta=payload.eta or utcnow(),
        vessel_length_m=payload.vessel_length_m,
        draft_m=payload.draft_m,
        handling_hours=payload.handling_hours,
        status="approaching",
    )
    db.add(ship)
    db.flush()
    record_audit(
        db,
        actor=actor,
        action="ship_registered",
        entity_type="ship",
        entity_code=ship.code,
        detail=f"{ship.name} · {ship.cargo_qty} TEU {ship.cargo_type} · priority {ship.priority}",
    )
    event = record_event(
        db,
        type="ship_registered",
        title=f"{ship.code} registered for berth planning",
        message=(
            f"{ship.name} carrying {ship.cargo_qty} TEU of {ship.cargo_type} cargo "
            f"is approaching. ETA {ship.eta.strftime('%d %b %H:%M')} UTC · priority {ship.priority}."
        ),
        entity_type="ship",
        entity_code=ship.code,
        severity="info",
        payload={"cargo_qty": ship.cargo_qty, "priority": ship.priority},
    )
    db.commit()
    db.refresh(ship)
    return ship, event


def arrive_ship(db: Session, ship: Ship, actor: str) -> Any:
    if ship.status not in ("approaching",):
        raise AllocationError(f"{ship.code} is already {ship.status}")
    ship.status = "arrived"
    ship.arrived_at = utcnow()
    record_audit(db, actor=actor, action="ship_arrived", entity_type="ship", entity_code=ship.code)
    event = record_event(
        db,
        type="ship_arrived",
        title=f"{ship.code} arrived at anchorage",
        message=f"{ship.code} is holding at anchorage awaiting a berth allocation.",
        entity_type="ship",
        entity_code=ship.code,
    )
    db.commit()
    return event


def start_unloading(db: Session, ship: Ship, actor: str) -> dict:
    if ship.status not in ("docked", "unloading"):
        raise AllocationError(f"{ship.code} must be docked before discharge ({ship.status})")
    if not ship.dock:
        raise AllocationError(f"{ship.code} has no berth assigned")
    crane_assignment = (
        db.query(Assignment)
        .filter(Assignment.ship_id == ship.id, Assignment.kind == "crane", Assignment.status == "active")
        .first()
    )
    if not crane_assignment:
        raise AllocationError("Assign a compatible crane before starting discharge")

    created = 0
    existing = db.query(Container).filter(Container.ship_id == ship.id).count()
    if existing == 0:
        rng = random.Random(4200 + ship.id)
        base_count = db.query(Container).count()
        for idx in range(int(ship.cargo_qty)):
            weight = round(rng.uniform(11.0, 27.5), 1)
            priority = "high" if ship.priority in ("high", "critical") and idx % 3 == 0 else (
                "normal" if idx % 7 else "low"
            )
            container = Container(
                code=f"CONT-{base_count + idx + 1:04d}",
                ship_id=ship.id,
                cargo_type=ship.cargo_type,
                priority=priority,
                status="waiting",
                location=f"Vessel hold · {ship.code}",
                destination=DESTINATIONS[idx % len(DESTINATIONS)],
                weight_t=weight,
            )
            db.add(container)
            db.flush()
            db.add(
                ContainerEvent(
                    container_id=container.id,
                    from_status=None,
                    to_status="waiting",
                    note=f"Discharged manifest created for {ship.code}",
                    actor="system",
                )
            )
            created += 1
    ship.status = "unloading"
    if ship.handling_progress >= 100:
        ship.handling_progress = 0.0
    record_audit(
        db,
        actor=actor,
        action="unloading_started",
        entity_type="ship",
        entity_code=ship.code,
        detail=f"{created} containers manifested at {ship.dock.code}; crane {crane_assignment.resource_code}",
    )
    event = record_event(
        db,
        type="unloading_started",
        title=f"Discharge started for {ship.code}",
        message=(
            f"{ship.code} began discharge at {ship.dock.code} using {crane_assignment.resource_code}. "
            f"{created or existing} containers tracked."
        ),
        entity_type="ship",
        entity_code=ship.code,
        payload={"containers": created or existing, "crane": crane_assignment.resource_code},
    )
    db.commit()
    return {"created_containers": created, "event": event}


def depart_ship(db: Session, ship: Ship, actor: str) -> Any:
    if ship.status == "departed":
        raise AllocationError(f"{ship.code} has already departed")
    if ship.status not in ("docked", "unloading"):
        raise AllocationError(f"{ship.code} is not alongside ({ship.status})")
    remaining = (
        db.query(Container)
        .filter(Container.ship_id == ship.id, Container.status.in_(["waiting", "allocated", "loading"]))
        .count()
    )
    if ship.status == "unloading" or remaining:
        raise AllocationError(
            f"{ship.code} still has {remaining} container(s) on the vessel. Complete discharge before departure."
        )
    release_ship_assignments(db, ship, actor)
    ship.status = "departed"
    ship.departed_at = utcnow()
    ship.handling_progress = 100.0
    event = record_event(
        db,
        type="ship_departed",
        title=f"{ship.code} departed",
        message=f"{ship.code} sailed after completing discharge. Berth capacity returned to the pool.",
        entity_type="ship",
        entity_code=ship.code,
    )
    db.commit()
    return event


def complete_unloading(db: Session, ship: Ship, actor: str) -> Any:
    if ship.status != "unloading":
        raise AllocationError(f"{ship.code} is not discharging")
    ship.handling_progress = 100.0
    ship.status = "docked"
    for row in (
        db.query(Assignment)
        .filter(Assignment.ship_id == ship.id, Assignment.kind == "crane", Assignment.status == "active")
        .all()
    ):
        row.status = "released"
        row.released_at = utcnow()
        crane = db.query(Crane).filter(Crane.code == row.resource_code).first()
        if crane:
            crane.status = "idle"
    event = record_event(
        db,
        type="unloading_complete",
        title=f"Discharge complete · {ship.code}",
        message=f"All cargo for {ship.code} has been landed. Crane released; vessel can be cleared for departure.",
        entity_type="ship",
        entity_code=ship.code,
    )
    db.commit()
    return event
