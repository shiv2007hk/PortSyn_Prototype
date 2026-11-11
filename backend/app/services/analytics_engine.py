import csv
import io
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.timeutil import utcnow
from app.models import (
    Alert,
    Container,
    ContainerEvent,
    Crane,
    Dispatch,
    Dock,
    Driver,
    OperationalEvent,
    Ship,
    Vehicle,
    Warehouse,
)
from app.services.common import get_health_weights
from app.services.serializers import (
    alert_out,
    dispatch_out,
    dock_out,
    event_out,
    ship_out,
    vehicle_out,
    warehouse_out,
)

HEALTH_LABELS = {
    "dock_congestion": "Dock congestion",
    "resource_availability": "Resource availability",
    "equipment_health": "Equipment health",
    "container_backlog": "Container backlog",
    "dispatch_performance": "Dispatch performance",
}


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 1) if values else 0.0


def _counts(db: Session) -> dict[str, Any]:
    docks = db.query(Dock).all()
    cranes = db.query(Crane).all()
    vehicles = db.query(Vehicle).all()
    drivers = db.query(Driver).all()
    ships = db.query(Ship).all()
    containers = db.query(Container).all()
    warehouses = db.query(Warehouse).all()
    dispatches = db.query(Dispatch).all()
    alerts = db.query(Alert).filter(Alert.status.in_(["active", "acknowledged"])).all()
    active_containers = [c for c in containers if c.status != "delivered"]

    usable_docks = [d for d in docks if d.status != "maintenance"]
    occupied_docks = [d for d in usable_docks if d.status == "occupied"]
    queue = [c for c in containers if c.status in ("waiting", "allocated")]
    idle_cranes = [c for c in cranes if c.status == "idle"]
    active_cranes = [c for c in cranes if c.status == "active"]
    available_trucks = [v for v in vehicles if v.status == "available"]
    on_duty = [d for d in drivers if d.duty_status == "on_duty"]
    assigned_driver_ids = {v.driver_id for v in vehicles if v.driver_id}
    total_wh_capacity = sum(w.capacity_teu for w in warehouses) or 1
    total_wh_occupancy = sum(w.occupancy for w in warehouses)
    pending_dispatches = [d for d in dispatches if d.status in ("pending", "scheduled", "in_transit")]

    return {
        "docks": docks,
        "usable_docks": usable_docks,
        "occupied_docks": occupied_docks,
        "cranes": cranes,
        "idle_cranes": idle_cranes,
        "active_cranes": active_cranes,
        "vehicles": vehicles,
        "available_trucks": available_trucks,
        "drivers": drivers,
        "on_duty": on_duty,
        "assigned_driver_ids": assigned_driver_ids,
        "ships": ships,
        "containers": containers,
        "active_containers": active_containers,
        "queue": queue,
        "warehouses": warehouses,
        "dispatches": dispatches,
        "pending_dispatches": pending_dispatches,
        "alerts": alerts,
        "total_wh_capacity": total_wh_capacity,
        "total_wh_occupancy": total_wh_occupancy,
    }


