from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.common import paginate
from app.core.database import get_db
from app.models import OperationalEvent
from app.services import analytics_engine
from app.services.serializers import event_out

router = APIRouter(tags=["analytics"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    return analytics_engine.dashboard(db)


@router.get("/analytics")
def analytics(
    days: int = Query(7, ge=1, le=90),
    granularity: str = Query("day", pattern="^(day|week)$"),
    db: Session = Depends(get_db),
):
    return analytics_engine.analytics(db, days, granularity)


@router.get("/analytics/bottlenecks")
def bottlenecks(db: Session = Depends(get_db)):
    return {"items": analytics_engine.bottlenecks(db)}


@router.get("/events")
def events(
    type: str | None = None,
    severity: str | None = None,
    entity_code: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(OperationalEvent)
    if type:
        query = query.filter(OperationalEvent.type == type)
    if severity:
        query = query.filter(OperationalEvent.severity == severity)
    if entity_code:
        query = query.filter(OperationalEvent.entity_code == entity_code)
    query = query.order_by(OperationalEvent.ts.desc(), OperationalEvent.id.desc())
    return paginate(query, page, page_size, event_out)


@router.get("/analytics/export")
def export_csv(
    dataset: str = Query("summary", pattern="^(summary|containers|ships|dispatches|alerts|activity)$"),
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    content, filename = analytics_engine.build_csv(db, dataset, days)
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
