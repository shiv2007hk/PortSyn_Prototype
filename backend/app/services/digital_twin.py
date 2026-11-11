from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import (
    APPROACH,
    CRANE_SLOTS,
    DOCKS,
    GATE,
    RAIL,
    ROAD_NODES,
    ROAD_Y,
    TRUCK_PATHS,
    TRUCK_STAGING,
    TWIN_SIZE,
    WAREHOUSE_SLOTS,
    YARD,
)
from app.core.timeutil import utcnow
from app.models import Container, Crane, Dock, Ship, Vehicle, Warehouse
from app.services.common import get_setting
from app.services.serializers import dock_out, warehouse_out


def _point_on_path(path: list[tuple[float, float]], phase: float) -> tuple[float, float, float]:
    """Return x, y and heading (degrees) for a phase in [0, 1] along a polyline."""
    if not path:
        return 0.0, 0.0, 0.0
    if len(path) == 1:
        return path[0][0], path[0][1], 0.0
    segments = []
    total = 0.0
    for i in range(len(path) - 1):
        (x1, y1), (x2, y2) = path[i], path[i + 1]
        length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        segments.append((length, x1, y1, x2, y2))
        total += length
    target = max(0.0, min(1.0, phase)) * total
    walked = 0.0
    for length, x1, y1, x2, y2 in segments:
        if walked + length >= target or length == 0:
            t = 0 if length == 0 else (target - walked) / length
            x = x1 + (x2 - x1) * t
            y = y1 + (y2 - y1) * t
            import math

            heading = math.degrees(math.atan2(y2 - y1, x2 - x1))
            return round(x, 1), round(y, 1), round(heading, 1)
        walked += length
    x, y = path[-1]
    return x, y, 0.0


def _sim_clock(db: Session) -> dict:
    default = {"running": settings.sim_enabled, "speed": 1.0}
    clock = get_setting(db, "sim_clock", default)
    if not isinstance(clock, dict):
        clock = default
    return {
        "running": bool(clock.get("running", default["running"])),
        "speed": float(clock.get("speed", 1.0)),
        "source": "synthetic simulator",
    }


def truck_path(vehicle: Vehicle) -> list[tuple[float, float]]:
    key = vehicle.route_key or "gate"
    if key.startswith("d") and key in TRUCK_PATHS:
        return TRUCK_PATHS[key]
    return TRUCK_PATHS.get(key, TRUCK_PATHS["yard"])


def truck_position(vehicle: Vehicle, index: int) -> tuple[float, float, float]:
    if vehicle.status in ("assigned", "in_transit") and vehicle.route_key:
        return _point_on_path(truck_path(vehicle), vehicle.route_phase)
    staging = TRUCK_STAGING[index % len(TRUCK_STAGING)]
    if vehicle.status in ("maintenance", "fault"):
        return staging[0] + 8, staging[1] + 12, 0.0
    return staging[0], staging[1], 0.0


def ship_position(ship: Ship, index: int, docks: dict[str, Dock]) -> tuple[float, float, float | None]:
    if ship.status == "departed":
        return -200, -200, None
    if ship.dock:
        for slot in DOCKS:
            if slot["code"] == ship.dock.code:
                return slot["x"] + slot["w"] / 2, slot["y"] + slot["h"] / 2 - 8, 0.0
    if ship.status in ("arrived", "waiting"):
        return 900 + index * 120, 72, 0.0
    # approaching lane
    return 120 + index * 100, 55, 0.0