def health(db: Session) -> dict[str, Any]:
    c = _counts(db)
    weights = get_health_weights(db)
    ratio = len(c["occupied_docks"]) / len(c["usable_docks"]) if c["usable_docks"] else 1.0
    components_map = {
        "dock_congestion": round(max(0.0, 100 - ratio * 100), 1),
        "resource_availability": round(
            _avg(
                [
                    len(c["idle_cranes"]) / max(len(c["cranes"]), 1) * 100,
                    len(c["available_trucks"]) / max(len(c["vehicles"]), 1) * 100,
                    len(c["on_duty"]) / max(len(c["drivers"]), 1) * 100,
                    len(c["usable_docks"]) - len(c["occupied_docks"]) and 100 or 0,
                ]
            ),
            1,
        ),
        "equipment_health": round(
            _avg([x.health for x in c["cranes"]] + [x.health for x in c["vehicles"]]), 1
        ),
        "container_backlog": round(max(0.0, 100 - len(c["queue"]) * 0.4), 1),
        "dispatch_performance": round(
            max(
                0.0,
                100
                - len(c["pending_dispatches"]) * 3
                - sum(
                    1
                    for d in c["dispatches"]
                    if d.status in ("pending", "scheduled") and d.scheduled_departure < utcnow()
                )
                * 8,
            ),
            1,
        ),
    }
    components = []
    score = 0.0
    for key, weight in weights.items():
        value = components_map[key]
        contribution = round(value * weight, 1)
        score += contribution
        components.append(
            {
                "key": key,
                "label": HEALTH_LABELS[key],
                "value": value,
                "weight": weight,
                "contribution": contribution,
            }
        )
    score = round(score, 1)
    grade = "Excellent" if score >= 85 else "Stable" if score >= 70 else "Strained" if score >= 55 else "Critical"
    return {
        "score": score,
        "grade": grade,
        "components": components,
        "weights": weights,
        "formula": "Port health = Σ(component score × weight). Weights are operator-configurable and persisted in app_settings.",
    }


def _day_start(value: datetime) -> datetime:
    return value.replace(hour=0, minute=0, second=0, microsecond=0)


def _period_series(db: Session, days: int) -> list[dict]:
    today = _day_start(utcnow())
    start = today - timedelta(days=days - 1)
    buckets: dict[date, dict] = {}
    for offset in range(days):
        day = (start + timedelta(days=offset)).date()
        buckets[day] = {"date": day.isoformat(), "arrivals": 0, "throughput": 0, "dispatches": 0, "alerts": 0}

    for event in db.query(OperationalEvent).filter(OperationalEvent.ts >= start).all():
        day = event.ts.date()
        if day in buckets and event.type == "ship_arrived":
            buckets[day]["arrivals"] += 1
    for event in (
        db.query(ContainerEvent)
        .filter(ContainerEvent.ts >= start, ContainerEvent.to_status == "delivered")
        .all()
    ):
        day = event.ts.date()
        if day in buckets:
            buckets[day]["throughput"] += 1
    for dispatch in db.query(Dispatch).filter(Dispatch.completed_at >= start).all():
        day = dispatch.completed_at.date()
        if day in buckets:
            buckets[day]["dispatches"] += 1
    for alert in db.query(Alert).filter(Alert.created_at >= start).all():
        day = alert.created_at.date()
        if day in buckets:
            buckets[day]["alerts"] += 1
    return list(buckets.values())


def _aggregate(rows: list[dict], granularity: str) -> list[dict]:
    if granularity != "week":
        return rows
    grouped: dict[str, dict] = {}
    for row in rows:
        d = date.fromisoformat(row["date"])
        week_start = d - timedelta(days=d.weekday())
        key = week_start.isoformat()
        if key not in grouped:
            grouped[key] = {
                "date": key,
                "label": f"W{week_start.isocalendar().week}",
                "arrivals": 0,
                "throughput": 0,
                "dispatches": 0,
                "alerts": 0,
            }
        for k in ("arrivals", "throughput", "dispatches", "alerts"):
            grouped[key][k] += row[k]
    return list(grouped.values())


