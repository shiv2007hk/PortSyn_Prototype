"""What-if simulation against a read-only view of live operational state.

Running a scenario never mutates ships, resources, containers or dispatches.
Only an explicit Apply call writes the approved effect to the live database.
"""

from types import SimpleNamespace
from typing import Any

from sqlalchemy.orm import Session

from app.core.timeutil import utcnow
from app.models import (
    Alert,
    Assignment,
    Container,
    Crane,
    Dispatch,
    Dock,
    Ship,
    SimulationScenario,
    Warehouse,
)
from app.services.allocation_engine import AllocationError, recommend_docks
from app.services.analytics_engine import health, kpi_metrics
from app.services.common import create_alert_once, record_audit, record_event
from app.services.serializers import iso


SCENARIO_LABELS = {
    "crane_failure": "Crane failure",
    "sudden_ship": "Sudden high-priority ship",
    "truck_breakdown": "Truck breakdown",
    "warehouse_shortage": "Warehouse capacity shortage",
}


def _scenario_out(scenario: SimulationScenario) -> dict[str, Any]:
    return {
        "id": scenario.id,
        "scenario_type": scenario.scenario_type,
        "name": scenario.name,
        "params": scenario.params,
        "status": scenario.status,
        "created_at": iso(scenario.created_at),
        "applied_at": iso(scenario.applied_at),
    }


def _compare(before_kpis: dict, after_kpis: dict, before_health: float, after_health: float) -> list[dict]:
    rows = [
        ("port_health", "Port health", before_health, after_health, "0-100", True),
        ("available_cranes", "Available cranes", before_kpis["cranes_available"], after_kpis["cranes_available"], "", False),
        ("container_backlog", "Container backlog", before_kpis["backlog"], after_kpis["backlog"], "boxes", True),
        ("turnaround", "Est. ship turnaround", before_kpis["turnaround_h"], after_kpis["turnaround_h"], "h", True),
        ("throughput", "Throughput / day", before_kpis["throughput"], after_kpis["throughput"], "box/day", False),
        ("storage", "Available storage", before_kpis["storage_available"], after_kpis["storage_available"], "TEU", False),
        ("wait", "Expected berth wait", before_kpis["wait_min"], after_kpis["wait_min"], "min", True),
    ]
    result = []
    for key, label, before, after, unit, lower_better in rows:
        if key == "port_health":
            before, after = before_health, after_health
        result.append(
            {
                "key": key,
                "label": label,
                "before": round(before, 1),
                "after": round(after, 1),
                "delta": round(after - before, 1),
                "unit": unit,
                "lower_is_better": lower_better,
            }
        )
    return result


def _base_kpis(db: Session) -> dict:
    metrics = kpi_metrics(db, 7)
    cranes = db.query(Crane).all()
    warehouses = db.query(Warehouse).all()
    queue = db.query(Container).filter(Container.status.in_(["waiting", "allocated", "loading"])).count()
    waiting_ships = db.query(Ship).filter(Ship.status.in_(["arrived", "waiting"])).all()
    return {
        "cranes_available": sum(1 for c in cranes if c.status == "idle"),
        "backlog": queue,
        "turnaround_h": metrics["ship_turnaround_h"] or 12.0,
        "throughput": metrics["throughput_per_day"],
        "storage_available": sum(w.available for w in warehouses),
        "wait_min": 0,
        "queue_ships": len(waiting_ships),
    }