def state(db: Session) -> dict[str, Any]:
    docks = db.query(Dock).order_by(Dock.code).all()
    dock_map = {d.code: d for d in docks}
    ships = (
        db.query(Ship)
        .filter(Ship.status != "departed")
        .order_by(Ship.status, Ship.id)
        .all()
    )
    cranes = db.query(Crane).order_by(Crane.code).all()
    vehicles = db.query(Vehicle).order_by(Vehicle.code).all()
    warehouses = db.query(Warehouse).order_by(Warehouse.code).all()

    ship_rows = []
    for idx, ship in enumerate(ships):
        x, y, heading = ship_position(ship, idx, dock_map)
        ship_rows.append(
            {
                "id": ship.id,
                "code": ship.code,
                "name": ship.name,
                "status": ship.status,
                "priority": ship.priority,
                "x": x,
                "y": y,
                "heading": heading,
                "dock_code": ship.dock.code if ship.dock else None,
                "cargo_qty": ship.cargo_qty,
                "progress": round(ship.handling_progress, 1),
                "length_m": ship.vessel_length_m,
            }
        )

    crane_rows = []
    for crane in cranes:
        slot = next((s for s in CRANE_SLOTS if s["code"] == crane.code), None)
        x = slot["x"] if slot else 300
        y = slot["y"] if slot else 250
        crane_rows.append(
            {
                "id": crane.id,
                "code": crane.code,
                "crane_type": crane.crane_type,
                "status": crane.status,
                "x": x,
                "y": y,
                "dock_code": crane.dock.code if crane.dock else (slot["dock"] if slot else None),
                "health": round(crane.health, 1),
                "utilization": round(crane.utilization, 1),
            }
        )

    truck_rows = []
    for idx, vehicle in enumerate(vehicles):
        x, y, heading = truck_position(vehicle, idx)
        truck_rows.append(
            {
                "id": vehicle.id,
                "code": vehicle.code,
                "status": vehicle.status,
                "x": x,
                "y": y,
                "heading": heading,
                "fuel": round(vehicle.fuel, 1),
                "health": round(vehicle.health, 1),
                "driver": vehicle.driver.name if vehicle.driver else None,
                "driver_code": vehicle.driver.code if vehicle.driver else None,
                "route_key": vehicle.route_key,
                "task": vehicle.current_task,
            }
        )

    warehouse_rows = []
    for wh in warehouses:
        slot = next((s for s in WAREHOUSE_SLOTS if s["code"] == wh.code), None)
        row = warehouse_out(wh)
        row.update(slot or {"x": 900, "y": 350, "w": 220, "h": 130})
        warehouse_rows.append(row)

    yard_containers = (
        db.query(Container)
        .filter(Container.status.in_(["at_yard", "ready_for_dispatch"]))
        .count()
    )
    queue = db.query(Container).filter(Container.status.in_(["waiting", "allocated", "loading"])).count()
    occupied = sum(1 for d in docks if d.status == "occupied")
    usable = sum(1 for d in docks if d.status != "maintenance")
    wh_util = (
        round(sum(w.occupancy for w in warehouses) / max(sum(w.capacity_teu for w in warehouses), 1) * 100, 1)
        if warehouses
        else 0
    )

    layout = {
        "width": TWIN_SIZE["width"],
        "height": TWIN_SIZE["height"],
        "docks": [
            {
                "code": d.code,
                "name": d.name,
                "status": d.status,
                "ship_code": d.current_ship.code if d.current_ship and d.current_ship.status != "departed" else None,
                **next(s for s in DOCKS if s["code"] == d.code),
            }
            for d in docks
        ],
        "warehouses": [
            {"code": w["code"], "x": w["x"], "y": w["y"], "w": w["w"], "h": w["h"]} for w in WAREHOUSE_SLOTS
        ],
        "yard": YARD,
        "gate": GATE,
        "rail": {**RAIL, "label": "Konkan rail spur"},
        "approach": APPROACH,
        "road_y": ROAD_Y,
        "road_nodes": {k: {"x": v[0], "y": v[1]} for k, v in ROAD_NODES.items()},
        "truck_paths": {k: [{"x": p[0], "y": p[1]} for p in v] for k, v in TRUCK_PATHS.items()},
        "crane_slots": CRANE_SLOTS,
    }

    return {
        "ts": utcnow().isoformat() + "Z",
        "layout": layout,
        "ships": ship_rows,
        "cranes": crane_rows,
        "trucks": truck_rows,
        "warehouses": warehouse_rows,
        "docks": [dock_out(d) for d in docks],
        "yard": {
            **YARD,
            "containers": yard_containers,
            "capacity": 900,
            "fill": round(min(100.0, yard_containers / 900 * 100), 1),
        },
        "kpis": {
            "queue": queue,
            "dock_occupancy": round(occupied / usable * 100, 1) if usable else 100.0,
            "warehouse_occupancy": wh_util,
            "active_cranes": sum(1 for c in cranes if c.status == "active"),
            "active_trucks": sum(1 for v in vehicles if v.status in ("assigned", "in_transit")),
        },
        "sim_clock": _sim_clock(db),
        "simulated": True,
        "source_note": "Positions are generated by the PortSync synthetic simulator, not live GPS.",
    }