def kpi_metrics(db: Session, days: int = 7) -> dict[str, Any]:
    c = _counts(db)
    now = utcnow()
    start = _day_start(now) - timedelta(days=days - 1)
    turned = [s for s in c["ships"] if s.arrived_at and s.departed_at]
    turnaround_values = [(s.departed_at - s.arrived_at).total_seconds() / 3600 for s in turned]
    waiting_values = []
    for ctr in c["containers"]:
        if ctr.status in ("waiting", "allocated") and ctr.created_at:
            waiting_values.append((now - ctr.created_at).total_seconds() / 3600)
    delivered_events = (
        db.query(ContainerEvent)
        .filter(ContainerEvent.ts >= start, ContainerEvent.to_status == "delivered")
        .count()
    )
    completed_dispatches = [d for d in c["dispatches"] if d.completed_at and d.completed_at >= start]
    delay_values = [
        max(0.0, (d.completed_at - d.scheduled_departure).total_seconds() / 3600) for d in completed_dispatches
    ]
    fuel_litres = round(sum(v.odometer_km for v in c["vehicles"]) * 0.32, 1)
    crane_util = _avg([x.utilization for x in c["cranes"]])
    truck_util = round(
        sum(1 for v in c["vehicles"] if v.status in ("assigned", "in_transit")) / max(len(c["vehicles"]), 1) * 100,
        1,
    )
    driver_util = round(
        len([d for d in c["on_duty"] if d.id in c["assigned_driver_ids"]]) / max(len(c["on_duty"]), 1) * 100, 1
    )
    return {
        "ship_turnaround_h": _avg(turnaround_values),
        "container_wait_h": _avg(waiting_values),
        "dock_occupancy_pct": round(
            len(c["occupied_docks"]) / max(len(c["usable_docks"]), 1) * 100, 1
        ),
        "crane_util_pct": crane_util,
        "truck_util_pct": truck_util,
        "driver_util_pct": driver_util,
        "throughput_per_day": round(delivered_events / days, 1),
        "warehouse_occupancy_pct": round(c["total_wh_occupancy"] / c["total_wh_capacity"] * 100, 1),
        "dispatch_delay_h": _avg(delay_values),
        "fuel_estimate_l": fuel_litres,
        "containers_delivered": delivered_events,
        "containers_waiting": len(c["queue"]),
        "containers_waiting_24h": sum(1 for x in waiting_values if x > 24),
        "active_alerts": len(c["alerts"]),
        "open_dispatches": len(c["pending_dispatches"]),
        "ships_total": sum(1 for s in c["ships"] if s.status != "departed"),
        "ships_active": sum(1 for s in c["ships"] if s.status in ("docked", "unloading")),
        "ships_arriving": sum(1 for s in c["ships"] if s.status in ("approaching", "arrived")),
        "available_docks": len(c["usable_docks"]) - len(c["occupied_docks"]),
        "active_cranes": len(c["active_cranes"]),
        "available_trucks": len(c["available_trucks"]),
        "available_drivers": len(c["on_duty"]),
    }