def run_simulation(db: Session, scenario_type: str, params: dict, actor: str) -> SimulationScenario:
    if scenario_type not in SCENARIO_LABELS:
        raise AllocationError(f"Unknown scenario '{scenario_type}'")
    params = params or {}
    before_health = health(db)["score"]
    before = _base_kpis(db)
    after = dict(before)
    affected: dict[str, Any] = {"resources": [], "containers": [], "ships": []}
    recommendations: list[dict] = []
    narrative: list[str] = []
    delays: dict[str, Any] = {}

    if scenario_type == "crane_failure":
        cranes = db.query(Crane).all()
        crane = None
        if params.get("crane_code"):
            crane = next((c for c in cranes if c.code == params["crane_code"]), None)
            if not crane:
                raise AllocationError(f"Crane {params['crane_code']} not found")
        if not crane:
            active = [c for c in cranes if c.status == "active"]
            crane = (active or sorted(cranes, key=lambda c: c.utilization, reverse=True))[0]
        assignment = (
            db.query(Assignment)
            .filter(Assignment.kind == "crane", Assignment.resource_code == crane.code, Assignment.status == "active")
            .first()
        )
        containers = (
            db.query(Container)
            .filter(Container.crane_id == crane.id, Container.status.in_(["allocated", "loading", "in_transit"]))
            .all()
        )
        ship = assignment.ship if assignment else None
        replacement = sorted(
            [c for c in cranes if c.id != crane.id and c.status == "idle" and c.health >= 40],
            key=lambda c: c.health - c.utilization * 0.15,
            reverse=True,
        )
        delay_h = round(len(containers) * 2.4 / 60 + (0.4 if ship and ship.status == "unloading" else 0), 2)
        after["cranes_available"] = max(0, before["cranes_available"] - (1 if crane.status == "idle" else 0))
        after["backlog"] += len(containers)
        after["turnaround_h"] = round(before["turnaround_h"] + delay_h, 1)
        after["throughput"] = round(max(0.0, before["throughput"] - len(containers) * 0.5), 1)
        after_health = round(max(0.0, before_health - (4.0 + min(8.0, len(containers) * 0.35))), 1)
        affected["resources"].append(
            {"type": "crane", "code": crane.code, "detail": f"{crane.crane_type} · health {crane.health:.0f}% · {crane.status}"}
        )
        affected["containers"] = [c.code for c in containers[:12]]
        if ship:
            affected["ships"].append({"code": ship.code, "detail": f"Discharge supported by {crane.code}"})
        if replacement:
            recommendations.append(
                {
                    "action": f"Reassign discharge to {replacement[0].code}",
                    "detail": (
                        f"{replacement[0].code} is idle at {replacement[0].health:.0f}% health with "
                        f"{replacement[0].capacity_t} t capacity."
                    ),
                    "target": replacement[0].code,
                }
            )
        else:
            recommendations.append(
                {
                    "action": "Escalate to supervisor — no spare crane",
                    "detail": "No idle crane passes the health floor. Halt new discharge and repair before reallocating.",
                    "target": None,
                }
            )
        recommendations.append(
            {
                "action": "Re-sequence affected containers",
                "detail": f"{len(containers)} container(s) lose their crane. Hold them at quay and re-plan once a replacement is confirmed.",
                "target": None,
            }
        )
        delays = {"additional_hours": delay_h, "affected_containers": len(containers), "unit": "h"}
        narrative.append(
            f"{crane.code} fails while serving {ship.code if ship else 'an idle berth'}. "
            f"{len(containers)} tracked container(s) are affected and the modelled turnaround increases by {delay_h} h."
        )

    elif scenario_type == "sudden_ship":
        cargo = int(params.get("cargo_qty", 200))
        priority = params.get("priority", "critical")
        temp_ship = Ship(
            code=params.get("ship_code", "SIM-SH-01"),
            name=params.get("ship_name", "MV Meridian Star"),
            cargo_type=params.get("cargo_type", "general"),
            cargo_qty=cargo,
            priority=priority,
            eta=utcnow(),
            vessel_length_m=int(params.get("vessel_length_m", 300)),
            draft_m=float(params.get("draft_m", 13.0)),
            handling_hours=float(params.get("handling_hours", 9.0)),
            status="approaching",
        )
        dock_result = recommend_docks(db, temp_ship)
        top = dock_result["dock"]
        occupied = db.query(Dock).filter(Dock.status == "occupied").all()
        waiting = db.query(Ship).filter(Ship.status.in_(["arrived", "waiting"])).all()
        wait_min = top["wait_min"] if top else 240
        after["queue_ships"] = before["queue_ships"] + 1
        after["wait_min"] = wait_min
        after["backlog"] += cargo
        after["turnaround_h"] = round(before["turnaround_h"] + max(0.5, wait_min / 120), 1)
        after["throughput"] = round(before["throughput"] + cargo / 5, 1)
        after_health = round(max(0.0, before_health - 1.8 - (2.5 if not top else 0)), 1)
        affected["ships"] = [{"code": s.code, "detail": f"{s.status} · awaiting berth"} for s in waiting] + [
            {"code": temp_ship.code, "detail": f"Simulated arrival · {cargo} TEU · {priority} priority"}
        ]
        for dock in occupied:
            affected["resources"].append(
                {"type": "dock", "code": dock.code, "detail": f"Occupied by {dock.current_ship.code if dock.current_ship else 'vessel'}"}
            )
        if top:
            recommendations.append(
                {
                    "action": f"Pre-assign {top['code']} to {temp_ship.code}",
                    "detail": f"Berth available now with an allocation score of {top['score']}/100.",
                    "target": top["code"],
                }
            )
            for alt in list(dock_result["alternatives"].values())[:2]:
                recommendations.append(
                    {
                        "action": f"Hold {alt['code']} as fallback",
                        "detail": f"Alternative berth scored {alt['score']}/100.",
                        "target": alt["code"],
                    }
                )
        else:
            recommendations.append(
                {
                    "action": "Delay arrival / divert to outer anchorage",
                    "detail": "No berth clears the hard constraints. Expect queue growth and demurrage.",
                    "target": None,
                }
            )
        if waiting:
            recommendations.append(
                {
                    "action": "Protect waiting vessels",
                    "detail": f"{len(waiting)} vessel(s) already await berth. A critical-priority arrival pre-empts their slots.",
                    "target": None,
                }
            )
        delays = {"additional_wait_min": wait_min, "priority_impact": priority}
        narrative.append(
            f"A sudden {priority}-priority vessel with {cargo} TEU arrives. "
            + (
                f"{top['code']} is the best berth with a {top['score']}/100 score."
                if top
                else "No eligible berth exists at the current occupancy."
            )
            + f" {len(waiting)} vessel(s) already queue for a berth."
        )

    elif scenario_type == "truck_breakdown":
        vehicles = db.query(Vehicle).all()
        truck = None
        if params.get("truck_code"):
            truck = next((v for v in vehicles if v.code == params["truck_code"]), None)
            if not truck:
                raise AllocationError(f"Truck {params['truck_code']} not found")
        if not truck:
            busy = [v for v in vehicles if v.status in ("assigned", "in_transit")]
            truck = (busy or vehicles)[0]
        containers = [
            c for c in db.query(Container).filter(Container.vehicle_id == truck.id).all()
            if c.status in ("allocated", "in_transit")
        ]
        replacement = sorted(
            [
                v
                for v in vehicles
                if v.id != truck.id and v.status == "available" and v.fuel >= 20 and v.health >= 50 and v.driver
            ],
            key=lambda v: (v.fuel, v.health),
            reverse=True,
        )
        delay_h = round(len(containers) * 0.25 / max(1, len(replacement[:2])), 2)
        after["backlog"] += len(containers)
        after["turnaround_h"] = round(before["turnaround_h"] + delay_h, 1)
        after["throughput"] = round(max(0.0, before["throughput"] - len(containers) * 0.3), 1)
        after_health = round(max(0.0, before_health - 2.2), 1)
        affected["resources"].append(
            {"type": "vehicle", "code": truck.code, "detail": f"health {truck.health:.0f}% · fuel {truck.fuel:.0f}% · {truck.status}"}
        )
        affected["containers"] = [c.code for c in containers]
        for candidate in replacement[:3]:
            recommendations.append(
                {
                    "action": f"Substitute {candidate.code}",
                    "detail": (
                        f"Available with {candidate.fuel:.0f}% fuel, {candidate.health:.0f}% health and driver "
                        f"{candidate.driver.code if candidate.driver else 'unassigned'}."
                    ),
                    "target": candidate.code,
                }
            )
        if not replacement:
            recommendations.append(
                {
                    "action": "Hold container moves",
                    "detail": "No replacement truck passes fuel/health/driver constraints.",
                    "target": None,
                }
            )
        delays = {"additional_hours": delay_h, "affected_containers": len(containers), "replacement_count": len(replacement)}
        narrative.append(
            f"{truck.code} breaks down mid-shift. {len(containers)} container movement(s) must be re-homed"
            f" and {len(replacement)} replacement truck(s) clear the hard constraints."
        )

    elif scenario_type == "warehouse_shortage":
        warehouses = db.query(Warehouse).all()
        wh = None
        if params.get("warehouse_code"):
            wh = next((w for w in warehouses if w.code == params["warehouse_code"]), None)
            if not wh:
                raise AllocationError(f"Warehouse {params['warehouse_code']} not found")
        if not wh:
            wh = max(warehouses, key=lambda w: w.utilization)
        reduction = int(params.get("reduction_teu", 200))
        effective_capacity = max(1, wh.capacity_teu - reduction)
        new_available = max(0, effective_capacity - wh.occupancy)
        at_risk = (
            db.query(Container)
            .filter(
                Container.warehouse_id == wh.id,
                Container.status.in_(["allocated", "in_transit", "at_yard"]),
            )
            .count()
        )
        incoming = (
            db.query(Container)
            .filter(Container.warehouse_id == wh.id, Container.status == "in_transit")
            .count()
        )
        alternative = sorted(
            [w for w in warehouses if w.id != wh.id and w.status == "operational" and w.available > 0],
            key=lambda w: w.available,
            reverse=True,
        )
        ready = db.query(Container).filter(Container.status == "ready_for_dispatch").count()
        after["storage_available"] = max(0, before["storage_available"] - reduction)
        after["backlog"] += incoming
        after["turnaround_h"] = round(before["turnaround_h"] + incoming * 0.1, 1)
        after_health = round(max(0.0, before_health - 3.4), 1)
        affected["resources"].append(
            {
                "type": "warehouse",
                "code": wh.code,
                "detail": f"occupancy {wh.occupancy}/{wh.capacity_teu} TEU · {wh.utilization}%",
            }
        )
        affected["containers"] = [c.code for c in db.query(Container).filter(Container.warehouse_id == wh.id, Container.status == "in_transit").limit(12).all()]
        if alternative:
            target = alternative[0]
            recommendations.append(
                {
                    "action": f"Divert to {target.code}",
                    "detail": f"{target.available} TEU free at {target.utilization}% utilisation.",
                    "target": target.code,
                }
            )
        recommendations.append(
            {
                "action": "Release rail dispatch",
                "detail": f"{ready} container(s) are already staged for dispatch; a rail movement frees storage immediately.",
                "target": "rail",
            }
        )
        if new_available <= 0:
            recommendations.append(
                {
                    "action": "Pause inbound storage",
                    "detail": f"No effective storage remains at {wh.code}. Hold incoming trucks at quay.",
                    "target": None,
                }
            )
        delays = {"reduction_teu": reduction, "incoming_containers": incoming, "shortfall_teu": max(0, reduction - wh.available)}
        narrative.append(
            f"{wh.code} loses {reduction} TEU of capacity ({effective_capacity} TEU effective). "
            f"{incoming} inbound container(s) need an alternative destination and {at_risk} stored box(es) are in the affected zone."
        )

    scenario = SimulationScenario(
        scenario_type=scenario_type,
        name=SCENARIO_LABELS[scenario_type],
        params=params,
        status="complete",
    )
    result = {
        "before": {"health": before_health, "kpis": before},
        "after": {"health": after_health, "kpis": after},
        "comparison": _compare(before, after, before_health, after_health),
        "affected": affected,
        "recommendations": recommendations,
        "delays": delays,
        "narrative": narrative + [
            "Executed against an in-memory snapshot of the current port state. Live operational data is unchanged until the operator applies this scenario.",
        ],
        "data_note": "Simulation output is modelled from the synthetic dataset, not measured production performance.",
        "health": health(db),
    }
    scenario.result = result
    db.add(scenario)
    record_audit(
        db,
        actor=actor,
        action="simulation_run",
        entity_type="scenario",
        entity_code=scenario_type,
        detail=params and str(params)[:300] or "",
    )
    db.commit()
    db.refresh(scenario)
    return scenario


