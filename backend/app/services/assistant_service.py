"""Grounded operational assistant.

The rules engine always answers from the live database. An OpenAI-compatible
LLM is only called when LLM_API_KEY is configured; the same grounded fact sheet
is supplied and the model is instructed to refuse inventing data. The assistant
is strictly read-only — it can recommend, never execute.
"""

import logging
import os
import re

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.timeutil import utcnow
from app.models import Alert, Container, Crane, Dispatch, Dock, Driver, Ship, Vehicle, Warehouse
from app.services.analytics_engine import health, kpi_metrics
from app.services.common import hours_since
from app.services.maintenance_engine import crane_risk

logger = logging.getLogger("portsync.assistant")

SUGGESTIONS = [
    "Which ships are currently delayed?",
    "Which docks are available?",
    "Which trucks are ready?",
    "Which containers have been waiting the longest?",
    "What happens if CR-01 fails?",
    "Which warehouse has available capacity?",
]


def _facts(db: Session) -> dict:
    metrics = kpi_metrics(db, 7)
    health_data = health(db)
    docks = db.query(Dock).all()
    ships = db.query(Ship).filter(Ship.status != "departed").order_by(Ship.eta).all()
    trucks = db.query(Vehicle).all()
    drivers = db.query(Driver).all()
    warehouses = db.query(Warehouse).all()
    waiting = (
        db.query(Container)
        .filter(Container.status.in_(["waiting", "allocated"]))
        .order_by(Container.created_at)
        .limit(8)
        .all()
    )
    cranes = db.query(Crane).all()
    dispatches = db.query(Dispatch).filter(Dispatch.status.in_(["pending", "scheduled", "in_transit"])).all()
    alerts = db.query(Alert).filter(Alert.status == "active").all()
    return {
        "metrics": metrics,
        "health": health_data,
        "docks": docks,
        "ships": ships,
        "trucks": trucks,
        "drivers": drivers,
        "warehouses": warehouses,
        "waiting": waiting,
        "cranes": cranes,
        "dispatches": dispatches,
        "alerts": alerts,
    }


def _ship_reason(db: Session, ship: Ship) -> str:
    if ship.status == "departed":
        return f"{ship.code} has departed."
    if ship.status == "unloading":
        return f"{ship.code} is discharging at {ship.dock.code if ship.dock else 'an unassigned berth'} ({ship.handling_progress:.0f}% complete)."
    if ship.status == "docked":
        return f"{ship.code} is alongside at {ship.dock.code if ship.dock else '—'} awaiting discharge completion."
    reasons = []
    if not ship.dock:
        available = [d for d in db.query(Dock).all() if d.status == "available"]
        reasons.append(f"no berth is currently assigned ({len(available)} berth(s) are free)")
    if ship.eta and ship.eta < utcnow():
        reasons.append(f"its ETA passed {hours_since(ship.eta):.1f} h ago")
    crane_assigned = any(
        c.status == "active" and ship.dock and c.dock_id == ship.dock.id for c in db.query(Crane).all()
    )
    if ship.dock and not crane_assigned:
        reasons.append("no crane is actively assigned at that berth")
    if not reasons:
        reasons.append(f"it is currently {ship.status}")
    return f"{ship.code} is delayed because " + " and ".join(reasons) + "."


