from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.common import current_actor, notify, paginate
from app.core.database import get_db
from app.core.timeutil import utcnow
from app.models import Assignment, Container, OperationalEvent, Ship
from app.schemas import ShipCreate, ShipUpdate
from app.services import vessel_service
from app.services.common import record_audit, record_event
from app.services.serializers import assignment_out, container_out, event_out, ship_out

router = APIRouter(prefix="/ships", tags=["ships"])


def _get_ship(db: Session, code: str) -> Ship:
    ship = db.query(Ship).filter(Ship.code == code).first()
    if not ship:
        raise HTTPException(status_code=404, detail=f"Ship {code} not found")
    return ship


@router.get("")
def list_ships(
    status: str | None = None,
    q: str | None = None,
    include_departed: bool = True,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Ship)
    if not include_departed:
        query = query.filter(Ship.status != "departed")
    if status:
        query = query.filter(Ship.status == status)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Ship.code.ilike(like), Ship.name.ilike(like)))
    query = query.order_by(Ship.status.asc(), Ship.eta.asc())
    return paginate(query, page, page_size, ship_out)


@router.get("/{code}")
def get_ship(code: str, db: Session = Depends(get_db)):
    ship = _get_ship(db, code)
    counts = dict(
        db.query(Container.status, func.count(Container.id))
        .filter(Container.ship_id == ship.id)
        .group_by(Container.status)
        .all()
    )
    assignments = (
        db.query(Assignment)
        .filter(Assignment.ship_id == ship.id)
        .order_by(Assignment.created_at.desc())
        .limit(20)
        .all()
    )
    events = (
        db.query(OperationalEvent)
        .filter(OperationalEvent.entity_code == code)
        .order_by(OperationalEvent.ts.desc())
        .limit(20)
        .all()
    )
    containers = (
        db.query(Container)
        .filter(Container.ship_id == ship.id)
        .order_by(Container.code)
        .limit(200)
        .all()
    )
    return {
        "ship": ship_out(ship),
        "container_counts": counts,
        "assignments": [assignment_out(a) for a in assignments if a.status == "active"],
        "assignment_history": [assignment_out(a) for a in assignments],
        "events": [event_out(e) for e in events],
        "containers": [container_out(c) for c in containers[:50]],
        "delay_hours": (
            round((utcnow() - ship.eta).total_seconds() / 3600, 1)
            if ship.eta and ship.eta < utcnow() and ship.status not in ("docked", "unloading", "departed")
            else 0
        ),
    }


@router.post("", status_code=201)
def create_ship(payload: ShipCreate, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    ship, event = vessel_service.create_ship(db, payload, actor)
    notify(event, ["ships", "dashboard", "twin", "analytics"])
    return {"ship": ship_out(ship), "event": event_out(event)}


@router.put("/{code}")
def update_ship(code: str, payload: ShipUpdate, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    ship = _get_ship(db, code)
    if ship.status == "departed":
        raise HTTPException(status_code=409, detail="Cannot edit a departed vessel")
    changes = payload.model_dump(exclude_unset=True)
    if "cargo_qty" in changes:
        existing = db.query(Container).filter(Container.ship_id == ship.id).count()
        if existing and changes["cargo_qty"] < existing:
            raise HTTPException(
                status_code=409,
                detail=f"{existing} containers are already manifested; cargo quantity cannot drop below that",
            )
    for key, value in changes.items():
        setattr(ship, key, value)
    record_audit(db, actor=actor, action="ship_updated", entity_type="ship", entity_code=code, detail=str(changes))
    event = record_event(
        db, type="ship_updated", title=f"{code} plan updated",
        message=f"Vessel record updated: {', '.join(changes.keys()) or 'no changes'}.",
        entity_type="ship", entity_code=code,
    )
    db.commit()
    notify(event, ["ships", "dashboard"])
    return ship_out(ship)


@router.post("/{code}/arrive")
def arrive(code: str, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    event = vessel_service.arrive_ship(db, _get_ship(db, code), actor)
    notify(event, ["ships", "dashboard", "twin", "analytics"])
    return {"message": "Vessel marked arrived", "event": event_out(event)}


@router.post("/{code}/unload")
def start_unload(code: str, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    result = vessel_service.start_unloading(db, _get_ship(db, code), actor)
    notify(result["event"], ["ships", "containers", "dashboard", "twin", "analytics", "alerts"])
    return {
        "message": "Discharge started",
        "created_containers": result["created_containers"],
        "event": event_out(result["event"]),
    }


@router.post("/{code}/unload/complete")
def complete_unload(code: str, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    event = vessel_service.complete_unloading(db, _get_ship(db, code), actor)
    notify(event, ["ships", "dashboard", "twin", "resources", "containers"])
    return {"message": "Discharge completed", "event": event_out(event)}


@router.post("/{code}/depart")
def depart(code: str, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    event = vessel_service.depart_ship(db, _get_ship(db, code), actor)
    notify(event, ["ships", "dashboard", "docks", "twin", "resources", "analytics"])
    return {"message": "Vessel departed", "event": event_out(event)}
