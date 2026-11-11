import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.api.common import current_actor, notify, paginate, public_user
from app.core.config import settings
from app.core.database import get_db
from app.core.timeutil import utcnow
from app.models import AuditLog, User
from app.schemas import HealthWeightsUpdate, ResetRequest, SimClockUpdate
from app.seed.seed_data import reset_demo
from app.services import ticker
from app.services.analytics_engine import health
from app.services.common import get_health_weights, get_resource_weights, get_setting, save_setting
from app.services.digital_twin import state as twin_state
from app.services.serializers import iso
from app.websocket.manager import manager, publish_invalidate, publish_twin

logger = logging.getLogger("portsync.system")
router = APIRouter(tags=["system"])


def audit_out(row: AuditLog) -> dict:
    return {
        "id": row.id,
        "actor": row.actor,
        "action": row.action,
        "entity_type": row.entity_type,
        "entity_code": row.entity_code,
        "detail": row.detail,
        "ts": iso(row.ts),
    }


def _redact(message: str) -> str:
    return re.sub(r"(?i)(password|passwd|pwd)=\S+", r"\1=***", message)[:400]


@router.get("/health")
def health_check(request: Request, db: Session = Depends(get_db)):
    boot_error = getattr(request.app.state, "db_boot_error", None)
    error = None
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:  # pragma: no cover - defensive
        db_ok = False
        error = f"{type(exc).__name__}: {exc}"
    url = make_url(settings.database_url)
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unavailable",
        "database_target": f"{url.drivername}://{url.host or 'local'}/{url.database or ''}",
        "detail": _redact(boot_error or error) if (boot_error or error) else None,
        "environment": settings.environment,
        "sim_tick": ticker.tick_count(),
        "ws_clients": len(manager.active),
        "time": iso(utcnow()),
    }


@router.get("/system/info")
def system_info(request: Request, db: Session = Depends(get_db)):
    clock = get_setting(db, "sim_clock", {"running": settings.sim_enabled, "speed": 1.0})
    user = getattr(request.state, "user", None) or db.query(User).first()
    return {
        "app": settings.app_name,
        "version": "1.0.0",
        "environment": settings.environment,
        "port": {"name": "Mumbai Port — Terminal 2", "code": "INBOM-T2", "timezone": "UTC"},
        "simulation": {
            "enabled": settings.sim_enabled,
            "tick_seconds": settings.sim_tick_seconds,
            "seed": settings.sim_seed,
            "running": bool(clock.get("running", True)) if isinstance(clock, dict) else True,
            "speed": float(clock.get("speed", 1.0)) if isinstance(clock, dict) else 1.0,
            "tick": ticker.tick_count(),
        },
        "assistant": {
            "llm_configured": settings.llm_configured,
            "mode": "llm" if settings.llm_configured else "rules",
            "read_only": True,
        },
        "realtime": {"websocket_clients": len(manager.active), "topics": ["event", "invalidate", "twin"]},
        "current_user": public_user(user) if user else None,
        "data_note": "All operational data is synthetic simulator output for demonstration.",
    }


@router.get("/system/users")
def users(db: Session = Depends(get_db)):
    return {"items": [public_user(u) for u in db.query(User).order_by(User.id).all()]}


@router.get("/system/settings")
def get_settings(db: Session = Depends(get_db)):
    return {
        "health_weights": get_health_weights(db),
        "resource_weights": get_resource_weights(db),
        "sim_clock": get_setting(db, "sim_clock", {"running": True, "speed": 1.0}),
        "health": health(db),
    }


@router.put("/system/health-weights")
def update_health_weights(
    payload: HealthWeightsUpdate,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    raw = payload.model_dump()
    total = sum(raw.values())
    if total <= 0:
        raise HTTPException(status_code=422, detail="At least one weight must be greater than zero")
    normalized = {key: round(value / total, 3) for key, value in raw.items()}
    drift = round(1 - sum(normalized.values()), 3)
    normalized["dispatch_performance"] = round(normalized["dispatch_performance"] + drift, 3)
    save_setting(db, "health_weights", normalized)
    db.add(
        AuditLog(
            actor=actor,
            action="health_weights_updated",
            entity_type="setting",
            entity_code="health_weights",
            detail=str(normalized),
        )
    )
    db.commit()
    publish_invalidate(["dashboard", "analytics", "system"])
    return {"weights": normalized, "health": health(db), "note": "Weights were normalised to sum to 1.0."}


@router.put("/system/sim-clock")
def update_clock(
    payload: SimClockUpdate,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    current = get_setting(db, "sim_clock", {"running": True, "speed": 1.0})
    if not isinstance(current, dict):
        current = {"running": True, "speed": 1.0}
    if payload.running is not None:
        current["running"] = payload.running
    if payload.speed is not None:
        current["speed"] = payload.speed
    save_setting(db, "sim_clock", current)
    db.add(
        AuditLog(
            actor=actor,
            action="sim_clock_updated",
            entity_type="setting",
            entity_code="sim_clock",
            detail=str(current),
        )
    )
    db.commit()
    twin = twin_state(db)
    publish_twin(twin)
    return {"sim_clock": current, "twin": twin}


@router.get("/system/audit")
def audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog).order_by(AuditLog.ts.desc(), AuditLog.id.desc())
    return paginate(query, page, page_size, audit_out)


@router.post("/system/reset-demo")
def reset(confirm: ResetRequest, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    if confirm.confirm != "RESET":
        raise HTTPException(status_code=422, detail='Type "RESET" to confirm the demo dataset reset')
    reset_demo(db)
    logger.info("Demo dataset reset by %s", actor)
    notify(None, ["ships", "docks", "resources", "containers", "warehouses", "dispatch", "alerts",
                  "maintenance", "simulations", "dashboard", "analytics", "twin", "system"])
    publish_twin(twin_state(db))
    return {"message": "Demo dataset reseeded from the deterministic seed", "seed": settings.sim_seed}