def _rule_answer(db: Session, message: str, facts: dict) -> tuple[str, list[dict]]:
    text = message.lower()
    metrics = facts["metrics"]
    refs: list[dict] = []

    ship_match = re.search(r"sh-\d{2,4}", text.upper())
    crane_match = re.search(r"cr-\d{2}", text.upper())

    if "fail" in text and crane_match:
        code = crane_match.group(0)
        crane = db.query(Crane).filter(Crane.code == code).first()
        if not crane:
            return f"I could not find crane {code} in the operational registry.", refs
        risk = crane_risk(crane)
        affected = db.query(Container).filter(Container.crane_id == crane.id, Container.status.in_(["loading", "in_transit", "allocated"])).count()
        spares = [
            c
            for c in db.query(Crane).all()
            if c.id != crane.id and c.status == "idle" and c.health >= 40 and (not c.dock_id or not crane.dock_id or c.dock_id == crane.dock_id)
        ]
        spares.sort(key=lambda c: c.health, reverse=True)
        lines = [
            f"Simulated impact if {code} fails:",
            f"• {affected} tracked container(s) would lose their crane.",
            f"• {code} currently shows {crane.health:.0f}% health and a rule-based risk index of {risk['risk_score']}/100.",
            f"• {len(spares)} compatible spare crane(s) pass the health floor"
            + (f": {', '.join(c.code for c in spares[:3])}." if spares else "."),
            "• Recommended: use Simulation Centre → Crane failure to compare turnaround impact before applying any change.",
            "This is a what-if analysis of simulated data; nothing has been changed.",
        ]
        refs.append({"label": "Affected containers", "value": str(affected)})
        refs.append({"label": "Risk index", "value": f"{risk['risk_score']}/100 (advisory)"})
        return "\n".join(lines), refs

    if "warehouse" in text and ("capacity" in text or "available" in text or "space" in text):
        rows = sorted(facts["warehouses"], key=lambda w: w.available, reverse=True)
        lines = ["Warehouse capacity right now:"]
        for w in rows:
            lines.append(
                f"• {w.code} — {w.available} TEU free ({w.occupancy}/{w.capacity_teu} used, {w.utilization}% · {w.status})"
            )
            refs.append({"label": w.code, "value": f"{w.available} TEU free"})
        if rows:
            lines.append(f"Best receiving option: {rows[0].code}. Capacity is enforced as a hard constraint.")
        return "\n".join(lines), refs

    if "truck" in text or "vehicle" in text:
        ready = [v for v in facts["trucks"] if v.status == "available" and v.fuel >= 20 and v.health >= 50 and v.driver and v.driver.duty_status == "on_duty"]
        lines = [f"{len(ready)} truck(s) are cleared for dispatch (available, fuel ≥ 20%, health ≥ 50%, on-duty driver):"]
        for v in ready[:8]:
            lines.append(f"• {v.code} — {v.fuel:.0f}% fuel, {v.health:.0f}% health, driver {v.driver.code if v.driver else '—'}")
            refs.append({"label": v.code, "value": f"fuel {v.fuel:.0f}%"})
        blocked = [v for v in facts["trucks"] if v not in ready]
        if blocked:
            lines.append(f"{len(blocked)} truck(s) are not dispatchable (low fuel, maintenance, fault, or no on-duty driver).")
        return "\n".join(lines), refs

    if "driver" in text:
        on_duty = [d for d in facts["drivers"] if d.duty_status == "on_duty"]
        assigned = {v.driver_id for v in facts["trucks"] if v.driver_id}
        free = [d for d in on_duty if d.id not in assigned]
        lines = [
            f"{len(on_duty)} of {len(facts['drivers'])} drivers are on duty; {len(free)} have no vehicle assigned.",
        ]
        for d in free[:8]:
            lines.append(f"• {d.code} — {d.name} · workload {d.workload:.0f}% · {d.shift}")
        return "\n".join(lines), refs

    if "dock" in text and ("available" in text or "free" in text):
        free = [d for d in facts["docks"] if d.status == "available"]
        lines = [f"{len(free)} berth(s) are available right now:"] if free else ["No berth is currently available."]
        for d in free:
            lines.append(f"• {d.code} ({d.name}) — {d.capacity_teu} TEU, max {d.max_length_m} m LOA / {d.max_draft_m} m draft")
            refs.append({"label": d.code, "value": f"{d.capacity_teu} TEU"})
        busy = [d for d in facts["docks"] if d.status != "available"]
        for d in busy:
            lines.append(f"• {d.code} — {d.status}" + (f" (by {d.current_ship.code})" if d.current_ship else ""))
        return "\n".join(lines), refs

    if ship_match:
        code = ship_match.group(0)
        ship = db.query(Ship).filter(Ship.code == code).first()
        if not ship:
            return f"I cannot find vessel {code} in the operational registry. I will not invent its status.", refs
        lines = [
            f"{ship.code} · {ship.name}",
            f"• Status: {ship.status.replace('_', ' ')}" + (f" at {ship.dock.code}" if ship.dock else ""),
            f"• Cargo: {ship.cargo_qty} TEU {ship.cargo_type} · priority {ship.priority}",
            f"• ETA: {ship.eta.strftime('%d %b %H:%M')} UTC · arrival {ship.arrived_at.strftime('%d %b %H:%M') if ship.arrived_at else 'pending'}",
            f"• Discharge: {ship.handling_progress:.0f}%",
        ]
        if "delay" in text or "late" in text:
            lines.append(_ship_reason(db, ship))
        refs.append({"label": ship.code, "value": ship.status})
        return "\n".join(lines), refs

    if "container" in text and ("wait" in text or "queue" in text or "longest" in text):
        waiting = facts["waiting"]
        if not waiting:
            return "No containers are currently waiting for allocation.", refs
        lines = [f"{len(waiting)} container(s) in the active queue. Longest waiting:"]
        for c in waiting[:5]:
            hours = hours_since(c.created_at) or 0
            lines.append(
                f"• {c.code} — {hours:.1f} h · {c.status.replace('_', ' ')} · {c.cargo_type} · ship {c.ship.code if c.ship else '—'}"
            )
            refs.append({"label": c.code, "value": f"{hours:.1f} h"})
        if metrics["containers_waiting_24h"]:
            lines.append(f"{metrics['containers_waiting_24h']} container(s) exceed the 24 h service target.")
        return "\n".join(lines), refs

    if "dispatch" in text:
        pending = facts["dispatches"]
        by_status: dict[str, int] = {}
        for d in pending:
            by_status[d.status] = by_status.get(d.status, 0) + 1
        lines = [f"{len(pending)} dispatch(es) in flight: " + ", ".join(f"{k} {v}" for k, v in by_status.items())]
        for d in pending[:6]:
            lines.append(f"• {d.code} — {d.mode} to {d.destination} · {d.status} · {len(d.items)} box(es)")
        return "\n".join(lines), refs

    if "ship" in text and ("delay" in text or "late" in text or "wait" in text):
        delayed = [
            s
            for s in facts["ships"]
            if s.status in ("approaching", "arrived", "waiting") and s.eta and s.eta < utcnow()
        ]
        if not delayed:
            return f"No vessel is currently past its ETA. {len(facts['ships'])} vessel(s) are in the plan.", refs
        lines = [f"{len(delayed)} vessel(s) are past ETA:"]
        for s in delayed:
            lines.append(f"• {s.code} — {s.status} · ETA {s.eta.strftime('%d %b %H:%M')} UTC · {hours_since(s.eta):.1f} h overdue")
            refs.append({"label": s.code, "value": f"{hours_since(s.eta):.1f} h late"})
        return "\n".join(lines), refs

    if "alert" in text:
        active = facts["alerts"]
        lines = [f"{len(active)} alert(s) are active."]
        for a in sorted(active, key=lambda x: {"critical": 0, "warning": 1, "info": 2}[x.severity])[:8]:
            lines.append(f"• [{a.severity.upper()}] {a.title}")
        return "\n".join(lines), refs

    if "health" in text or "status" in text or "overview" in text or "summary" in text:
        h = facts["health"]
        lines = [
            f"Port health is {h['score']}/100 ({h['grade']}).",
            f"• {metrics['ships_total']} active vessel(s) · {metrics['available_docks']} berth(s) free · {metrics['containers_waiting']} container(s) queued",
            f"• {metrics['available_trucks']} truck(s) available · {metrics['available_drivers']} driver(s) on duty",
            f"• {metrics['active_alerts']} active alert(s) · dispatch delay {metrics['dispatch_delay_h']} h",
            "Ask me about berths, trucks, waiting containers, warehouse capacity or a specific vessel.",
        ]
        for comp in h["components"]:
            refs.append({"label": comp["label"], "value": f"{comp['value']}/100"})
        return "\n".join(lines), refs

    return (
        "I can answer questions about vessels, berths, trucks, drivers, containers, warehouses, dispatches and alerts using live operational data. "
        "Try one of the suggested questions below.",
        refs,
    )