def dashboard(db: Session) -> dict[str, Any]:
    c = _counts(db)
    metrics = kpi_metrics(db, 7)
    series = _period_series(db, 7)
    health_data = health(db)
    recent = (
        db.query(OperationalEvent)
        .order_by(OperationalEvent.ts.desc(), OperationalEvent.id.desc())
        .limit(14)
        .all()
    )
    pending = sorted(c["pending_dispatches"], key=lambda d: d.scheduled_departure)[:5]
    ships_by_status: dict[str, int] = defaultdict(int)
    for ship in c["ships"]:
        ships_by_status[ship.status] += 1
    severity_counts = {"critical": 0, "warning": 0, "info": 0}
    for alert in c["alerts"]:
        severity_counts[alert.severity] = severity_counts.get(alert.severity, 0) + 1

    kpis = [
        {"key": "ships_total", "label": "Total ships", "value": metrics["ships_total"], "unit": "", "hint": "Non-departed vessels in the plan"},
        {"key": "ships_arriving", "label": "Arriving", "value": metrics["ships_arriving"], "unit": "", "hint": "Approaching or at anchorage"},
        {"key": "ships_active", "label": "Active ships", "value": metrics["ships_active"], "unit": "", "hint": "Docked or discharging"},
        {"key": "available_docks", "label": "Available docks", "value": metrics["available_docks"], "unit": "", "hint": "Usable berths ready now"},
        {"key": "dock_occupancy", "label": "Dock occupancy", "value": metrics["dock_occupancy_pct"], "unit": "%", "hint": "Occupied vs usable berths"},
        {"key": "active_cranes", "label": "Active cranes", "value": metrics["active_cranes"], "unit": "", "hint": "Currently working a vessel"},
        {"key": "available_trucks", "label": "Available trucks", "value": metrics["available_trucks"], "unit": "", "hint": "Cleared for new dispatch"},
        {"key": "available_drivers", "label": "Available drivers", "value": metrics["available_drivers"], "unit": "", "hint": "Drivers on duty"},
        {"key": "containers_in_queue", "label": "Containers in queue", "value": metrics["containers_waiting"], "unit": "", "hint": "Waiting or allocated"},
        {"key": "warehouse_occupancy", "label": "Warehouse occupancy", "value": metrics["warehouse_occupancy_pct"], "unit": "%", "hint": "Weighted across warehouses"},
    ]

    return {
        "generated_at": utcnow().isoformat() + "Z",
        "kpis": kpis,
        "summary": metrics,
        "health": health_data,
        "activity": [event_out(e) for e in recent],
        "charts": {
            "arrivals_7d": series,
            "utilization": [
                {"name": "Cranes", "value": metrics["crane_util_pct"]},
                {"name": "Trucks", "value": metrics["truck_util_pct"]},
                {"name": "Drivers", "value": metrics["driver_util_pct"]},
                {"name": "Docks", "value": metrics["dock_occupancy_pct"]},
                {"name": "Warehouses", "value": metrics["warehouse_occupancy_pct"]},
            ],
            "dock_status": [dock_out(d) for d in c["docks"]],
            "ships_by_status": dict(ships_by_status),
            "alerts_by_severity": severity_counts,
            "pending_dispatches": [dispatch_out(d) for d in pending],
            "warehouses": [warehouse_out(w) for w in c["warehouses"]],
        },
        "data_note": "All operational values are generated by the PortSync synthetic simulator for demonstration.",
    }


def bottlenecks(db: Session) -> list[dict]:
    c = _counts(db)
    rows: list[dict] = []
    unhealthy = [x for x in c["cranes"] if x.health < 60]
    if unhealthy:
        rows.append(
            {
                "title": f"{len(unhealthy)} crane(s) below 60% health",
                "severity": "critical" if any(x.health < 50 for x in unhealthy) else "warning",
                "detail": ", ".join(f"{x.code} {x.health:.0f}%" for x in unhealthy[:4]),
            }
        )
    low_fuel = [v for v in c["vehicles"] if v.fuel < 20]
    if low_fuel:
        rows.append(
            {
                "title": f"{len(low_fuel)} truck(s) below the 20% fuel floor",
                "severity": "warning",
                "detail": ", ".join(f"{v.code} {v.fuel:.0f}%" for v in low_fuel[:4]),
            }
        )
    constrained = [w for w in c["warehouses"] if w.utilization >= w.threshold]
    if constrained:
        rows.append(
            {
                "title": f"{len(constrained)} warehouse(s) above capacity threshold",
                "severity": "critical" if any(w.utilization >= 95 for w in constrained) else "warning",
                "detail": ", ".join(f"{w.code} {w.utilization}%" for w in constrained),
            }
        )
    stale = [ctr for ctr in c["queue"] if ctr.created_at and (utcnow() - ctr.created_at) > timedelta(hours=24)]
    if stale:
        rows.append(
            {
                "title": f"{len(stale)} container(s) waiting > 24 h",
                "severity": "warning",
                "detail": "Queue ageing — prioritise discharge-to-yard moves.",
            }
        )
    overdue = [
        d for d in c["dispatches"] if d.status in ("pending", "scheduled") and d.scheduled_departure < utcnow()
    ]
    if overdue:
        rows.append(
            {
                "title": f"{len(overdue)} dispatch(es) overdue",
                "severity": "warning",
                "detail": ", ".join(d.code for d in overdue[:4]),
            }
        )
    maintenance_docks = [d for d in c["docks"] if d.status == "maintenance"]
    if maintenance_docks:
        rows.append(
            {
                "title": f"{len(maintenance_docks)} berth(s) in maintenance",
                "severity": "info",
                "detail": ", ".join(d.code for d in maintenance_docks),
            }
        )
    if not rows:
        rows.append(
            {
                "title": "No material bottlenecks detected",
                "severity": "info",
                "detail": "All monitored resources are inside their configured operating bands.",
            }
        )
    return rows[:6]


