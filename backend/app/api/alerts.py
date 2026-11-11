from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.common import current_actor, notify, paginate
from app.core.database import get_db
from app.core.timeutil import utcnow
from app.models import Alert, MaintenanceTask
from app.schemas import AlertStatusUpdate, MaintenanceStatusUpdate, MaintenanceTaskCreate
from app.services import maintenance_engine
from app.services.allocation_engine import AllocationError
from app.services.common import record_audit
from app.services.serializers import alert_out, maintenance_out

router = APIRouter(prefix="/alerts", tags=["alerts"])
maintenance_router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("")
def list_alerts(
    severity: str | None = None,
    status: str | None = None,
    category: str | None = None,
    entity_code: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Alert)
    if severity:
        query = query.filter(Alert.severity == severity)
    if status:
        query = query.filter(Alert.status == status)
    if category:
        query = query.filter(Alert.category == category)
    if entity_code:
        query = query.filter(Alert.entity_code == entity_code)
    order = {"critical": 0, "warning": 1, "info": 2}
    rows = query.order_by(Alert.created_at.desc(), Alert.id.desc()).all()
    rows.sort(key=lambda a: (0 if a.status == "active" else 1 if a.status == "acknowledged" else 2, order.get(a.severity, 3)))
    start = (page - 1) * page_size
    page_rows = rows[start : start + page_size]
    return {
        "items": [alert_out(a) for a in page_rows],
        "page": page,
        "page_size": page_size,
        "total": len(rows),
        "pages": max(1, (len(rows) + page_size - 1) // page_size),
    }


@router.get("/summary")
def alert_summary(db: Session = Depends(get_db)):
    rows = db.query(Alert).all()
    def count(**filters):
        return db.query(Alert).filter_by(**filters).count()

    categories: dict[str, int] = {}
    for alert in rows:
        if alert.status != "resolved":
            categories[alert.category] = categories.get(alert.category, 0) + 1
    return {
        "active": count(status="active"),
        "acknowledged": count(status="acknowledged"),
        "resolved": count(status="resolved"),
        "critical": count(status="active", severity="critical"),
        "warning": count(status="active", severity="warning"),
        "info": count(status="active", severity="info"),
        "by_category": dict(sorted(categories.items(), key=lambda kv: kv[1], reverse=True)),
    }


@router.post("/scan")
def scan(actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    created = maintenance_engine.scan_operational_alerts(db)
    record_audit(db, actor=actor, action="alerts_scanned", entity_type="alert", entity_code="all",
                 detail=f"{len(created)} new alert(s)")
    db.commit()
    if created:
        notify(None, ["alerts", "dashboard", "maintenance"])
    return {"created": len(created), "items": [alert_out(a) for a in created]}


def _get_alert(db: Session, alert_id: int) -> Alert:
    alert = db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    return alert


@router.post("/{alert_id}/acknowledge")
def acknowledge(
    alert_id: int,
    payload: AlertStatusUpdate | None = None,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    alert = _get_alert(db, alert_id)
    if alert.status == "resolved":
        raise HTTPException(status_code=409, detail="Resolved alerts cannot be acknowledged")
    alert.status = "acknowledged"
    alert.acknowledged_at = utcnow()
    record_audit(db, actor=actor, action="alert_acknowledged", entity_type="alert", entity_code=str(alert.id),
                 detail=(payload.note if payload and payload.note else alert.title)[:400])
    db.commit()
    notify(None, ["alerts", "dashboard"])
    return alert_out(alert)


@router.post("/{alert_id}/resolve")
def resolve(
    alert_id: int,
    payload: AlertStatusUpdate | None = None,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    alert = _get_alert(db, alert_id)
    if alert.status == "resolved":
        return alert_out(alert)
    alert.status = "resolved"
    alert.resolved_at = utcnow()
    if not alert.acknowledged_at:
        alert.acknowledged_at = alert.resolved_at
    record_audit(db, actor=actor, action="alert_resolved", entity_type="alert", entity_code=str(alert.id),
                 detail=(payload.note if payload and payload.note else alert.title)[:400])
    db.commit()
    notify(None, ["alerts", "dashboard", "maintenance"])
    return alert_out(alert)


@router.post("/{alert_id}/maintenance", status_code=201)
def alert_to_maintenance(
    alert_id: int,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    alert = _get_alert(db, alert_id)
    if alert.entity_type not in ("crane", "vehicle") or not alert.entity_code:
        raise HTTPException(status_code=409, detail="This alert is not tied to serviceable equipment")
    try:
        task, event = maintenance_engine.create_maintenance_task(
            db, alert.entity_type, alert.entity_code, actor,
            reason=f"Raised from {alert.category.replace('_', ' ')} alert", notes=alert.message,
        )
    except AllocationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    alert.status = "resolved"
    alert.resolved_at = utcnow()
    db.commit()
    notify(event, ["alerts", "maintenance", "resources", "dashboard"])
    return maintenance_out(task)


# ----- maintenance ---------------------------------------------------------


@maintenance_router.get("")
def maintenance_overview(db: Session = Depends(get_db)):
    return maintenance_engine.maintenance_overview(db)


@maintenance_router.get("/risk")
def risk_register(db: Session = Depends(get_db)):
    return {
        "items": maintenance_engine.risk_register(db),
        "disclaimer": maintenance_engine.maintenance_overview(db)["disclaimer"],
    }


@maintenance_router.post("/tasks", status_code=201)
def create_task(
    payload: MaintenanceTaskCreate,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    try:
        task, event = maintenance_engine.create_maintenance_task(
            db, payload.equipment_type, payload.equipment_code, actor,
            reason=payload.reason, scheduled_for=payload.scheduled_for, notes=payload.notes,
        )
    except AllocationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    notify(event, ["maintenance", "resources", "alerts", "dashboard", "twin"])
    return maintenance_out(task)


@maintenance_router.patch("/tasks/{code}")
def update_task(
    code: str,
    payload: MaintenanceStatusUpdate,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    task = db.query(MaintenanceTask).filter(MaintenanceTask.code == code).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Maintenance task {code} not found")
    try:
        updated = maintenance_engine.update_task_status(db, task, payload.status, actor)
    except AllocationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    notify(None, ["maintenance", "resources", "alerts", "dashboard", "twin"])
    return maintenance_out(updated)