def _context_sheet(facts: dict) -> str:
    metrics = facts["metrics"]
    lines = [
        "LIVE OPERATIONAL SNAPSHOT (synthetic simulator data)",
        f"Port health: {facts['health']['score']}/100 ({facts['health']['grade']})",
        f"Vessels: {metrics['ships_total']} total, {metrics['ships_active']} active, {metrics['ships_arriving']} arriving",
        f"Berths: {metrics['available_docks']} available, occupancy {metrics['dock_occupancy_pct']}%",
        f"Trucks: {metrics['available_trucks']} available of {len(facts['trucks'])}",
        f"Drivers on duty: {metrics['available_drivers']} of {len(facts['drivers'])}",
        f"Containers waiting: {metrics['containers_waiting']} ({metrics['containers_waiting_24h']} over 24h)",
        f"Active alerts: {metrics['active_alerts']}; dispatch delay avg {metrics['dispatch_delay_h']} h",
        "VESSELS:",
    ]
    for s in facts["ships"]:
        lines.append(
            f"- {s.code} {s.name}: {s.status}, {s.cargo_qty} TEU, {s.priority} priority, "
            f"dock {s.dock.code if s.dock else 'none'}, progress {s.handling_progress:.0f}%, ETA {s.eta.isoformat()}"
        )
    lines.append("BERTHS:")
    for d in facts["docks"]:
        lines.append(f"- {d.code} {d.name}: {d.status}, {d.capacity_teu} TEU, ship {d.current_ship.code if d.current_ship else 'none'}")
    lines.append("WAREHOUSES:")
    for w in facts["warehouses"]:
        lines.append(f"- {w.code}: {w.occupancy}/{w.capacity_teu} TEU, {w.utilization}%, status {w.status}")
    lines.append("CRANES:")
    for c in facts["cranes"]:
        lines.append(f"- {c.code} {c.crane_type}: {c.status}, health {c.health:.0f}%, dock {c.dock.code if c.dock else 'none'}")
    lines.append("TRUCKS (first 12):")
    for v in facts["trucks"][:12]:
        lines.append(f"- {v.code}: {v.status}, fuel {v.fuel:.0f}%, health {v.health:.0f}%, driver {v.driver.code if v.driver else 'none'}")
    lines.append("LONGEST WAITING CONTAINERS:")
    for c in facts["waiting"]:
        lines.append(f"- {c.code}: {c.status}, ship {c.ship.code if c.ship else 'none'}, created {c.created_at.isoformat()}")
    lines.append("ACTIVE ALERTS:")
    for a in facts["alerts"][:15]:
        lines.append(f"- [{a.severity}] {a.title}: {a.message}")
    return "\n".join(lines)


