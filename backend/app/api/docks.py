from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.common import current_actor, notify
from app.core.database import get_db
from app.core.timeutil import utcnow
from app.models import Dock
from app.schemas import DockUpdate
from app.services.allocation_engine import dock_wait_minutes
from app.services.common import record_audit, record_event
from app.services.serializers import crane_out, dock_out

router = APIRouter(prefix="/docks", tags=["docks"])


@router.get("")
def list_docks(db: Session = Depends(get_db)):
    docks = db.query(Dock).order_by(Dock.code).all()
    items = []
    for dock in docks:
        row = dock_out(dock)
        row["cranes"] = [crane_out(c) for c in dock.cranes]
        row["wait_min"] = dock_wait_minutes(dock)
        row["idle_cranes"] = sum(1 for c in dock.cranes if c.status == "idle")
        items.append(row)
    usable = [d for d in docks if d.status != "maintenance"]
    return {
        "items": items,
        "summary": {
            "total": len(docks),
            "available": sum(1 for d in docks if d.status == "available"),
            "occupied": sum(1 for d in docks if d.status == "occupied"),
            "maintenance": sum(1 for d in docks if d.status == "maintenance"),
            "occupancy_pct": round(
                sum(1 for d in docks if d.status == "occupied") / max(len(usable), 1) * 100, 1
            ),
        },
    }


@router.patch("/{code}")
def update_dock(code: str, payload: DockUpdate, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    dock = db.query(Dock).filter(Dock.code == code).first()
    if not dock:
        raise HTTPException(status_code=404, detail=f"Dock {code} not found")
    if payload.status == "occupied":
        raise HTTPException(status_code=400, detail="Occupied status is derived from vessel allocation")
    if payload.status in ("available", "maintenance") and dock.current_ship:
        raise HTTPException(
            status_code=409,
            detail=f"{dock.current_ship.code} is alongside {code}; release the vessel before changing berth availability",
        )
    changes = payload.model_dump(exclude_unset=True)
    if payload.status:
        dock.status = payload.status
        if payload.status == "maintenance":
            dock.maintenance_until = payload.maintenance_until or (utcnow().replace(microsecond=0) + timedelta(hours=4))
        else:
            dock.maintenance_until = None
    elif payload.maintenance_until is not None:
        dock.maintenance_until = payload.maintenance_until
    record_audit(db, actor=actor, action="dock_updated", entity_type="dock", entity_code=code, detail=str(changes))
    event = record_event(
        db,
        type="dock_updated",
        title=f"{code} availability updated",
        message=f"Berth {code} is now {dock.status}"
        + (f" until {dock.maintenance_until.strftime('%d %b %H:%M')} UTC" if dock.maintenance_until else "")
        + ".",
        entity_type="dock",
        entity_code=code,
    )
    db.commit()
    notify(event, ["docks", "dashboard", "ships", "alerts"])
    return dock_out(dock)