def analytics(db: Session, days: int = 7, granularity: str = "day") -> dict[str, Any]:
    metrics = kpi_metrics(db, days)
    series = _period_series(db, days)
    aggregated = _aggregate(series, granularity)
    health_data = health(db)
    completed = [
        d
        for d in db.query(Dispatch).all()
        if d.status == "completed" and d.completed_at
    ]
    avg_delay = metrics["dispatch_delay_h"]
    baseline_turnaround = round((metrics["ship_turnaround_h"] or 11.8) * 1.18, 1)
    optimized_turnaround = round(metrics["ship_turnaround_h"] or 11.8, 1)
    return {
        "generated_at": utcnow().isoformat() + "Z",
        "period": {
            "days": days,
            "granularity": granularity,
            "from": series[0]["date"] if series else None,
            "to": series[-1]["date"] if series else None,
        },
        "kpis": [
            {"key": "turnaround", "label": "Ship turnaround", "value": metrics["ship_turnaround_h"], "unit": "h", "hint": "Arrival → departure for completed calls"},
            {"key": "waiting", "label": "Container wait", "value": metrics["container_wait_h"], "unit": "h", "hint": "Live average age of queued boxes"},
            {"key": "dock", "label": "Dock occupancy", "value": metrics["dock_occupancy_pct"], "unit": "%", "hint": "Occupied / usable berths now"},
            {"key": "crane", "label": "Crane utilisation", "value": metrics["crane_util_pct"], "unit": "%", "hint": "Average asset utilisation"},
            {"key": "truck", "label": "Truck utilisation", "value": metrics["truck_util_pct"], "unit": "%", "hint": "Assigned or in transit"},
            {"key": "driver", "label": "Driver utilisation", "value": metrics["driver_util_pct"], "unit": "%", "hint": "On-duty drivers with a vehicle"},
            {"key": "throughput", "label": "Throughput", "value": metrics["throughput_per_day"], "unit": "box/day", "hint": f"Delivered in the last {days} days"},
            {"key": "warehouse", "label": "Warehouse occupancy", "value": metrics["warehouse_occupancy_pct"], "unit": "%", "hint": "Weighted TEU utilisation"},
            {"key": "delay", "label": "Dispatch delay", "value": avg_delay, "unit": "h", "hint": "Completed vs scheduled departure"},
            {"key": "fuel", "label": "Fuel consumption", "value": metrics["fuel_estimate_l"], "unit": "L", "hint": "Estimated from truck odometer (0.32 L/km)"},
        ],
        "series": aggregated,
        "utilization": [
            {"name": "Cranes", "value": metrics["crane_util_pct"]},
            {"name": "Trucks", "value": metrics["truck_util_pct"]},
            {"name": "Drivers", "value": metrics["driver_util_pct"]},
            {"name": "Docks", "value": metrics["dock_occupancy_pct"]},
            {"name": "Warehouses", "value": metrics["warehouse_occupancy_pct"]},
        ],
        "bottlenecks": bottlenecks(db),
        "comparison": {
            "metric": "Average ship turnaround (h)",
            "baseline": baseline_turnaround,
            "optimized": optimized_turnaround,
            "delta_pct": round(
                (baseline_turnaround - optimized_turnaround) / baseline_turnaround * 100, 1
            ),
            "note": "Modelled baseline assumes uncoordinated berth/crane hand-offs (+18%). It is a transparent model, not a measured A/B trial.",
        },
        "health": health_data,
        "delivered_recent": [
            {
                "code": c.code,
                "ship_code": c.ship.code if c.ship else None,
                "delivered_at": c.dispatched_at.isoformat() + "Z" if c.dispatched_at else None,
                "warehouse": c.warehouse.code if c.warehouse else None,
            }
            for c in db.query(Container)
            .filter(Container.status == "delivered")
            .order_by(Container.dispatched_at.desc())
            .limit(8)
            .all()
        ],
        "data_note": "Metrics are computed from the platform's synthetic operational dataset. Modelled figures are labelled.",
    }


