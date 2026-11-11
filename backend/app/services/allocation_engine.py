"""Explainable, constraint-first allocation engine.

Hard constraints are applied before any scoring. Scoring uses operator-editable
weights stored in app_settings. OR-Tools is intentionally not required: the
solver here is a transparent weighted ranking for a small resource set, which
keeps the demo deterministic and inspectable. The OR-Tools hook can be enabled
later for large multi-job schedules.
"""

from datetime import timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.constants import PRIORITY_WEIGHT, TRUCK_PATHS
from app.core.timeutil import utcnow
from app.models import (
    Assignment,
    Container,
    ContainerEvent,
    Crane,
    Dock,
    Driver,
    Ship,
    Vehicle,
    Warehouse,
)
from app.services.common import (
    get_resource_weights,
    record_audit,
    record_event,
    create_alert_once,
    distance_km,
)


class AllocationError(ValueError):
    pass


LABELS = {
    "availability": "Availability",
    "equipment_health": "Equipment health",
    "fuel": "Fuel / power",
    "capacity_suitability": "Capacity fit",
    "distance_suitability": "Distance fit",
    "suitability": "Berth suitability",
    "priority_fit": "Priority fit",
    "congestion": "Congestion outlook",
    "schedule_fit": "Schedule fit",
}


def _breakdown(values: dict[str, float], weights: dict[str, float]) -> list[dict]:
    rows = []
    for key, raw in values.items():
        weight = weights.get(key, 0)
        rows.append(
            {
                "key": key,
                "label": LABELS.get(key, key.replace("_", " ").title()),
                "value": round(raw, 1),
                "weight": weight,
                "contribution": round(raw * weight, 1),
            }
        )
    return rows


def _dock_center_x(code: str) -> float:
    from app.core.constants import DOCKS

    for slot in DOCKS:
        if slot["code"] == code:
            return slot["x"] + slot["w"] / 2
    return 0.0


def _weighted(values: dict[str, float], weights: dict[str, float]) -> float:
    return round(sum(values.get(k, 0) * w for k, w in weights.items()), 1)


def port_context(db: Session) -> dict[str, Any]:
    docks = db.query(Dock).all()
    occupied = sum(1 for d in docks if d.status == "occupied")
    usable = [d for d in docks if d.status != "maintenance"]
    queue = db.query(Ship).filter(Ship.status.in_(["arrived", "waiting"])).count()
    cranes = db.query(Crane).all()
    avg_crane_health = sum(c.health for c in cranes) / len(cranes) if cranes else 0
    return {
        "occupancy_ratio": (occupied / len(usable)) if usable else 1.0,
        "queue": queue,
        "avg_crane_health": round(avg_crane_health, 1),
        "occupied_docks": occupied,
        "usable_docks": len(usable),
    }


def _dock_score(ship: Ship, dock: Dock, ctx: dict, weights: dict) -> tuple[dict, dict]:
    idle_cranes = [c for c in dock.cranes if c.status == "idle"]
    allowed = [c.strip() for c in dock.allowed_cargo.split(",")]
    cargo_ok = 1.0 if ship.cargo_type in allowed else 0.0
    length_fit = min(1.0, dock.max_length_m / max(ship.vessel_length_m, 1))
    draft_fit = min(1.0, dock.max_draft_m / max(ship.draft_m, 0.1))
    suitability = cargo_ok * 40 + length_fit * 30 + draft_fit * 30

    near_yard = max(0.0, 1 - abs(_dock_center_x(dock.code) - 1000) / 1000)
    crane_ready = 100 if idle_cranes else 55
    priority_bonus = 12 if ship.priority in ("high", "critical") else 0
    priority_fit = min(100.0, 65 + priority_bonus + (10 if crane_ready == 100 else 0) + near_yard * 5)

    congestion = max(
        0.0,
        100 - ctx["occupancy_ratio"] * 55 - ctx["queue"] * 4 - max(0, 70 - ctx["avg_crane_health"]) * 0.4,
    )

    eta_gap_h = (ship.eta - utcnow()).total_seconds() / 3600
    if eta_gap_h > 24:
        schedule_fit = 82.0
    elif eta_gap_h > 6:
        schedule_fit = 92.0
    else:
        schedule_fit = 100.0

    values = {
        "availability": 100.0,
        "suitability": round(suitability, 1),
        "priority_fit": round(priority_fit, 1),
        "congestion": round(congestion, 1),
        "schedule_fit": schedule_fit,
    }
    detail = {
        "cargo_allowed": bool(cargo_ok),
        "length_headroom_m": dock.max_length_m - ship.vessel_length_m,
        "draft_headroom_m": round(dock.max_draft_m - ship.draft_m, 1),
        "idle_cranes": len(idle_cranes),
        "capacity_teu": dock.capacity_teu,
        "status": dock.status,
        "name": dock.name,
    }
    return values, detail


