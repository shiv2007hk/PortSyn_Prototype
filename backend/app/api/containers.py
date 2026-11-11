import io
from typing import Literal

import qrcode
import qrcode.image.svg
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.common import current_actor, notify, paginate
from app.core.constants import CONTAINER_STATUSES
from app.core.database import get_db
from app.models import Container, Dispatch, DispatchItem, Ship
from app.schemas import ContainerStatusUpdate
from app.services import container_service
from app.services.serializers import container_out, dispatch_out, event_out, iso

router = APIRouter(prefix="/containers", tags=["containers"])


def _base_query(db: Session):
    return db.query(Container)


@router.get("")
def list_containers(
    status: str | None = None,
    priority: str | None = None,
    ship_code: str | None = None,
    warehouse_code: str | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=300),
    db: Session = Depends(get_db),
):
    query = _base_query(db)
    if status:
        query = query.filter(Container.status == status)
    if priority:
        query = query.filter(Container.priority == priority)
    if ship_code:
        query = query.filter(Container.ship.has(code=ship_code))
    if warehouse_code:
        query = query.filter(Container.warehouse.has(code=warehouse_code))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Container.code.ilike(like), Container.destination.ilike(like)))
    query = query.order_by(Container.updated_at.desc())
    return paginate(query, page, page_size, container_out)


@router.get("/board")
def board(
    priority: str | None = None,
    ship_code: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Container)
    if priority:
        query = query.filter(Container.priority == priority)
    if ship_code:
        query = query.filter(Container.ship.has(code=ship_code))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(Container.code.ilike(like), Container.destination.ilike(like)))
    rows = query.order_by(Container.priority.desc(), Container.updated_at.desc()).limit(500).all()
    columns = []
    for status in CONTAINER_STATUSES:
        items = [c for c in rows if c.status == status]
        columns.append(
            {
                "status": status,
                "count": len(items),
                "priority_counts": {
                    p: sum(1 for c in items if c.priority == p) for p in ("critical", "high", "normal", "low")
                },
                "items": [container_out(c) for c in items[:80]],
            }
        )
    return {"columns": columns, "total": len(rows), "truncated": len(rows) >= 500}


@router.get("/{code}")
def get_container(code: str, db: Session = Depends(get_db)):
    container = db.query(Container).filter(Container.code == code).first()
    if not container:
        raise HTTPException(status_code=404, detail=f"Container {code} not found")
    history = [
        {
            "from_status": row.from_status,
            "to_status": row.to_status,
            "note": row.note,
            "actor": row.actor,
            "ts": iso(row.ts),
        }
        for row in container.history
    ]
    active_dispatch = (
        db.query(Dispatch)
        .join(DispatchItem, Dispatch.id == DispatchItem.dispatch_id)
        .filter(DispatchItem.container_id == container.id)
        .order_by(Dispatch.created_at.desc())
        .first()
    )
    return {
        "container": container_out(container),
        "history": history,
        "dispatch": dispatch_out(active_dispatch) if active_dispatch else None,
        "ship": {
            "code": container.ship.code if container.ship else None,
            "name": container.ship.name if container.ship else None,
        },
    }


@router.put("/{code}/status")
def update_status(
    code: str,
    payload: ContainerStatusUpdate,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    container = db.query(Container).filter(Container.code == code).first()
    if not container:
        raise HTTPException(status_code=404, detail=f"Container {code} not found")
    try:
        result = container_service.advance_container(db, container, payload, actor)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    event = result["event"]
    notify(event, ["containers", "warehouses", "dashboard", "twin", "analytics", "dispatch", "resources"])
    return {"container": container_out(container), "event": event_out(event)}


@router.get("/{code}/qr.svg")
def container_qr(code: str, db: Session = Depends(get_db)):
    container = db.query(Container).filter(Container.code == code).first()
    if not container:
        raise HTTPException(status_code=404, detail=f"Container {code} not found")
    payload = (
        f"PORTSYNC|{container.code}|SHIP:{container.ship.code if container.ship else '-'}"
        f"|STATUS:{container.status}|WH:{container.warehouse.code if container.warehouse else '-'}"
        f"|DEST:{container.destination}"
    )
    image = qrcode.make(payload, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2)
    buffer = io.BytesIO()
    image.save(buffer)
    return Response(
        content=buffer.getvalue(),
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-store", "Content-Disposition": f'inline; filename="{code}.svg"'},
    )