def _llm_answer(db: Session, message: str, history: list[dict], facts: dict) -> str | None:
    if not settings.llm_configured:
        return None
    system = (
        "You are PortSync's port operations assistant. Answer ONLY using the operational snapshot provided. "
        "Never invent vessel, resource, container or performance data. If the snapshot does not contain the answer, say so. "
        "All data is synthetic simulator data — state that when relevant. You are read-only: recommend actions, never claim to execute them. "
        "Be concise, use short bullet points, and include concrete codes and numbers from the snapshot."
    )
    messages = [{"role": "system", "content": system}]
    for row in history[-8:]:
        messages.append({"role": row["role"], "content": row["content"]})
    messages.append(
        {
            "role": "user",
            "content": f"OPERATIONAL SNAPSHOT:\n{_context_sheet(facts)}\n\nQUESTION: {message}",
        }
    )
    try:
        # trust_env=False: httpx's NO_PROXY parsing crashes on IPv6 entries like
        # [::1] (Invalid port ':1]') and would kill every call. The proxy, if any,
        # is honoured explicitly via HTTPS_PROXY below.
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
        with httpx.Client(timeout=25, proxy=proxy, trust_env=False) as client:
            response = client.post(
                f"{settings.llm_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.llm_api_key}"},
                json={"model": settings.llm_model, "messages": messages, "temperature": 0.2, "max_tokens": 500},
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        logger.exception("LLM assistant call failed; falling back to rules engine")
        return None


def answer(db: Session, message: str, history: list[dict]) -> dict:
    facts = _facts(db)
    llm_text = _llm_answer(db, message, history, facts)
    if llm_text:
        return {
            "answer": llm_text,
            "mode": "llm",
            "grounded": True,
            "facts": [],
            "suggestions": SUGGESTIONS,
            "data_note": "Answers use the synthetic PortSync dataset. Read-only assistant.",
        }
    text, refs = _rule_answer(db, message, facts)
    return {
        "answer": text,
        "mode": "rules",
        "grounded": True,
        "facts": refs,
        "suggestions": SUGGESTIONS,
        "data_note": (
            "Answered from the live operational database. Data is synthetic. "
            + ("LLM key not configured — using the built-in rules engine." if not settings.llm_configured else "LLM unavailable — using the rules engine.")
        ),
    }
