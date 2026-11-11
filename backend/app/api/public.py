import re

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import Depends

from app.core.database import get_db
from app.models import Container, Crane, Dock, Ship, Vehicle
from app.services.serializers import iso

router = APIRouter(prefix="/public", tags=["public"])
CODE_PATTERN = re.compile(r"^(SH-\d{3}|CONT-\d{4})$")

DATA_NOTE = "Demonstration data from the deterministic PortSync simulator. Not live port telemetry."


@router.get("/summary")
def public_summary(db: Session = Depends(get_db)):
    docks = db.query(Dock).all()
    ships = (
        db.query(Ship)
        .filter(Ship.status != "departed")
        .order_by(Ship.eta.asc())
        .limit(4)
        .all()
    )
    active_cranes = db.query(func.count(Crane.id)).filter(Crane.status.in_(["active", "idle"])).scalar() or 0
    active_trucks = db.query(func.count(Vehicle.id)).filter(Vehicle.status.in_(["available", "assigned", "in_transit"])).scalar() or 0
    total_docks = len(docks) or 1
    synchronized = sum(1 for dock in docks if dock.status != "maintenance")
    return {
        "docks_connected": len(docks),
        "docks_operational": synchronized,
        "active_equipment": active_cranes + active_trucks,
        "active_cranes": active_cranes,
        "active_trucks": active_trucks,
        "synchronization_pct": round(synchronized / total_docks * 100, 1),
        "schedule": [
            {
                "code": ship.code,
                "name": ship.name,
                "status": ship.status,
                "eta": iso(ship.eta),
                "dock_code": ship.dock.code if ship.dock else None,
                "cargo_qty": ship.cargo_qty,
            }
            for ship in ships
        ],
        "simulated": True,
        "data_note": DATA_NOTE,
    }


@router.get("/track")
def public_track(
    code: str = Query(min_length=5, max_length=12),
    db: Session = Depends(get_db),
):
    normalized = code.strip().upper()
    if not CODE_PATTERN.match(normalized):
        raise HTTPException(status_code=422, detail="Use a vessel code like SH-104 or a container code like CONT-0001.")
    if normalized.startswith("SH-"):
        ship = db.query(Ship).filter(Ship.code == normalized).first()
        if ship is None:
            raise HTTPException(status_code=404, detail=f"{normalized} is not in the public vessel schedule.")
        return {
            "kind": "ship",
            "code": ship.code,
            "name": ship.name,
            "status": ship.status,
            "location": f"Berth {ship.dock.code}" if ship.dock else "Port approach",
            "eta": iso(ship.eta),
            "last_update": iso(ship.updated_at),
            "simulated": True,
            "data_note": DATA_NOTE,
        }
    container = db.query(Container).filter(Container.code == normalized).first()
    if container is None:
        raise HTTPException(status_code=404, detail=f"{normalized} is not in the demonstration manifest.")
    return {
        "kind": "container",
        "code": container.code,
        "status": container.status,
        "location": container.location,
        "destination": container.destination,
        "priority": container.priority,
        "last_update": iso(container.updated_at),
        "simulated": True,
        "data_note": DATA_NOTE,
    }