def latest_scenario(db: Session, include_applied: bool = True) -> SimulationScenario | None:
    statuses = ["complete", "applied"] if include_applied else ["complete"]
    return (
        db.query(SimulationScenario)
        .filter(SimulationScenario.status.in_(statuses))
        .order_by(SimulationScenario.created_at.desc(), SimulationScenario.id.desc())
        .first()
    )


def reset(db: Session, actor: str) -> int:
    rows = db.query(SimulationScenario).filter(SimulationScenario.status == "complete").all()
    for row in rows:
        row.status = "reset"
    record_audit(db, actor=actor, action="simulation_reset", entity_type="scenario", entity_code="all", detail=f"{len(rows)} scenario(s)")
    db.commit()
    return len(rows)


def apply_scenario(db: Session, scenario_id: int, actor: str) -> dict[str, Any]:
    scenario = db.get(SimulationScenario, scenario_id)
    if not scenario:
        raise AllocationError("Scenario not found")
    if scenario.status == "applied":
        raise AllocationError("Scenario has already been applied")
    if scenario.status == "reset":
        raise AllocationError("Scenario was reset and cannot be applied")
    params = scenario.params or {}
    result = scenario.result or {}
    summary = ""

    if scenario.scenario_type == "crane_failure":
        code = params.get("crane_code")
        if not code and result.get("affected", {}).get("resources"):
            code = result["affected"]["resources"][0]["code"]
        crane = db.query(Crane).filter(Crane.code == code).first()
        if not crane:
            raise AllocationError(f"Crane {code} not found")
        crane.status = "fault"
        for row in (
            db.query(Assignment)
            .filter(Assignment.kind == "crane", Assignment.resource_code == crane.code, Assignment.status == "active")
            .all()
        ):
            row.status = "released"
            row.released_at = utcnow()
        create_alert_once(
            db,
            severity="critical",
            category="crane_failure",
            title=f"{crane.code} failure applied",
            message=f"{crane.code} withdrawn after approved simulation. Reassign discharge immediately.",
            entity_type="crane",
            entity_code=crane.code,
            source="simulation",
        )
        summary = f"{crane.code} set to fault; active assignment released."
    elif scenario.scenario_type == "truck_breakdown":
        code = params.get("truck_code")
        if not code and result.get("affected", {}).get("resources"):
            code = result["affected"]["resources"][0]["code"]
        from app.models import Vehicle

        truck = db.query(Vehicle).filter(Vehicle.code == code).first()
        if not truck:
            raise AllocationError(f"Truck {code} not found")
        truck.status = "fault"
        create_alert_once(
            db,
            severity="critical",
            category="truck_breakdown",
            title=f"{truck.code} breakdown applied",
            message=f"{truck.code} withdrawn after approved simulation. Replace its active moves.",
            entity_type="vehicle",
            entity_code=truck.code,
            source="simulation",
        )
        summary = f"{truck.code} set to fault."
    elif scenario.scenario_type == "sudden_ship":
        from app.services.vessel_service import create_ship

        code = params.get("ship_code") or "SH-901"
        if db.query(Ship).filter(Ship.code == code).first():
            code = f"{code}-{scenario.id}"
        payload = SimpleNamespace(
            code=code,
            name=params.get("ship_name", "MV Meridian Star"),
            cargo_type=params.get("cargo_type", "general"),
            cargo_qty=int(params.get("cargo_qty", 200)),
            priority=params.get("priority", "critical"),
            eta=utcnow(),
            vessel_length_m=int(params.get("vessel_length_m", 300)),
            draft_m=float(params.get("draft_m", 13.0)),
            handling_hours=float(params.get("handling_hours", 9.0)),
        )
        ship, _ = create_ship(db, payload, actor)
        ship.status = "arrived"
        ship.arrived_at = utcnow()
        db.commit()
        summary = f"{ship.code} registered as an arrived high-priority vessel."
    elif scenario.scenario_type == "warehouse_shortage":
        code = params.get("warehouse_code")
        if not code and result.get("affected", {}).get("resources"):
            code = result["affected"]["resources"][0]["code"]
        warehouse = db.query(Warehouse).filter(Warehouse.code == code).first()
        if not warehouse:
            raise AllocationError(f"Warehouse {code} not found")
        warehouse.status = "restricted"
        create_alert_once(
            db,
            severity="critical",
            category="warehouse_capacity",
            title=f"{warehouse.code} capacity restriction applied",
            message=f"{warehouse.code} is restricted after approved simulation. Divert inbound storage.",
            entity_type="warehouse",
            entity_code=warehouse.code,
            source="simulation",
        )
        summary = f"{warehouse.code} set to restricted."

    scenario.status = "applied"
    scenario.applied_at = utcnow()
    event = record_event(
        db,
        type="scenario_applied",
        severity="warning" if scenario.scenario_type != "sudden_ship" else "info",
        title=f"Simulation applied · {scenario.name}",
        message=summary,
        entity_type="scenario",
        entity_code=str(scenario.id),
        payload={"scenario_type": scenario.scenario_type},
    )
    record_audit(
        db,
        actor=actor,
        action="simulation_applied",
        entity_type="scenario",
        entity_code=str(scenario.id),
        detail=summary,
    )
    db.commit()
    return {"scenario": _scenario_out(scenario), "summary": summary, "event": event}


def scenario_out(scenario: SimulationScenario) -> dict[str, Any]:
    data = _scenario_out(scenario)
    data["result"] = scenario.result
    return data
