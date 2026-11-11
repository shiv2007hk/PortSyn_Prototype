"""End-to-end API tests against a seeded temporary SQLite database."""

import time

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app as fastapi_app


def fresh_client() -> TestClient:
    return TestClient(fastapi_app)


def test_operational_routes_require_authentication(client):
    client = fresh_client()
    try:
        response = client.get("/api/dashboard")
        assert response.status_code == 401
    finally:
        client.close()


def test_login_rejects_bad_password(client):
    client = fresh_client()
    try:
        response = client.post(
            "/api/auth/login",
            json={"email": "priya.menon@portsync.demo", "password": "not-the-password"},
        )
        assert response.status_code == 401
    finally:
        client.close()


def test_public_tracking_needs_no_session(client):
    client = fresh_client()
    try:
        summary = client.get("/api/public/summary")
        assert summary.status_code == 200
        assert summary.json()["simulated"] is True
        track = client.get("/api/public/track", params={"code": "SH-104"})
        assert track.status_code == 200
        assert track.json()["kind"] == "ship"
        invalid = client.get("/api/public/track", params={"code": "not-a-code"})
        assert invalid.status_code == 422
    finally:
        client.close()


def test_signup_is_read_only_and_logout_invalidates_session(client):
    client = fresh_client()
    try:
        email = f"observer-{int(time.time() * 1000)}@portsync.demo"
        signup = client.post(
            "/api/auth/signup",
            json={"name": "Demo Observer", "email": email, "password": "Observer2026", "accept_terms": True},
        )
        assert signup.status_code == 201, signup.text
        payload = signup.json()
        assert payload["user"]["role"] == "viewer"
        csrf = payload["csrf_token"]
        client.headers.update({"X-CSRF-Token": csrf})

        assert client.get("/api/dashboard").status_code == 200
        blocked = client.post("/api/system/reset-demo", json={"confirm": "RESET"})
        assert blocked.status_code == 403
        assert "read-only" in blocked.json()["detail"].lower()

        logout = client.post("/api/auth/logout")
        assert logout.status_code == 200
        assert client.get("/api/auth/me").status_code == 401
        assert client.get("/api/dashboard").status_code == 401
    finally:
        client.close()


def test_csrf_is_required_for_mutations(api):
    headers = {"X-CSRF-Token": ""}
    response = api.post("/api/system/reset-demo", json={"confirm": "RESET"}, headers=headers)
    assert response.status_code == 403


def test_dashboard_contract(api):
    data = api.get("/api/dashboard").json()
    assert len(data["kpis"]) == 10
    assert 0 <= data["health"]["score"] <= 100
    assert abs(sum(c["weight"] for c in data["health"]["components"]) - 1) < 0.01
    assert len(data["activity"]) > 0
    assert len(data["charts"]["arrivals_7d"]) == 7
    assert data["data_note"]


def test_digital_twin_layout_and_ship_movement(api):
    before = api.get("/api/twin").json()
    assert before["layout"]["width"] == 1600
    assert len(before["layout"]["docks"]) == 4
    assert len(before["layout"]["crane_slots"]) == 6
    ship = next(s for s in before["ships"] if s["code"] == "SH-103")

    recommendation = api.post(
        "/api/allocations/recommend", json={"ship_code": "SH-103", "kind": "full"}
    ).json()
    dock_code = recommendation["dock"]["code"]
    accepted = api.post(
        "/api/allocations/accept",
        json={
            "ship_code": "SH-103",
            "dock_code": dock_code,
            "crane_code": recommendation["crane"]["code"],
            "truck_codes": [t["code"] for t in recommendation["trucks"]],
            "driver_codes": [d["code"] for d in recommendation["drivers"]],
            "warehouse_code": recommendation["warehouse"]["code"],
            "score": recommendation["overall_score"],
        },
    )
    assert accepted.status_code == 200, accepted.text

    after = api.get("/api/twin").json()
    moved = next(s for s in after["ships"] if s["code"] == "SH-103")
    assert moved["dock_code"] == dock_code
    assert (moved["x"], moved["y"]) != (ship["x"], ship["y"])
    dock = next(d for d in after["docks"] if d["code"] == dock_code)
    assert dock["status"] == "occupied"


def test_allocation_rejects_occupied_berth(api):
    response = api.post(
        "/api/allocations/accept",
        json={"ship_code": "SH-104", "dock_code": "D1"},
    )
    assert response.status_code == 409
    assert "occupied" in response.json()["detail"].lower()


def test_override_requires_reason(api):
    response = api.post(
        "/api/allocations/override",
        json={"ship_code": "SH-104", "dock_code": "D2"},
    )
    assert response.status_code == 422


def test_container_transition_guard(api):
    container = api.get("/api/containers?status=waiting&page_size=1").json()["items"][0]
    blocked = api.put(f"/api/containers/{container['code']}/status", json={"target_status": "delivered"})
    assert blocked.status_code == 409
    assert "dispatch" in blocked.json()["detail"].lower()