def _dock_reject_reason(ship: Ship, dock: Dock) -> str | None:
    now = utcnow()
    if dock.status == "maintenance" or (dock.maintenance_until and dock.maintenance_until > now):
        until = dock.maintenance_until.strftime("%d %b %H:%M") if dock.maintenance_until else "schedule"
        return f"Berth locked for maintenance until {until}"
    if dock.status == "occupied":
        other = dock.current_ship
        return f"Occupied by {other.code}" if other else "Occupied"
    if dock.current_ship:
        return f"Currently serving {dock.current_ship.code}"
    if ship.cargo_type not in [c.strip() for c in dock.allowed_cargo.split(",")]:
        return f"Cargo class '{ship.cargo_type}' not permitted at this berth"
    if ship.vessel_length_m > dock.max_length_m:
        return f"Vessel LOA {ship.vessel_length_m} m exceeds berth limit {dock.max_length_m} m"
    if ship.draft_m > dock.max_draft_m:
        return f"Vessel draft {ship.draft_m} m exceeds berth draft {dock.max_draft_m} m"
    if ship.cargo_qty > dock.capacity_teu:
        return f"Cargo {ship.cargo_qty} TEU exceeds berth capacity {dock.capacity_teu} TEU"
    return None


def dock_wait_minutes(dock: Dock) -> int:
    now = utcnow()
    if dock.status == "maintenance" and dock.maintenance_until and dock.maintenance_until > now:
        return int((dock.maintenance_until - now).total_seconds() // 60)
    if dock.status == "occupied" and dock.current_ship:
        ship = dock.current_ship
        remaining = max(0.0, ship.handling_hours * (1 - ship.handling_progress / 100))
        return int(remaining * 60)
    return 0


def recommend_docks(db: Session, ship: Ship) -> dict[str, Any]:
    weights = get_resource_weights(db)
    dock_weights = {
        "availability": 0.30,
        "suitability": 0.25,
        "priority_fit": 0.20,
        "congestion": 0.15,
        "schedule_fit": 0.10,
    }
    ctx = port_context(db)
    docks = db.query(Dock).order_by(Dock.code).all()

    scored, rejected = [], []
    for dock in docks:
        reason = _dock_reject_reason(ship, dock)
        if reason:
            rejected.append(
                {
                    "kind": "dock",
                    "code": dock.code,
                    "name": dock.name,
                    "reason": reason,
                    "wait_min": dock_wait_minutes(dock),
                    "status": dock.status,
                }
            )
            continue
        values, detail = _dock_score(ship, dock, ctx, dock_weights)
        score = _weighted(values, dock_weights)
        scored.append(
            {
                "kind": "dock",
                "code": dock.code,
                "name": dock.name,
                "score": score,
                "status": dock.status,
                "breakdown": _breakdown(values, dock_weights),
                "detail": detail,
                "wait_min": 0,
            }
        )
    scored.sort(key=lambda r: r["score"], reverse=True)
    recommended = scored[0] if scored else None
    alternatives = scored[1:4]

    explanation = []
    if recommended:
        d = recommended["detail"]
        explanation.append(
            f"{recommended['code']} ({recommended['name']}) is available with "
            f"{d['idle_cranes']} idle crane(s) and {d['length_headroom_m']} m berth headroom."
        )
        explanation.append(
            f"Berth suitability {recommended['breakdown'][1]['value']}/100 covers "
            f"{ship.cargo_type} cargo, {ship.vessel_length_m} m LOA and {ship.draft_m} m draft."
        )
        explanation.append(
            f"Port congestion is {round(ctx['occupancy_ratio'] * 100)}% across "
            f"{ctx['usable_docks']} usable berths; {ctx['queue']} vessel(s) are awaiting berth."
        )
        if alternatives:
            explanation.append(
                "Held in reserve: "
                + ", ".join(f"{a['code']} ({a['score']}/100)" for a in alternatives)
                + "."
            )
    else:
        explanation.append("No berth satisfies the hard berth constraints right now.")

    return {
        "dock": recommended,
        "alternatives": {a["code"]: a for a in alternatives},
        "rejected": rejected,
        "weights": dock_weights,
        "context": ctx,
        "explanation": explanation,
        "expected_wait_min": recommended["wait_min"] if recommended else 0,
        "resource_weights": weights,
    }


def _crane_candidates(db: Session, dock: Dock | None, required_t: float, weights: dict):
    cranes = db.query(Crane).order_by(Crane.code).all()
    scored, rejected = [], []
    for crane in cranes:
        if crane.status in ("fault", "maintenance"):
            rejected.append({"kind": "crane", "code": crane.code, "reason": f"Unavailable — {crane.status}"})
            continue
        if crane.status == "active":
            rejected.append({"kind": "crane", "code": crane.code, "reason": "Already engaged on an active task"})
            continue
        if dock and crane.dock_id and crane.dock_id != dock.id:
            rejected.append(
                {"kind": "crane", "code": crane.code, "reason": f"Boom cannot reach {dock.code} (home berth {crane.dock.code})"}
            )
            continue
        if crane.health < 40:
            rejected.append(
                {"kind": "crane", "code": crane.code, "reason": f"Health {crane.health:.0f}% below the 40% safe floor"}
            )
            continue
        if crane.capacity_t < required_t * 0.8:
            rejected.append(
                {"kind": "crane", "code": crane.code, "reason": f"Lift capacity {crane.capacity_t:.0f} t insufficient"}
            )
            continue
        values = {
            "availability": 100.0,
            "equipment_health": min(100.0, crane.health),
            "fuel": 100.0,  # shore powered; shown as power availability
            "capacity_suitability": min(100.0, crane.capacity_t / max(required_t, 1) * 100),
            "distance_suitability": 100.0 if dock and crane.dock_id == dock.id else 78.0,
        }
        scored.append(
            {
                "kind": "crane",
                "code": crane.code,
                "name": f"{crane.crane_type} crane",
                "score": _weighted(values, weights),
                "status": crane.status,
                "breakdown": _breakdown(values, weights),
                "detail": {
                    "crane_type": crane.crane_type,
                    "capacity_t": crane.capacity_t,
                    "health": round(crane.health, 1),
                    "dock_code": crane.dock.code if crane.dock else None,
                    "moves_total": crane.moves_total,
                    "fuel": None,
                },
            }
        )
    scored.sort(key=lambda r: r["score"], reverse=True)
    return scored, rejected


def _driver_for(db: Session, vehicle: Vehicle) -> Driver | None:
    driver = vehicle.driver
    if driver and driver.duty_status == "on_duty" and driver.workload < 85:
        return driver
    busy_ids = {v.driver_id for v in db.query(Vehicle).filter(Vehicle.driver_id.isnot(None)).all()}
    query = (
        db.query(Driver)
        .filter(Driver.duty_status == "on_duty", Driver.workload < 85)
        .order_by(Driver.workload, Driver.code)
    )
    for candidate in query.all():
        if candidate.id not in busy_ids:
            return candidate
    return None


def _truck_candidates(db: Session, dock: Dock | None, warehouse: Warehouse | None, weights: dict):
    trucks = db.query(Vehicle).order_by(Vehicle.code).all()
    dist = distance_km(f"d{dock.code[-1]}" if dock else "yard", "wh_a")
    scored, rejected = [], []
    for truck in trucks:
        if truck.status in ("fault", "maintenance"):
            rejected.append({"kind": "truck", "code": truck.code, "reason": f"Unavailable — {truck.status}"})
            continue
        if truck.status != "available":
            rejected.append(
                {"kind": "truck", "code": truck.code, "reason": f"Committed ({truck.current_task or truck.status})"}
            )
            continue
        if truck.fuel < 20:
            rejected.append(
                {"kind": "truck", "code": truck.code, "reason": f"Fuel {truck.fuel:.0f}% below 20% dispatch floor"}
            )
            continue
        if truck.health < 50:
            rejected.append(
                {"kind": "truck", "code": truck.code, "reason": f"Health {truck.health:.0f}% below the 50% floor"}
            )
            continue
        if truck.capacity_t < 20:
            rejected.append({"kind": "truck", "code": truck.code, "reason": "Payload below 20 t"})
            continue
        driver = _driver_for(db, truck)
        if driver is None:
            rejected.append({"kind": "truck", "code": truck.code, "reason": "No qualified on-duty driver available"})
            continue
        values = {
            "availability": 100.0,
            "equipment_health": min(100.0, truck.health),
            "fuel": min(100.0, truck.fuel),
            "capacity_suitability": min(100.0, truck.capacity_t / 26.0 * 100),
            "distance_suitability": max(20.0, 100 - dist * 6),
        }
        scored.append(
            {
                "kind": "truck",
                "code": truck.code,
                "name": "Terminal tractor",
                "score": _weighted(values, weights),
                "status": truck.status,
                "breakdown": _breakdown(values, weights),
                "detail": {
                    "capacity_t": truck.capacity_t,
                    "fuel": round(truck.fuel, 1),
                    "health": round(truck.health, 1),
                    "distance_km": dist,
                    "driver_code": driver.code,
                    "driver_name": driver.name,
                },
                "_driver": driver,
            }
        )
    scored.sort(key=lambda r: r["score"], reverse=True)
    return scored, rejected


def _warehouse_candidates(db: Session, weights: dict):
    warehouses = db.query(Warehouse).order_by(Warehouse.code).all()
    scored, rejected = [], []
    for wh in warehouses:
        if wh.status != "operational":
            rejected.append({"kind": "warehouse", "code": wh.code, "reason": f"Not operational — {wh.status}"})
            continue
        if wh.available <= 0:
            rejected.append({"kind": "warehouse", "code": wh.code, "reason": "No available storage capacity"})
            continue
        values = {
            "availability": min(100.0, wh.available / 120 * 100),
            "equipment_health": 100.0 - wh.utilization * 0.15,
            "fuel": 100.0,
            "capacity_suitability": min(100.0, wh.available / 200 * 100),
            "distance_suitability": 100.0 if wh.code == "WH-A" else 82.0,
        }
        flagged = wh.utilization >= wh.threshold
        scored.append(
            {
                "kind": "warehouse",
                "code": wh.code,
                "name": wh.name,
                "score": _weighted(values, weights),
                "status": wh.status,
                "breakdown": _breakdown(values, weights),
                "detail": {
                    "available_teu": wh.available,
                    "utilization": wh.utilization,
                    "zone": wh.zone,
                    "threshold_flagged": flagged,
                },
                "warning": "Above configured capacity threshold" if flagged else None,
            }
        )
    scored.sort(key=lambda r: r["score"], reverse=True)
    return scored, rejected


def recommend(
    db: Session,
    ship: Ship,
    kind: str = "full",
    dock_code: str | None = None,
    container: Container | None = None,
) -> dict[str, Any]:
    if ship.status == "departed":
        raise AllocationError("Ship has already departed; no allocation required.")
    weights = get_resource_weights(db)

    dock_result = recommend_docks(db, ship)
    chosen_dock = None
    dock_breakdown = None
    dock_rejections: list[dict] = []
    if dock_code:
        dock = db.query(Dock).filter(Dock.code == dock_code).first()
        if not dock:
            raise AllocationError(f"Dock {dock_code} not found")
        reason = _dock_reject_reason(ship, dock)
        if reason and not (ship.dock_id == dock.id):
            raise AllocationError(f"{dock.code} cannot be selected: {reason}")
        ctx = port_context(db)
        values, detail = _dock_score(ship, dock, ctx, dock_result["weights"])
        chosen_dock = {
            "kind": "dock",
            "code": dock.code,
            "name": dock.name,
            "score": _weighted(values, dock_result["weights"]),
            "status": dock.status,
            "breakdown": _breakdown(values, dock_result["weights"]),
            "detail": detail,
            "wait_min": 0,
            "manual": True,
        }
        dock_breakdown = chosen_dock["breakdown"]
        dock_rejections = []
    elif ship.dock_id:
        dock = ship.dock
        chosen_dock = {
            "kind": "dock",
            "code": dock.code,
            "name": dock.name,
            "score": 100.0,
            "status": dock.status,
            "breakdown": [
                {"key": "availability", "label": "Berth secured", "value": 100.0, "weight": 1.0, "contribution": 100.0}
            ],
            "detail": {
                "cargo_allowed": True,
                "length_headroom_m": dock.max_length_m - ship.vessel_length_m,
                "draft_headroom_m": round(dock.max_draft_m - ship.draft_m, 1),
                "idle_cranes": len([c for c in dock.cranes if c.status == "idle"]),
                "capacity_teu": dock.capacity_teu,
                "status": dock.status,
                "name": dock.name,
            },
            "wait_min": 0,
            "secured": True,
        }
        dock_breakdown = chosen_dock["breakdown"]
    elif dock_result["dock"]:
        chosen_dock = dock_result["dock"]
        dock_breakdown = chosen_dock["breakdown"]

    dock_obj = db.query(Dock).filter(Dock.code == chosen_dock["code"]).first() if chosen_dock else None
    required_t = 24.0
    if container:
        required_t = max(8.0, container.weight_t)

    crane_scored, crane_rejected = _crane_candidates(db, dock_obj, required_t, weights)
    crane = crane_scored[0] if crane_scored else None
    crane_alternatives = [c for c in crane_scored[1:4]]

    truck_scored, truck_rejected = _truck_candidates(db, dock_obj, None, weights)
    trucks = truck_scored[:2]
    used_driver_ids = set()
    driver_rows = []
    for truck in trucks:
        driver = truck["_driver"]
        if driver.id in used_driver_ids:
            continue
        used_driver_ids.add(driver.id)
        driver_rows.append(
            {
                "kind": "driver",
                "code": driver.code,
                "name": driver.name,
                "score": round(max(0, 100 - driver.workload * 0.6 - 8 * (driver.workload / 20)), 1),
                "status": driver.duty_status,
                "breakdown": [
                    {"key": "availability", "label": "On duty", "value": 100.0, "weight": 0.5, "contribution": 50.0},
                    {
                        "key": "load",
                        "label": "Workload headroom",
                        "value": round(100 - driver.workload, 1),
                        "weight": 0.5,
                        "contribution": round((100 - driver.workload) * 0.5, 1),
                    },
                ],
                "detail": {
                    "shift": driver.shift,
                    "workload": driver.workload,
                    "vehicle_code": truck["code"],
                    "skills": driver.skills.split(","),
                },
            }
        )
    # remove private driver objects before returning
    public_trucks = [{k: v for k, v in t.items() if k != "_driver"} for t in trucks]

    wh_scored, wh_rejected = _warehouse_candidates(db, weights)
    warehouse = wh_scored[0] if wh_scored else None

    overall_values = []
    if chosen_dock:
        overall_values.append((chosen_dock["score"], 0.35))
    if crane:
        overall_values.append((crane["score"], 0.30))
    if public_trucks:
        overall_values.append((sum(t["score"] for t in public_trucks) / len(public_trucks), 0.25))
    if warehouse:
        overall_values.append((warehouse["score"], 0.10))
    overall = round(sum(v * w for v, w in overall_values), 1) if overall_values else 0.0

    distances = [t["detail"]["distance_km"] for t in public_trucks] or [distance_km("d1", "wh_a")]
    est_travel = round(sum(distances) / len(distances), 1)
    unload_hours = round(ship.cargo_qty / max(36.0 * (1 if crane else 0.5), 1), 1)
    eta_gap_h = round((ship.eta - utcnow()).total_seconds() / 3600, 1)

    explanation = list(dock_result["explanation"]) if not ship.dock_id else [
        f"{chosen_dock['code']} is already secured for {ship.code}."
    ]
    if crane:
        explanation.append(
            f"{crane['code']} selected at {crane['detail']['health']}% health with "
            f"{crane['detail']['capacity_t']} t lift capacity, docked at "
            f"{crane['detail']['dock_code'] or 'the right berth'}."
        )
    else:
        explanation.append("No crane passes the hard compatibility constraints — resolve crane availability before discharge.")
    if public_trucks:
        explanation.append(
            f"{len(public_trucks)} truck(s) paired with on-duty drivers: "
            + ", ".join(f"{t['code']}/{t['detail']['driver_code']}" for t in public_trucks)
            + "."
        )
    else:
        explanation.append("No truck/driver pair passes the fuel, health and duty constraints.")
    if warehouse:
        warning = " (above capacity threshold)" if warehouse.get("warning") else ""
        explanation.append(
            f"{warehouse['code']} offers {warehouse['detail']['available_teu']} TEU of free capacity "
            f"at {warehouse['detail']['utilization']}% utilisation{warning}."
        )

    blockers = []
    if not chosen_dock:
        blockers.append("No eligible berth")
    if not crane:
        blockers.append("No compatible crane")
    if not public_trucks:
        blockers.append("No truck/driver pair")
    if not warehouse:
        blockers.append("No storage capacity")

    rejected_summary = dock_result["rejected"] + crane_rejected + truck_rejected + wh_rejected

    return {
        "ship": {
            "code": ship.code,
            "name": ship.name,
            "status": ship.status,
            "priority": ship.priority,
            "cargo_qty": ship.cargo_qty,
            "cargo_type": ship.cargo_type,
            "eta": ship.eta.isoformat() + "Z" if ship.eta else None,
            "dock_code": ship.dock.code if ship.dock else None,
        },
        "kind": kind,
        "container_code": container.code if container else None,
        "dock": chosen_dock,
        "crane": crane,
        "trucks": public_trucks,
        "drivers": driver_rows,
        "warehouse": warehouse,
        "alternatives": {
            "dock": list(dock_result["alternatives"].values()),
            "crane": crane_alternatives,
            "truck": [t for t in truck_scored[2:6]],
            "warehouse": wh_scored[1:3],
        },
        "rejected": rejected_summary[:12],
        "weights": {"resource": weights, "dock": dock_result["weights"]},
        "overall_score": overall,
        "blockers": blockers,
        "expected_wait_min": (chosen_dock or {}).get("wait_min", 0),
        "eta_gap_hours": eta_gap_h,
        "estimated_travel_km": est_travel,
        "expected_impact": {
            "discharge_hours": unload_hours,
            "container_cycle_min": round(18 + est_travel * 2.4, 0),
            "crane_move_rate": "36 moves/h" if crane else "blocked",
            "priority_weight": PRIORITY_WEIGHT.get(ship.priority, 1.0),
            "note": "Illustrative terminal model — not a measured performance claim.",
        },
        "explanation": explanation,
        "generated_at": utcnow().isoformat() + "Z",
    }


def _refresh_ship_status(ship: Ship) -> None:
    if ship.status in ("approaching", "arrived", "waiting"):
        ship.status = "docked"
        if ship.arrived_at is None:
            ship.arrived_at = utcnow()


def accept(
    db: Session,
    payload,
    actor: str,
    source: str | None = None,
) -> dict[str, Any]:
    """Persist an operator decision after re-validating every hard constraint."""
    ship = db.query(Ship).filter(Ship.code == payload.ship_code).first()
    if not ship:
        raise AllocationError(f"Ship {payload.ship_code} not found")
    if ship.status == "departed":
        raise AllocationError("Cannot allocate a departed vessel")

    dock = None
    if payload.dock_code:
        dock = db.query(Dock).filter(Dock.code == payload.dock_code).first()
        if not dock:
            raise AllocationError(f"Dock {payload.dock_code} not found")
        if ship.dock_id and ship.dock_id != dock.id:
            raise AllocationError(f"Ship is already secured at {ship.dock.code}; release it before re-berthing")
        if dock.status == "maintenance" or (dock.maintenance_until and dock.maintenance_until > utcnow()):
            raise AllocationError(f"{dock.code} is locked for maintenance")
        if dock.status == "occupied" and dock.current_ship and dock.current_ship.id != ship.id:
            raise AllocationError(f"{dock.code} is occupied by {dock.current_ship.code}")
        reason = _dock_reject_reason(ship, dock)
        if reason and dock.current_ship is None:
            raise AllocationError(reason)

    crane = None
    if payload.crane_code:
        crane = db.query(Crane).filter(Crane.code == payload.crane_code).first()
        if not crane:
            raise AllocationError(f"Crane {payload.crane_code} not found")
        if crane.status in ("fault", "maintenance"):
            raise AllocationError(f"{crane.code} is unavailable ({crane.status})")
        if not dock:
            raise AllocationError("Crane assignment requires a selected berth")
        if crane.dock_id and crane.dock_id != dock.id:
            raise AllocationError(f"{crane.code} cannot service {dock.code}")
        existing = (
            db.query(Assignment)
            .filter(Assignment.kind == "crane", Assignment.resource_code == crane.code, Assignment.status == "active")
            .first()
        )
        if existing and (not existing.ship or existing.ship.code != ship.code):
            raise AllocationError(f"{crane.code} already holds an active assignment")
        if crane.status == "active" and not existing:
            raise AllocationError(f"{crane.code} is already engaged on an active task")

    trucks: list[Vehicle] = []
    for code in payload.truck_codes:
        truck = db.query(Vehicle).filter(Vehicle.code == code).first()
        if not truck:
            raise AllocationError(f"Truck {code} not found")
        if truck.status in ("fault", "maintenance"):
            raise AllocationError(f"{code} is unavailable ({truck.status})")
        if truck.fuel < 20:
            raise AllocationError(f"{code} fuel {truck.fuel:.0f}% is below the 20% dispatch floor")
        if truck.health < 50:
            raise AllocationError(f"{code} health {truck.health:.0f}% is below the 50% floor")
        conflicting = (
            db.query(Assignment)
            .filter(
                Assignment.kind == "vehicle",
                Assignment.resource_code == code,
                Assignment.status == "active",
            )
            .first()
        )
        if conflicting and (not conflicting.ship or conflicting.ship.code != ship.code):
            raise AllocationError(f"{code} is double-booked on another task")
        if truck.status != "available" and not conflicting:
            raise AllocationError(f"{code} is not available ({truck.status})")
        trucks.append(truck)

    drivers: list[Driver] = []
    for code in payload.driver_codes:
        driver = db.query(Driver).filter(Driver.code == code).first()
        if not driver:
            raise AllocationError(f"Driver {code} not found")
        if driver.duty_status != "on_duty":
            raise AllocationError(f"Driver {code} is {driver.duty_status}")
        other_vehicle = db.query(Vehicle).filter(Vehicle.driver_id == driver.id).first()
        if other_vehicle and other_vehicle.code not in payload.truck_codes:
            raise AllocationError(f"Driver {code} is already on {other_vehicle.code}")
        drivers.append(driver)

    warehouse = None
    if payload.warehouse_code:
        warehouse = db.query(Warehouse).filter(Warehouse.code == payload.warehouse_code).first()
        if not warehouse:
            raise AllocationError(f"Warehouse {payload.warehouse_code} not found")
        if warehouse.status != "operational":
            raise AllocationError(f"{warehouse.code} is not operational")
        if warehouse.available <= 0:
            raise AllocationError(f"{warehouse.code} has no available capacity")

    # ---- persist -----------------------------------------------------------
    now = utcnow()
    score = payload.score or 0.0
    resolved_source = source or payload.source or "optimizer"
    created: list[Assignment] = []

    def add_assignment(kind: str, code: str, resource_id: int | None) -> None:
        active = (
            db.query(Assignment)
            .filter(
                Assignment.kind == kind,
                Assignment.resource_code == code,
                Assignment.status == "active",
                Assignment.ship_id == ship.id,
            )
            .first()
        )
        if active:
            return
        row = Assignment(
            kind=kind,
            resource_code=code,
            resource_id=resource_id,
            ship_id=ship.id,
            score=score,
            source=resolved_source,
            explanation=payload.explanation,
            created_by=actor,
        )
        db.add(row)
        created.append(row)

    if dock:
        previous_ship_dock = ship.dock
        if previous_ship_dock and previous_ship_dock.id != dock.id:
            previous_ship_dock.status = "available"
        ship.dock_id = dock.id
        dock.status = "occupied"
        add_assignment("dock", dock.code, dock.id)
    _refresh_ship_status(ship)

    if crane:
        crane.status = "active"
        crane.dock_id = dock.id if dock else crane.dock_id
        crane.utilization = max(crane.utilization, 55.0)
        add_assignment("crane", crane.code, crane.id)

    for idx, truck in enumerate(trucks):
        truck.status = "assigned"
        truck.current_task = f"Discharge support · {ship.code}"
        truck.route_key = f"d{dock.code[-1]}" if dock else "gate"
        truck.route_phase = round(0.05 + idx * 0.08, 2)
        if idx < len(drivers):
            truck.driver_id = drivers[idx].id
            drivers[idx].workload = min(100.0, drivers[idx].workload + 12)
            add_assignment("driver", drivers[idx].code, drivers[idx].id)
        add_assignment("vehicle", truck.code, truck.id)

    if warehouse:
        add_assignment("warehouse", warehouse.code, warehouse.id)

    if payload.container_code:
        container = db.query(Container).filter(Container.code == payload.container_code).first()
        if not container:
            raise AllocationError(f"Container {payload.container_code} not found")
        if container.ship_id and ship.id != container.ship_id:
            raise AllocationError("Container does not belong to this vessel")
        if container.status != "waiting":
            raise AllocationError(f"Container {container.code} is {container.status}, not awaiting allocation")
        previous = container.status
        container.status = "allocated"
        container.crane_id = crane.id if crane else None
        container.vehicle_id = trucks[0].id if trucks else None
        container.warehouse_id = warehouse.id if warehouse else None
        container.location = f"Quay assignment · {dock.code if dock else 'pending'}"
        db.add(
            ContainerEvent(
                container_id=container.id,
                from_status=previous,
                to_status="allocated",
                note=f"Optimizer allocation accepted ({resolved_source})",
                actor=actor,
            )
        )

    explanation = payload.explanation or payload.reason or "Operator-approved allocation"
    detail = (
        f"dock={dock.code if dock else '-'}; crane={crane.code if crane else '-'}; "
        f"trucks={','.join(t.code for t in trucks) or '-'}; score={score}"
    )
    record_audit(
        db,
        actor=actor,
        action="allocation_accepted" if resolved_source == "optimizer" else "allocation_override",
        entity_type="ship",
        entity_code=ship.code,
        detail=detail,
    )
    event = record_event(
        db,
        type="allocation_accepted" if resolved_source == "optimizer" else "allocation_override",
        severity="info",
        title=f"{ship.code} allocation {'accepted' if resolved_source == 'optimizer' else 'overridden'}",
        message=(
            f"{ship.code} secured at {dock.code if dock else 'existing berth'}"
            + (f" with {crane.code}" if crane else "")
            + (f" and {len(trucks)} truck(s)" if trucks else "")
            + f". Source: {resolved_source}."
        ),
        entity_type="ship",
        entity_code=ship.code,
        payload={"detail": detail, "explanation": explanation},
    )

    if dock and dock.status == "occupied" and crane is None:
        create_alert_once(
            db,
            severity="info",
            category="berth_without_crane",
            title=f"{ship.code} berthed without a crane",
            message=f"{ship.code} is secured at {dock.code}. Assign a crane before starting discharge.",
            entity_type="ship",
            entity_code=ship.code,
        )

    db.commit()
    db.refresh(ship)

    from app.services.serializers import assignment_out, ship_out

    return {
        "message": "Allocation persisted",
        "ship": ship_out(ship),
        "assignments": [assignment_out(row) for row in created],
        "event": event,
    }


def release_ship_assignments(db: Session, ship: Ship, actor: str) -> None:
    now = utcnow()
    active = db.query(Assignment).filter(Assignment.ship_id == ship.id, Assignment.status == "active").all()
    crane_codes = [row.resource_code for row in active if row.kind == "crane"]
    truck_codes = [row.resource_code for row in active if row.kind == "vehicle"]
    for row in active:
        row.status = "released"
        row.released_at = now
    if ship.dock:
        ship.dock.status = "available"
    if crane_codes:
        for crane in db.query(Crane).filter(Crane.code.in_(crane_codes)).all():
            crane.status = "idle"
            crane.utilization = max(0.0, crane.utilization - 25)
    if truck_codes:
        for truck in db.query(Vehicle).filter(Vehicle.code.in_(truck_codes)).all():
            truck.status = "available"
            truck.current_task = None
            truck.route_key = None
            truck.route_phase = 0.0
    ship.dock_id = None
    record_audit(
        db,
        actor=actor,
        action="allocation_released",
        entity_type="ship",
        entity_code=ship.code,
        detail=f"Released {len(active)} active assignment(s)",
    )
