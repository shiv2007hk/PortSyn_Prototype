import asyncio
import logging
import random
from datetime import datetime

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.timeutil import utcnow
from app.models import Assignment, Container, ContainerEvent, Crane, Ship, Vehicle
from app.services import digital_twin
from app.services.common import get_setting, record_event
from app.services.maintenance_engine import scan_operational_alerts
from app.services.serializers import event_out
from app.websocket.manager import publish_event, publish_invalidate, publish_twin

logger = logging.getLogger("portsync.ticker")

_state = {"tick": 0, "last_scan_tick": -100}


def tick_count() -> int:
    return _state["tick"]


def _finish_discharge(db, ship: Ship) -> dict:
    ship.handling_progress = 100.0
    ship.status = "docked"
    for row in (
        db.query(Assignment)
        .filter(Assignment.ship_id == ship.id, Assignment.kind == "crane", Assignment.status == "active")
        .all()
    ):
        row.status = "released"
        row.released_at = utcnow()
        crane = db.query(Crane).filter(Crane.code == row.resource_code).first()
        if crane:
            crane.status = "idle"
    return record_event(
        db,
        type="unloading_complete",
        title=f"Discharge complete · {ship.code}",
        message=f"{ship.code} has landed all cargo. Crane released; awaiting departure clearance.",
        entity_type="ship",
        entity_code=ship.code,
    )


def tick_once() -> None:
    db = SessionLocal()
    try:
        clock = get_setting(db, "sim_clock", {"running": settings.sim_enabled, "speed": 1.0})
        if not isinstance(clock, dict) or not clock.get("running", True):
            db.commit()
            return
        speed = max(0.25, min(3.0, float(clock.get("speed", 1.0))))
        _state["tick"] += 1
        tick = _state["tick"]
        created_events = []

        for ship in db.query(Ship).filter(Ship.status == "unloading").all():
            ship.handling_progress = min(100.0, ship.handling_progress + 0.7 * speed)
            if ship.handling_progress >= 100:
                created_events.append(_finish_discharge(db, ship))

        for vehicle in db.query(Vehicle).filter(Vehicle.status.in_(["assigned", "in_transit"])).all():
            if not vehicle.route_key:
                continue
            vehicle.route_phase = (vehicle.route_phase + 0.045 * speed) % 1.0
            vehicle.odometer_km = round(vehicle.odometer_km + 0.18 * speed, 2)
            vehicle.fuel = max(0.0, round(vehicle.fuel - 0.03 * speed, 2))

        for crane in db.query(Crane).all():
            if crane.status == "active":
                crane.utilization = min(98.0, crane.utilization + 0.08 * speed)
            elif crane.status in ("idle",):
                crane.utilization = max(0.0, crane.utilization - 0.02 * speed)

        if tick - _state["last_scan_tick"] >= 12:
            _state["last_scan_tick"] = tick
            alerts = scan_operational_alerts(db)
            if alerts:
                publish_invalidate(["alerts", "dashboard", "maintenance"])

        rng = random.Random(settings.sim_seed + tick)
        if tick % 15 == 0:
            moving = db.query(Vehicle).filter(Vehicle.status == "in_transit").all()
            if moving:
                vehicle = moving[rng.randrange(len(moving))]
                created_events.append(
                    record_event(
                        db,
                        type="truck_movement",
                        title=f"{vehicle.code} cleared the gate corridor",
                        message=(
                            f"{vehicle.code} is carrying cargo toward {vehicle.current_task or 'dispatch'} "
                            f"(simulated telemetry)."
                        ),
                        entity_type="vehicle",
                        entity_code=vehicle.code,
                    )
                )
            waiting = (
                db.query(Container)
                .filter(Container.status == "waiting")
                .order_by(Container.created_at)
                .first()
            )
            if waiting and tick % 45 == 0:
                db.add(
                    ContainerEvent(
                        container_id=waiting.id,
                        from_status="waiting",
                        to_status="waiting",
                        note="Queue heartbeat · simulator",
                        actor="simulator",
                    )
                )

        db.commit()
        twin = digital_twin.state(db)
        publish_twin(twin)
        for event in created_events:
            publish_event(event_out(event), ["ships", "dashboard", "twin", "containers"])
    except Exception:  # pragma: no cover - background safety
        logger.exception("simulation tick failed")
        db.rollback()
    finally:
        db.close()


async def ticker_loop() -> None:
    interval = max(2.0, settings.sim_tick_seconds)
    logger.info("Simulation ticker started (%.1fs)", interval)
    while True:
        await asyncio.sleep(interval)
        await asyncio.to_thread(tick_once)