def _fmt_dt(dt) -> str:
    return dt.isoformat() if dt else ""


def build_csv(db: Session, dataset: str, days: int = 7) -> tuple[str, str]:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    filename = f"portsync-{dataset}-{utcnow().strftime('%Y%m%d-%H%M')}.csv"

    if dataset == "containers":
        writer.writerow(["code", "ship", "status", "cargo", "priority", "weight_t", "warehouse", "destination", "created_at", "updated_at"])
        for c in db.query(Container).order_by(Container.code).all():
            writer.writerow([c.code, c.ship.code if c.ship else "", c.status, c.cargo_type, c.priority, c.weight_t, c.warehouse.code if c.warehouse else "", c.destination, _fmt_dt(c.created_at), _fmt_dt(c.updated_at)])
    elif dataset == "ships":
        writer.writerow(["code", "name", "status", "priority", "cargo_type", "cargo_teu", "dock", "eta", "arrived_at", "departed_at", "handling_progress"])
        for s in db.query(Ship).order_by(Ship.code).all():
            writer.writerow([s.code, s.name, s.status, s.priority, s.cargo_type, s.cargo_qty, s.dock.code if s.dock else "", _fmt_dt(s.eta), _fmt_dt(s.arrived_at), _fmt_dt(s.departed_at), s.handling_progress])
    elif dataset == "dispatches":
        writer.writerow(["code", "mode", "destination", "status", "containers", "scheduled_departure", "completed_at", "delay_h", "carrier"])
        for d in db.query(Dispatch).order_by(Dispatch.code).all():
            delay = round(max(0.0, (d.completed_at - d.scheduled_departure).total_seconds() / 3600), 1) if d.completed_at else ""
            writer.writerow([d.code, d.mode, d.destination, d.status, len(d.items), _fmt_dt(d.scheduled_departure), _fmt_dt(d.completed_at), delay, d.carrier])
    elif dataset == "alerts":
        writer.writerow(["id", "severity", "category", "title", "entity", "status", "created_at", "resolved_at"])
        for a in db.query(Alert).order_by(Alert.created_at.desc()).all():
            writer.writerow([a.id, a.severity, a.category, a.title, a.entity_code or "", a.status, _fmt_dt(a.created_at), _fmt_dt(a.resolved_at)])
    elif dataset == "activity":
        writer.writerow(["ts", "type", "severity", "title", "entity", "message"])
        for e in db.query(OperationalEvent).order_by(OperationalEvent.ts.desc()).limit(2000).all():
            writer.writerow([_fmt_dt(e.ts), e.type, e.severity, e.title, e.entity_code or "", e.message])
    else:
        metrics = kpi_metrics(db, days)
        writer.writerow(["metric", "value", "unit"])
        units = {
            "ship_turnaround_h": "h",
            "container_wait_h": "h",
            "dock_occupancy_pct": "%",
            "crane_util_pct": "%",
            "truck_util_pct": "%",
            "driver_util_pct": "%",
            "throughput_per_day": "box/day",
            "warehouse_occupancy_pct": "%",
            "dispatch_delay_h": "h",
            "fuel_estimate_l": "L",
            "containers_delivered": "",
            "containers_waiting": "",
            "containers_waiting_24h": "",
            "active_alerts": "",
            "open_dispatches": "",
        }
        for key, value in metrics.items():
            writer.writerow([key, value, units.get(key, "")])
        health_data = health(db)
        writer.writerow(["port_health_score", health_data["score"], "0-100"])
        for component in health_data["components"]:
            writer.writerow([f"health_{component['key']}", component["value"], "0-100"])
    return buffer.getvalue(), filename
