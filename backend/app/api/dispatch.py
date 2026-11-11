from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.common import current_actor, notify, paginate
from app.core.database import get_db
from app.models import Container, Dispatch, DispatchItem, Vehicle
from app.schemas import DispatchCreateRequest, DispatchStatusUpdate
from app.services import dispatch_service
from app.services.serializers import container_out, dispatch_out, event_out, vehicle_out

router = APIRouter(prefix="/dispatch", tags=["dispatch"])


@router.get("")
def list_dispatches(
    status: str | None = None,
    mode: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Dispatch)
    if status:
        query = query.filter(Dispatch.status == status)
    if mode:
        query = query.filter(Dispatch.mode == mode)
    query = query.order_by(Dispatch.created_at.desc())
    data = paginate(query, page, page_size, dispatch_out)
    all_rows = db.query(Dispatch).all()
    data["summary"] = {
        "total": len(all_rows),
        "pending": sum(1 for d in all_rows if d.status == "pending"),
        "scheduled": sum(1 for d in all_rows if d.status == "scheduled"),
        "in_transit": sum(1 for d in all_rows if d.status == "in_transit"),
        "completed": sum(1 for d in all_rows if d.status == "completed"),
        "cancelled": sum(1 for d in all_rows if d.status == "cancelled"),
    }
    return data


@router.get("/ready")
def ready_containers(db: Session = Depends(get_db)):
    active_ids = {
        row.container_id
        for row in db.query(DispatchItem)
        .join(Dispatch, Dispatch.id == DispatchItem.dispatch_id)
        .filter(Dispatch.status.in_(["pending", "scheduled", "in_transit"]))
        .all()
    }
    rows = (
        db.query(Container)
        .filter(Container.status == "ready_for_dispatch", ~Container.id.in_(active_ids) if active_ids else True)
        .order_by(Container.updated_at)
        .limit(100)
        .all()
    )
    vehicles = (
        db.query(Vehicle)
        .filter(Vehicle.status == "available", Vehicle.fuel >= 20, Vehicle.health >= 50)
        .order_by(Vehicle.code)
        .all()
    )
    return {
        "containers": [container_out(c) for c in rows],
        "vehicles": [vehicle_out(v) for v in vehicles if v.driver and v.driver.duty_status == "on_duty"],
    }


@router.get("/{code}")
def get_dispatch(code: str, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.code == code).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail=f"Dispatch {code} not found")
    return dispatch_out(dispatch)


@router.post("", status_code=201)
def create_dispatch(
    payload: DispatchCreateRequest,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    try:
        dispatch, event = dispatch_service.create_dispatch(db, payload, actor)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    notify(event, ["dispatch", "containers", "warehouses", "resources", "dashboard", "twin", "analytics"])
    return {"dispatch": dispatch_out(dispatch), "event": event_out(event)}


@router.patch("/{code}/status")
def update_status(
    code: str,
    payload: DispatchStatusUpdate,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    dispatch = db.query(Dispatch).filter(Dispatch.code == code).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail=f"Dispatch {code} not found")
    try:
        event = dispatch_service.update_dispatch_status(db, dispatch, payload.status, actor)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    notify(event, ["dispatch", "containers", "warehouses", "resources", "dashboard", "twin", "analytics", "alerts"])
    return {"dispatch": dispatch_out(dispatch), "event": event_out(event)}
