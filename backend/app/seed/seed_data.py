"""Deterministic synthetic port dataset (fixed seed => reproducible demos)."""

import random
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.constants import (
    CRANE_SLOTS,
    DEFAULT_HEALTH_WEIGHTS,
    DEFAULT_RESOURCE_WEIGHTS,
    DEMO_USERS,
)
from app.core.security import hash_password
from app.core.timeutil import utcnow
from app.models import (
    Alert,
    AppSetting,
    Assignment,
    AuditLog,
    Container,
    ContainerEvent,
    Crane,
    Dispatch,
    DispatchItem,
    Dock,
    Driver,
    MaintenanceTask,
    OperationalEvent,
    Ship,
    SimulationScenario,
    User,
    Vehicle,
    Warehouse,
)
from app.services.common import save_setting

SEED = 20261
DESTINATIONS = [
    "Inland DC · Nashik",
    "JNPT Rail Hub",
    "Pune CFS",
    "Mumbai Distribution Centre",
    "Ahmedabad Logistics Park",
]
DRIVER_NAMES = [
    "Arjun Nair", "Priya Menon", "Rakesh Patil", "Meera Iyer", "Karan Shah",
    "Aditi Rao", "Vikram Singh", "Neha Joshi", "Sandeep Kulkarni", "Farah Khan",
    "Imran Sheikh", "Divya Menon", "Rohit Deshmukh", "Ananya Pillai", "Suresh Naik",
]
CHAIN = ["waiting", "allocated", "loading", "in_transit", "at_yard", "ready_for_dispatch", "delivered"]


def _event(db, ts, type, title, message, severity="info", entity_type=None, entity_code=None, payload=None):
    db.add(
        OperationalEvent(
            ts=ts,
            type=type,
            title=title,
            message=message,
            severity=severity,
            entity_type=entity_type,
            entity_code=entity_code,
            payload=payload,
        )
    )


def _alert(db, ts, severity, category, title, message, entity_type=None, entity_code=None, status="active", source="engine"):
    db.add(
        Alert(
            severity=severity,
            category=category,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_code=entity_code,
            status=status,
            source=source,
            created_at=ts,
            acknowledged_at=ts + timedelta(minutes=20) if status in ("acknowledged", "resolved") else None,
            resolved_at=ts + timedelta(hours=1) if status == "resolved" else None,
        )
    )


def _container_history(db, container, created_at, current_status, rng, dispatch_code=None, actor="system"):
    idx = CHAIN.index(current_status)
    timestamps = sorted(
        created_at + timedelta(minutes=rng.randint(3, 220) * (i + 1)) for i in range(idx)
    )
    previous = None
    for i, status in enumerate(CHAIN[: idx + 1]):
        ts = created_at if i == 0 else min(timestamps[i - 1], utcnow() - timedelta(minutes=1))
        db.add(
            ContainerEvent(
                container_id=container.id,
                from_status=previous,
                to_status=status,
                note=(
                    "Discharged to quay"
                    if status == "allocated"
                    else "Loaded by CR-01"
                    if status == "loading"
                    else "Truck move"
                    if status == "in_transit"
                    else ("Stored" if status == "at_yard" else "Delivered" if status == "delivered" else "Manifested")
                ),
                actor=(dispatch_code or actor) if status == "delivered" else actor,
                ts=ts,
            )
        )
        previous = status


