import json
from datetime import timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.constants import DEFAULT_HEALTH_WEIGHTS, DEFAULT_RESOURCE_WEIGHTS
from app.core.timeutil import utcnow
from app.models import Alert, AuditLog, OperationalEvent, User
from app.models.user import AppSetting
from app.services.serializers import event_out


def get_setting(db: Session, key: str, default: Any) -> Any:
    row = db.get(AppSetting, key)
    if not row:
        return default
    try:
        return json.loads(row.value)
    except (TypeError, ValueError):
        return default


def save_setting(db: Session, key: str, value: Any) -> None:
    row = db.get(AppSetting, key)
    if not row:
        row = AppSetting(key=key, value=json.dumps(value))
        db.add(row)
    else:
        row.value = json.dumps(value)
        row.updated_at = utcnow()


def get_health_weights(db: Session) -> dict[str, float]:
    stored = get_setting(db, "health_weights", None)
    if not isinstance(stored, dict):
        return dict(DEFAULT_HEALTH_WEIGHTS)
    return {k: float(stored.get(k, v)) for k, v in DEFAULT_HEALTH_WEIGHTS.items()}


def get_resource_weights(db: Session) -> dict[str, float]:
    stored = get_setting(db, "resource_weights", None)
    if not isinstance(stored, dict):
        return dict(DEFAULT_RESOURCE_WEIGHTS)
    return {k: float(stored.get(k, v)) for k, v in DEFAULT_RESOURCE_WEIGHTS.items()}


def actor_from_user(db: Session, actor: str | None) -> str:
    if actor:
        return actor[:60]
    user = db.query(User).first()
    return user.name if user else "Demo Supervisor"


def record_event(
    db: Session,
    *,
    type: str,
    title: str,
    message: str,
    severity: str = "info",
    entity_type: str | None = None,
    entity_code: str | None = None,
    payload: dict | None = None,
    ts=None,
) -> OperationalEvent:
    event = OperationalEvent(
        type=type,
        severity=severity,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_code=entity_code,
        payload=payload,
        ts=ts or utcnow(),
    )
    db.add(event)
    db.flush()
    return event


def record_audit(
    db: Session,
    *,
    actor: str,
    action: str,
    entity_type: str,
    entity_code: str,
    detail: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_code=entity_code,
        detail=detail,
    )
    db.add(entry)
    return entry


def create_alert_once(
    db: Session,
    *,
    severity: str,
    category: str,
    title: str,
    message: str,
    entity_type: str | None = None,
    entity_code: str | None = None,
    source: str = "engine",
) -> Alert | None:
    """Deduplicate active alerts on (category, entity_code)."""
    existing = (
        db.query(Alert)
        .filter(
            Alert.category == category,
            Alert.entity_code == entity_code,
            Alert.status.in_(["active", "acknowledged"]),
        )
        .first()
    )
    if existing:
        return None
    alert = Alert(
        severity=severity,
        category=category,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_code=entity_code,
        source=source,
    )
    db.add(alert)
    db.flush()
    return alert


def event_payload(event: OperationalEvent) -> dict:
    return event_out(event)


def hours_since(dt) -> float | None:
    if not dt:
        return None
    return round((utcnow() - dt).total_seconds() / 3600, 1)


def fmt_hours(hours: float) -> str:
    if hours < 1:
        return f"{int(hours * 60)} min"
    return f"{hours:.1f} h"


def distance_km(a: str, b: str) -> float:
    """Approximate terminal road distance between two layout nodes."""
    from app.core.constants import ROAD_NODES

    ax, ay = ROAD_NODES.get(a, (0, 0))
    bx, by = ROAD_NODES.get(b, (0, 0))
    return round((abs(ax - bx) + abs(ay - by)) / 55.0, 1)


def eta_window(ship) -> timedelta:
    return ship.eta - utcnow() if ship.eta else timedelta(0)
