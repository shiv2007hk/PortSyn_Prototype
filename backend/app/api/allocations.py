from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.common import current_actor, notify, paginate
from app.core.database import get_db
from app.models import Assignment, Container, Ship
from app.schemas import AllocationDecisionRequest, AllocationRecommendRequest
from app.services import allocation_engine
from app.services.allocation_engine import AllocationError
from app.services.serializers import assignment_out, event_out

router = APIRouter(prefix="/allocations", tags=["allocations"])


@router.post("/recommend")
def recommend(payload: AllocationRecommendRequest, db: Session = Depends(get_db)):
    ship = db.query(Ship).filter(Ship.code == payload.ship_code).first()
    if not ship:
        raise HTTPException(status_code=404, detail=f"Ship {payload.ship_code} not found")
    container = None
    if payload.container_code:
        container = db.query(Container).filter(Container.code == payload.container_code).first()
        if not container:
            raise HTTPException(status_code=404, detail=f"Container {payload.container_code} not found")
    try:
        return allocation_engine.recommend(db, ship, payload.kind, payload.dock_code, container)
    except AllocationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/accept")
def accept(payload: AllocationDecisionRequest, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    try:
        result = allocation_engine.accept(db, payload, actor, source="optimizer")
    except AllocationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    event = result["event"]
    notify(event, ["ships", "docks", "resources", "dashboard", "twin", "containers", "analytics", "allocations"])
    result["event"] = event_out(event)
    return result


@router.post("/override")
def override(payload: AllocationDecisionRequest, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    if not payload.reason:
        raise HTTPException(status_code=422, detail="A written reason is required for a manual override")
    payload.source = "override"
    try:
        result = allocation_engine.accept(db, payload, actor, source="override")
    except AllocationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    event = result["event"]
    notify(event, ["ships", "docks", "resources", "dashboard", "twin", "containers", "analytics", "allocations"])
    result["event"] = event_out(event)
    return result


@router.get("/history")
def history(
    status: str | None = None,
    kind: str | None = None,
    ship_code: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Assignment)
    if status:
        query = query.filter(Assignment.status == status)
    if kind:
        query = query.filter(Assignment.kind == kind)
    if ship_code:
        ship = db.query(Ship).filter(Ship.code == ship_code).first()
        if not ship:
            raise HTTPException(status_code=404, detail=f"Ship {ship_code} not found")
        query = query.filter(Assignment.ship_id == ship.id)
    query = query.order_by(Assignment.created_at.desc())
    return paginate(query, page, page_size, assignment_out)