def seed(db: Session) -> None:
    rng = random.Random(SEED)
    now = utcnow()

    if settings.seed_demo_users:
        existing_users = {user.email.lower(): user for user in db.query(User).all()}
        for spec in DEMO_USERS:
            user = existing_users.get(spec["email"].lower())
            if user is None:
                db.add(User(**spec, password_hash=hash_password(settings.demo_password)))
            else:
                user.role = spec["role"]
                user.name = spec["name"]
                if not user.password_hash:
                    user.password_hash = hash_password(settings.demo_password)

    docks = [
        Dock(code="D1", name="Berth Alpha", capacity_teu=1200, max_length_m=320, max_draft_m=14.0,
             allowed_cargo="general,reefer,hazardous", status="occupied"),
        Dock(code="D2", name="Berth Bravo", capacity_teu=1400, max_length_m=366, max_draft_m=15.5,
             allowed_cargo="general,reefer,hazardous,bulk", status="available"),
        Dock(code="D3", name="Berth Charlie", capacity_teu=1600, max_length_m=400, max_draft_m=16.2,
             allowed_cargo="general,reefer,bulk", status="available"),
        Dock(code="D4", name="Berth Delta", capacity_teu=900, max_length_m=280, max_draft_m=12.5,
             allowed_cargo="general,reefer", status="maintenance", maintenance_until=now + timedelta(hours=5, minutes=20)),
    ]
    db.add_all(docks)
    db.flush()
    dock_by_code = {d.code: d for d in docks}

    warehouses = [
        Warehouse(code="WH-A", name="Nhava Cargo Terminal A", zone="Zone A", capacity_teu=480, occupancy=418,
                  status="operational", threshold=85.0),
        Warehouse(code="WH-B", name="Nhava Cargo Terminal B", zone="Zone B", capacity_teu=520, occupancy=198,
                  status="operational", threshold=85.0),
    ]
    db.add_all(warehouses)
    db.flush()
    wh_by_code = {w.code: w for w in warehouses}

    ship_specs = [
        ("SH-095", "MV Western Tide", "departed", "normal", 160, now - timedelta(days=6, hours=4), now - timedelta(days=6, hours=4), now - timedelta(days=5, hours=16)),
        ("SH-096", "MV Harbour Crest", "departed", "normal", 220, now - timedelta(days=5, hours=2), now - timedelta(days=5, hours=2), now - timedelta(days=4, hours=13)),
        ("SH-097", "MV Eastern Pearl", "departed", "high", 340, now - timedelta(days=4, hours=3), now - timedelta(days=4, hours=3), now - timedelta(days=3, hours=17)),
        ("SH-098", "MV Sapphire Bay", "departed", "normal", 180, now - timedelta(days=3, hours=8), now - timedelta(days=3, hours=8), now - timedelta(days=2, hours=20)),
        ("SH-099", "MV Konkan Trader", "departed", "normal", 240, now - timedelta(days=3, hours=1), now - timedelta(days=3, hours=1), now - timedelta(days=2, hours=13)),
        ("SH-102", "MV Sagar Express", "unloading", "high", 60, now - timedelta(hours=8), now - timedelta(hours=6), None),
        ("SH-103", "MV Coral Horizon", "waiting", "normal", 45, now - timedelta(hours=2), now - timedelta(hours=1, minutes=24), None),
        ("SH-104", "MV Northwind", "approaching", "low", 30, now + timedelta(hours=1, minutes=30), None, None),
    ]
    ships = []
    for idx, (code, name, status, priority, qty, eta, arrived, departed) in enumerate(ship_specs):
        ship = Ship(
            code=code,
            name=name,
            cargo_type="general" if idx % 4 else "reefer",
            cargo_qty=qty,
            priority=priority,
            eta=eta,
            arrived_at=arrived,
            departed_at=departed,
            vessel_length_m=[220, 250, 300, 240, 260, 290, 240, 210][idx],
            draft_m=[10.5, 11.8, 13.6, 11.0, 12.0, 13.2, 11.4, 9.8][idx],
            handling_hours=[6, 7, 9, 6.5, 8, 8, 6, 5][idx],
            status=status,
            handling_progress=100.0 if status == "departed" else 68.0 if status == "unloading" else 0.0,
        )
        ships.append(ship)
        db.add(ship)
    db.flush()
    ship_by_code = {s.code: s for s in ships}
    ship_by_code["SH-102"].dock_id = dock_by_code["D1"].id

    cranes_specs = [
        ("CR-01", "STS", 45.0, 72.0, 84.0, "active", "D1", 12840, 26),
        ("CR-02", "STS", 40.0, 94.0, 8.0, "idle", "D2", 6420, 12),
        ("CR-03", "STS", 45.0, 87.0, 4.0, "idle", "D3", 4180, 9),
        ("CR-04", "MHC", 35.0, 46.0, 0.0, "idle", "D4", 18850, 74),
        ("CR-05", "STS", 38.0, 61.0, 22.0, "idle", "D2", 9640, 40),
        ("CR-06", "MHC", 30.0, 38.0, 0.0, "maintenance", "D3", 16420, 95),
    ]
    cranes = []
    for code, ctype, capacity, health, util, status, dock_code, moves, days in cranes_specs:
        slot = next((s for s in CRANE_SLOTS if s["code"] == code), {"x": 300, "y": 250})
        crane = Crane(
            code=code, crane_type=ctype, capacity_t=capacity, health=health, utilization=util,
            status=status, dock_id=dock_by_code[dock_code].id, x=slot["x"], y=slot["y"],
            moves_total=moves, last_maintenance=now - timedelta(days=days),
        )
        cranes.append(crane)
        db.add(crane)
    db.flush()
    crane_by_code = {c.code: c for c in cranes}

    drivers = []
    for idx, name in enumerate(DRIVER_NAMES):
        code = f"DR-{idx + 1:02d}"
        duty = "on_duty" if idx < 11 else "on_break" if idx < 13 else "off_duty"
        driver = Driver(
            code=code,
            name=name,
            duty_status=duty,
            shift="Day 06:00–14:00" if idx % 2 == 0 else "Night 22:00–06:00",
            skills="terminal-truck,reefer" if idx % 4 == 0 else "terminal-truck",
            workload=[44, 58, 22, 12, 35, 8, 62, 28, 74, 18, 40, 0, 0, 0, 0][idx],
        )
        drivers.append(driver)
        db.add(driver)
    db.flush()
    driver_by_code = {d.code: d for d in drivers}

    vehicles_specs = [
        ("TR-01", 32, 78, 88, "assigned", "DR-01", "Discharge support · SH-102", "d1", 0.35),
        ("TR-02", 34, 62, 91, "assigned", "DR-02", "Discharge support · SH-102", "d1", 0.62),
        ("TR-03", 30, 12, 79, "available", "DR-03", None, None, 0.0),
        ("TR-04", 32, 88, 93, "available", "DR-04", None, None, 0.0),
        ("TR-05", 28, 71, 84, "available", "DR-05", None, None, 0.0),
        ("TR-06", 36, 95, 96, "available", "DR-06", None, None, 0.0),
        ("TR-07", 32, 47, 66, "available", "DR-07", None, None, 0.0),
        ("TR-08", 26, 55, 74, "available", "DR-08", None, None, 0.0),
        ("TR-09", 30, 81, 58, "in_transit", "DR-09", "DSP-1003 → Pune CFS", "gate", 0.4),
        ("TR-10", 34, 68, 87, "available", "DR-10", None, None, 0.0),
        ("TR-11", 32, 40, 52, "maintenance", None, "Scheduled service MNT-0103", None, 0.0),
        ("TR-12", 28, 8, 49, "fault", "DR-11", "Withdrawn · axle fault", None, 0.0),
    ]
    vehicles = []
    for code, capacity, fuel, health, status, driver_code, task, route, phase in vehicles_specs:
        vehicle = Vehicle(
            code=code, capacity_t=capacity, fuel=fuel, health=health, status=status,
            driver_id=driver_by_code[driver_code].id if driver_code else None,
            current_task=task, route_key=route, route_phase=phase,
            odometer_km=round(rng.uniform(4200, 28000), 1), total_trips=rng.randint(320, 1900),
        )
        vehicles.append(vehicle)
        db.add(vehicle)
    db.flush()
    vehicle_by_code = {v.code: v for v in vehicles}

    # Active assignments for the vessel alongside
    assignment_specs = [
        ("dock", "D1", dock_by_code["D1"].id, "SH-102", 92.4, "Available berth, 45 t crane coverage, 60 TEU discharge."),
        ("crane", "CR-01", crane_by_code["CR-01"].id, "SH-102", 88.1, "Docked at D1 with 45 t lift capacity."),
        ("vehicle", "TR-01", vehicle_by_code["TR-01"].id, "SH-102", 81.6, "Fuel 78%, 32 t payload, driver on duty."),
        ("vehicle", "TR-02", vehicle_by_code["TR-02"].id, "SH-102", 79.2, "Fuel 62%, 34 t payload, driver on duty."),
        ("driver", "DR-01", driver_by_code["DR-01"].id, "SH-102", 84.0, "On duty, day shift."),
        ("driver", "DR-02", driver_by_code["DR-02"].id, "SH-102", 80.0, "On duty, night shift."),
        ("warehouse", "WH-A", wh_by_code["WH-A"].id, "SH-102", 72.0, "62 TEU free at assignment time."),
    ]
    for kind, code, resource_id, ship_code, score, explanation in assignment_specs:
        db.add(
            Assignment(
                kind=kind, resource_code=code, resource_id=resource_id,
                ship_id=ship_by_code[ship_code].id, score=score, source="optimizer",
                explanation=explanation, created_by="Priya Menon",
                created_at=now - timedelta(hours=5, minutes=40),
            )
        )
    # Historical released assignments
    db.add(
        Assignment(
            kind="dock", resource_code="D3", resource_id=dock_by_code["D3"].id,
            ship_id=ship_by_code["SH-099"].id, score=90.2, source="optimizer",
            explanation="Completed call — berth released.", status="released",
            created_by="Arjun Rao", created_at=now - timedelta(days=3),
            released_at=now - timedelta(days=2, hours=13),
        )
    )

    # ----- containers -------------------------------------------------------
    containers_by_ship: dict[str, list[Container]] = {"SH-102": [], "SH-099": []}
    codes = iter(range(1, 200))
    status_plan_sh102 = (
        ["delivered"] * 11 + ["ready_for_dispatch"] * 12 + ["at_yard"] * 21
        + ["in_transit"] * 2 + ["loading"] * 4 + ["allocated"] * 5 + ["waiting"] * 5
    )
    for idx, status in enumerate(status_plan_sh102):
        created = now - timedelta(hours=rng.uniform(4.5, 9.5))
        code = f"CONT-{next(codes):04d}"
        warehouse = wh_by_code["WH-A"] if idx % 5 < 3 else wh_by_code["WH-B"]
        location = (
            f"Vessel hold · SH-102" if status == "waiting"
            else "Quay · CR-01" if status in ("allocated", "loading")
            else "In transit · gate corridor" if status == "in_transit"
            else f"{warehouse.code} · dispatch lane" if status == "ready_for_dispatch"
            else f"{warehouse.code} · {warehouse.zone}" if status == "at_yard"
            else f"Delivered · {DESTINATIONS[idx % len(DESTINATIONS)]}"
        )
        container = Container(
            code=code, ship_id=ship_by_code["SH-102"].id,
            cargo_type="reefer" if idx % 9 == 0 else "general",
            priority="high" if idx % 4 == 0 else "normal",
            status=status, location=location,
            destination=DESTINATIONS[idx % len(DESTINATIONS)],
            weight_t=round(rng.uniform(11, 27.5), 1),
            warehouse_id=warehouse.id if status in ("at_yard", "ready_for_dispatch", "in_transit", "delivered") else None,
            crane_id=crane_by_code["CR-01"].id if status in ("allocated", "loading", "in_transit", "at_yard", "ready_for_dispatch", "delivered") else None,
            vehicle_id=vehicle_by_code["TR-01" if idx % 2 else "TR-02"].id if status in ("in_transit", "at_yard", "ready_for_dispatch", "delivered") else None,
            created_at=created, updated_at=now - timedelta(minutes=rng.randint(5, 300)),
            dispatched_at=now - timedelta(hours=rng.uniform(0.5, 3.5)) if status == "delivered" else None,
        )
        db.add(container)
        db.flush()
        containers_by_ship["SH-102"].append(container)
        _container_history(db, container, created, status, rng)

    status_plan_sh099 = ["delivered"] * 50 + ["at_yard"] * 5
    for idx, status in enumerate(status_plan_sh099):
        created = now - timedelta(days=rng.uniform(2.6, 6.2), hours=rng.uniform(0, 12))
        code = f"CONT-{next(codes):04d}"
        warehouse = wh_by_code["WH-B"]
        container = Container(
            code=code, ship_id=ship_by_code["SH-099"].id,
            cargo_type="general" if idx % 7 else "reefer",
            priority="normal" if idx % 5 else "low",
            status=status,
            location=f"{warehouse.code} · {warehouse.zone}" if status == "at_yard" else f"Delivered · {DESTINATIONS[idx % len(DESTINATIONS)]}",
            destination=DESTINATIONS[idx % len(DESTINATIONS)],
            weight_t=round(rng.uniform(12, 26), 1),
            warehouse_id=warehouse.id,
            crane_id=crane_by_code["CR-03"].id,
            vehicle_id=vehicle_by_code["TR-06"].id,
            created_at=created, updated_at=created + timedelta(hours=rng.uniform(2, 20)),
            dispatched_at=created + timedelta(hours=rng.uniform(4, 20)) if status == "delivered" else None,
        )
        db.add(container)
        db.flush()
        containers_by_ship["SH-099"].append(container)
        _container_history(db, container, created, status, rng)

    # ----- dispatches -------------------------------------------------------
    delivered_102 = [c for c in containers_by_ship["SH-102"] if c.status == "delivered"]
    ready_102 = [c for c in containers_by_ship["SH-102"] if c.status == "ready_for_dispatch"]
    delivered_099 = [c for c in containers_by_ship["SH-099"] if c.status == "delivered"]

    dispatch_specs = [
        ("DSP-1001", "road", "Mumbai Distribution Centre", "completed", "PortSync Haulage", "TR-04",
         now - timedelta(days=1, hours=9), now - timedelta(days=1, hours=6, minutes=20), delivered_099[0:6]),
        ("DSP-1002", "rail", "Ahmedabad Logistics Park", "completed", "Konkan Rail Freight", None,
         now - timedelta(days=1, hours=2), now - timedelta(hours=20), delivered_099[6:14]),
        ("DSP-1003", "road", "Pune CFS", "in_transit", "PortSync Haulage", "TR-09",
         now - timedelta(hours=1, minutes=10), None, ready_102[0:2]),
        ("DSP-1004", "rail", "JNPT Rail Hub", "scheduled", "Konkan Rail Freight", None,
         now + timedelta(hours=6), None, ready_102[2:5]),
        ("DSP-1005", "road", "Inland DC · Nashik", "pending", "PortSync Haulage", None,
         now + timedelta(hours=9), None, ready_102[5:8]),
    ]
    dispatches = []
    for code, mode, destination, status, carrier, vehicle_code, scheduled, completed, items in dispatch_specs:
        dispatch = Dispatch(
            code=code, mode=mode, destination=destination, status=status, carrier=carrier,
            vehicle_id=vehicle_by_code[vehicle_code].id if vehicle_code else None,
            scheduled_departure=scheduled, completed_at=completed,
            capacity_teu=len(items) * 2, notes="Synthetic demo dispatch",
            created_at=min(scheduled, now) - timedelta(hours=3),
        )
        db.add(dispatch)
        db.flush()
        for container in items:
            db.add(DispatchItem(dispatch_id=dispatch.id, container_id=container.id))
        dispatches.append(dispatch)

    # ----- alerts -----------------------------------------------------------
    alerts = [
        (now - timedelta(minutes=38), "critical", "truck_breakdown", "TR-12 withdrawn with axle fault",
         "TR-12 reported a drivetrain fault and is removed from allocation pending workshop clearance.", "vehicle", "TR-12", "active"),
        (now - timedelta(hours=1, minutes=10), "warning", "low_fuel", "TR-03 fuel below dispatch floor",
         "Fuel at 12%. Refuel before the 20% dispatch floor blocks further assignment.", "vehicle", "TR-03", "active"),
        (now - timedelta(hours=2, minutes=5), "warning", "warehouse_capacity", "WH-A above 85% capacity threshold",
         "418/480 TEU occupied (87.1%). Plan outbound dispatch to protect receiving capacity.", "warehouse", "WH-A", "acknowledged"),
        (now - timedelta(hours=3, minutes=15), "critical", "equipment_risk", "CR-04 maintenance risk 78/100",
         "Health 46% with 74 days since service. Advisory indicator — not a validated failure prediction.", "crane", "CR-04", "active"),
        (now - timedelta(hours=5, minutes=20), "warning", "maintenance_overdue", "CR-06 service overdue",
         "Scheduled service window passed. Crane remains withdrawn from allocation.", "crane", "CR-06", "active"),
        (now - timedelta(hours=6, minutes=5), "warning", "equipment_health", "CR-05 health trending down",
         "Health 61% with rising utilisation. Review service window within seven days.", "crane", "CR-05", "acknowledged"),
        (now - timedelta(hours=7, minutes=30), "info", "ship_arrival", "SH-104 arriving within 2 h",
         "MV Northwind ETA in 90 minutes · 30 TEU general cargo · low priority.", "ship", "SH-104", "active"),
        (now - timedelta(hours=8, minutes=12), "info", "discharge", "SH-102 discharge started at D1",
         "68% of the 60 TEU manifest has been landed. CR-01 active with two trucks shuttling.", "ship", "SH-102", "resolved"),
        (now - timedelta(hours=9), "warning", "maintenance_overdue", "TR-11 workshop window",
         "TR-11 in scheduled service; fleet availability reduced by one unit until release.", "vehicle", "TR-11", "resolved"),
        (now - timedelta(hours=10, minutes=40), "info", "dispatch_delay", "DSP-1003 departed gate",
         "Road dispatch to Pune CFS cleared the gate with two containers.", "dispatch", "DSP-1003", "resolved"),
        (now - timedelta(hours=12), "warning", "driver_shortage", "Four drivers off shift",
         "11 of 15 drivers on duty. Night handover will reduce the pool to nine.", "driver", None, "resolved"),
        (now - timedelta(hours=15), "info", "dock_maintenance", "D4 maintenance window",
         "Berth Delta out of service for fender works; D2 and D3 remain available.", "dock", "D4", "acknowledged"),
    ]
    for ts, severity, category, title, message, entity_type, entity_code, status in alerts:
        _alert(db, ts, severity, category, title, message, entity_type, entity_code, status)

    db.add_all(
        [
            MaintenanceTask(code="MNT-0101", equipment_type="crane", equipment_code="CR-06",
                            reason="Overdue service and health 38%", risk_score=82, status="scheduled",
                            scheduled_for=now - timedelta(hours=2), notes="Crane withdrawn from allocation."),
            MaintenanceTask(code="MNT-0102", equipment_type="crane", equipment_code="CR-04",
                            reason="Health 46% · high utilisation history", risk_score=74, status="scheduled",
                            scheduled_for=now + timedelta(hours=6), notes="Risk is a rule-based advisory indicator."),
            MaintenanceTask(code="MNT-0103", equipment_type="vehicle", equipment_code="TR-11",
                            reason="Scheduled 30-day service", risk_score=58, status="in_progress",
                            scheduled_for=now - timedelta(hours=1), notes="Workshop in progress."),
        ]
    )

    # ----- operational event history ---------------------------------------
    for ship in ships:
        if ship.status == "departed":
            _event(
                db, ship.arrived_at, "ship_arrived", f"{ship.code} arrived",
                f"{ship.name} arrived with {ship.cargo_qty} TEU and was allocated a berth.",
                severity="info", entity_type="ship", entity_code=ship.code,
            )
            _event(
                db, ship.departed_at, "ship_departed", f"{ship.code} departed",
                f"{ship.name} completed cargo operations and released its berth.",
                severity="info", entity_type="ship", entity_code=ship.code,
            )
    _event(
        db, now - timedelta(hours=6), "ship_arrived", "SH-102 arrived at D1",
        "MV Sagar Express berth assignment accepted; discharge crew mobilised.",
        entity_type="ship", entity_code="SH-102",
    )
    _event(
        db, now - timedelta(hours=1, minutes=24), "ship_arrived", "SH-103 arrived at anchorage",
        "MV Coral Horizon waiting for a berth window.", entity_type="ship", entity_code="SH-103",
    )
    _event(
        db, now - timedelta(hours=5, minutes=40), "allocation_accepted", "SH-102 allocated to D1",
        "Dock allocation accepted with crane CR-01 and two trucks.",
        entity_type="ship", entity_code="SH-102",
        payload={"detail": "dock=D1; crane=CR-01; trucks=TR-01,TR-02; score=92.4"},
    )
    _event(
        db, now - timedelta(hours=8, minutes=12), "unloading_started", "SH-102 discharge started",
        "Crane CR-01 engaged; container manifest of 60 boxes released to the queue.",
        entity_type="ship", entity_code="SH-102",
    )
    _event(
        db, now - timedelta(hours=3, minutes=40), "container_moved", "12 containers staged for dispatch",
        "Outbound staging completed at WH-A; dispatch planning requested.", entity_type="container",
    )
    _event(
        db, now - timedelta(hours=2, minutes=45), "truck_movement", "TR-01 completed a quay cycle",
        "Container moved from D1 to WH-A; vehicle returned to the shuttle loop.",
        entity_type="vehicle", entity_code="TR-01",
    )
    _event(
        db, now - timedelta(hours=1, minutes=2), "warehouse_intake", "WH-B intake completed",
        "Two containers received from a road shuttle.", entity_type="warehouse", entity_code="WH-B",
    )
    _event(
        db, now - timedelta(minutes=38), "truck_breakdown", "TR-12 withdrawn with axle fault",
        "Vehicle removed from the allocation pool; critical alert raised.",
        severity="critical", entity_type="vehicle", entity_code="TR-12",
    )
    for dispatch in dispatches:
        if dispatch.completed_at:
            _event(
                db, dispatch.completed_at, "dispatch_completed", f"{dispatch.code} completed",
                f"{len(dispatch.items)} container(s) delivered to {dispatch.destination} by {dispatch.mode}.",
                entity_type="dispatch", entity_code=dispatch.code,
            )
        elif dispatch.status == "in_transit":
            _event(
                db, dispatch.scheduled_departure, "dispatch_in_transit", f"{dispatch.code} in transit",
                f"Road dispatch moving toward {dispatch.destination}.",
                entity_type="dispatch", entity_code=dispatch.code,
            )
        elif dispatch.status in ("scheduled", "pending"):
            _event(
                db, dispatch.created_at, "dispatch_created", f"{dispatch.code} planned",
                f"{len(dispatch.items)} container(s) scheduled for {dispatch.destination} ({dispatch.mode}).",
                entity_type="dispatch", entity_code=dispatch.code,
            )

    # Sampled container movement history
    for container in (containers_by_ship["SH-099"][:6] + containers_by_ship["SH-102"][:8]):
        ts = max(container.created_at, now - timedelta(hours=rng.uniform(1, 30)))
        _event(
            db, min(ts, now - timedelta(minutes=5)), "container_moved",
            f"{container.code} → {container.status.replace('_', ' ')}",
            f"{container.code} updated at {container.location}.",
            entity_type="container", entity_code=container.code,
        )
    _event(
        db, now - timedelta(hours=5, minutes=15), "warehouse_warning", "WH-A crossed 85% occupancy",
        "Storage recommendation will bias new cargo toward WH-B.",
        severity="warning", entity_type="warehouse", entity_code="WH-A",
    )
    _event(
        db, now - timedelta(hours=5, minutes=20), "maintenance_scheduled", "CR-06 withdrawn for service",
        "Maintenance task MNT-0101 overdue; crane unavailable for allocation.",
        severity="warning", entity_type="crane", entity_code="CR-06",
    )

    db.add(
        AuditLog(
            actor="Priya Menon", action="allocation_accepted", entity_type="ship", entity_code="SH-102",
            detail="dock=D1; crane=CR-01; trucks=TR-01,TR-02; score=92.4",
            ts=now - timedelta(hours=5, minutes=40),
        )
    )

    save_setting(db, "health_weights", DEFAULT_HEALTH_WEIGHTS)
    save_setting(db, "resource_weights", DEFAULT_RESOURCE_WEIGHTS)
    save_setting(db, "sim_clock", {"running": True, "speed": 1.0})
    db.commit()


def ensure_demo_credentials(db: Session) -> None:
    if not settings.seed_demo_users:
        return
    existing_users = {user.email.lower(): user for user in db.query(User).all()}
    for spec in DEMO_USERS:
        user = existing_users.get(spec["email"].lower())
        if user is None:
            db.add(User(**spec, password_hash=hash_password(settings.demo_password)))
        else:
            user.role = spec["role"]
            user.name = spec["name"]
            if not user.password_hash:
                user.password_hash = hash_password(settings.demo_password)
    db.commit()


def seed_if_empty(db: Session) -> bool:
    if db.query(Ship).count() > 0:
        return False
    seed(db)
    return True


def reset_demo(db: Session) -> None:
    for model in (
        ContainerEvent, DispatchItem, Dispatch, Assignment, Alert, MaintenanceTask,
        OperationalEvent, AuditLog, Container, Ship, Crane, Vehicle, Driver,
        Warehouse, Dock, SimulationScenario, AppSetting,
    ):
        db.query(model).delete()
    db.commit()
    seed(db)