def test_container_full_lifecycle_and_dispatch(api):
    container = api.get("/api/containers?status=allocated&page_size=1").json()["items"][0]
    code = container["code"]
    vehicles = api.get("/api/resources?kind=vehicles").json()["vehicles"]
    truck = next(
        v
        for v in vehicles
        if v["status"] == "available" and v["fuel"] > 20 and v["health"] > 50 and v["driver_code"]
    )

    for payload in (
        {"target_status": "loading"},
        {"target_status": "in_transit", "vehicle_code": truck["code"]},
        {"target_status": "at_yard", "warehouse_code": "WH-B"},
        {"target_status": "ready_for_dispatch"},
    ):
        response = api.put(f"/api/containers/{code}/status", json=payload)
        assert response.status_code == 200, response.text

    created = api.post(
        "/api/dispatch", json={"mode": "road", "destination": "Pune ICD", "container_codes": [code]}
    )
    assert created.status_code == 201, created.text
    dispatch_code = created.json()["dispatch"]["code"]

    assert api.patch(f"/api/dispatch/{dispatch_code}/status", json={"status": "in_transit"}).status_code == 200
    completed = api.patch(f"/api/dispatch/{dispatch_code}/status", json={"status": "completed"})
    assert completed.status_code == 200, completed.text
    assert api.get(f"/api/containers/{code}").json()["container"]["status"] == "delivered"


def test_dispatch_requires_ready_containers(api):
    waiting = api.get("/api/containers?status=waiting&page_size=1").json()["items"][0]
    response = api.post(
        "/api/dispatch", json={"mode": "rail", "destination": "Delhi ICD", "container_codes": [waiting["code"]]}
    )
    assert response.status_code == 409


def test_warehouse_capacity_is_hard_constraint(api):
    warehouse = next(w for w in api.get("/api/warehouses").json()["items"] if w["code"] == "WH-A")
    filled = api.patch("/api/warehouses/WH-A", json={"capacity_teu": warehouse["occupancy"]})
    assert filled.status_code == 200
    incoming = api.get("/api/containers?status=in_transit&page_size=1").json()["items"]
    if not incoming:
        incoming = api.get("/api/containers?status=at_yard&page_size=1").json()["items"]
    response = api.post(
        "/api/warehouses/assign",
        json={"warehouse_code": "WH-A", "container_codes": [incoming[0]["code"]]},
    )
    assert response.status_code == 409
    assert "capacity" in response.json()["detail"].lower()


def test_simulation_is_read_only_until_applied(api):
    before = api.get("/api/resources?kind=cranes").json()["cranes"]
    crane = next(c for c in before if c["status"] == "active")
    scenario = api.post(
        "/api/simulations/run", json={"scenario_type": "crane_failure", "params": {"crane_code": crane["code"]}}
    )
    assert scenario.status_code == 200, scenario.text
    unchanged = api.get("/api/resources?kind=cranes").json()["cranes"]
    assert next(c for c in unchanged if c["code"] == crane["code"])["status"] == "active"

    applied = api.post("/api/simulations/apply", json={"scenario_id": scenario.json()["id"]})
    assert applied.status_code == 200, applied.text
    after = api.get("/api/resources?kind=cranes").json()["cranes"]
    assert next(c for c in after if c["code"] == crane["code"])["status"] == "fault"


def test_alerts_are_actionable(api):
    items = api.get("/api/alerts?status=active").json()["items"]
    assert items
    acknowledged = api.post(f"/api/alerts/{items[0]['id']}/acknowledge", json={})
    assert acknowledged.status_code == 200
    assert acknowledged.json()["status"] == "acknowledged"
    resolved = api.post(f"/api/alerts/{items[0]['id']}/resolve", json={})
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"


def test_assistant_is_grounded_without_llm(api):
    status = api.get("/api/assistant/status").json()
    assert status["read_only"] is True
    assert status["mode"] in ("rules", "llm")
    response = api.post("/api/assistant/chat", json={"message": "Which docks are available?"})
    body = response.json()
    assert response.status_code == 200
    assert body["grounded"] is True
    assert body["answer"]
    assert body["mode"] in ("rules", "llm")


def test_analytics_and_csv_export(api):
    analytics = api.get("/api/analytics?days=7").json()
    assert len(analytics["kpis"]) == 10
    assert analytics["comparison"]["note"]
    export = api.get("/api/analytics/export?dataset=ships")
    assert export.status_code == 200
    assert export.headers["content-type"].startswith("text/csv")
    assert export.text.splitlines()[0].startswith("code,name,status")


def test_container_qr(api):
    code = api.get("/api/containers?page_size=1").json()["items"][0]["code"]
    response = api.get(f"/api/containers/{code}/qr.svg")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
