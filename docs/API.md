# PortSync API

Base URL (local): `http://127.0.0.1:8010`

Interactive docs: `/docs` (Swagger UI) and `/redoc`. OpenAPI JSON: `/openapi.json`.

All application routes are mounted under `/api`. Every number in the system is produced by the deterministic simulator; no live GPS, vessel AIS or equipment telemetry is ingested. This is stated in the API root response, the dashboard payload and the assistant replies.

## Conventions

### Authentication

All `/api` routes except the public set (see below) require a session. Sessions are issued by `/api/auth/login` and `/api/auth/signup` and delivered as an **HttpOnly cookie** (`SESSION_COOKIE_NAME`, default `portsync_session`); the cookie is flagged `Secure` when `ENVIRONMENT=production`/`staging` or the request arrives over HTTPS. Session tokens are persisted only as SHA-256 digests and are revoked by logout or expiry (`SESSION_HOURS`, or `REMEMBER_DAYS` with "remember this device").

Every non-safe request (`POST`/`PUT`/`PATCH`/`DELETE`) must carry the CSRF double-submit header (`CSRF_HEADER`, default `X-CSRF-Token`) with the token returned in the login/signup/`/api/auth/me` payload. Missing or wrong tokens receive `403`.

Roles: `supervisor` and `operator` accounts are seeded for demonstrations only; public signup always creates **read-only `viewer` accounts**, which the backend blocks from every mutation except logout (`403`), regardless of client UI.

`GET /api/auth/session-policy` reports the effective session policy (hours, remember days, min password length, `signup_role: "viewer"`).

### Audit actor

Mutating requests are attributed to the signed-in session's user. An optional `X-Actor: Priya Menon` header is honoured as an audit label fallback (trimmed to 60 characters) but is never authorization.

### Errors

| Status | Meaning |
| --- | --- |
| `400` | Malformed request body |
| `401` | No valid session (protected route) or bad credentials (`/api/auth/login`) |
| `403` | CSRF verification failed, or the signed-in viewer attempted a mutation |
| `404` | Entity code not found |
| `409` | Business-rule conflict (double-booking, invalid lifecycle transition, capacity exceeded, allocation impossible, maintenance task clash, duplicate signup email) |
| `422` | Validation failure. `detail` can be a string (domain rule) or a FastAPI array of field errors |
| `500` | Unhandled server error |

`AllocationError` is mapped to `409` and `ValueError` to `422` by handlers in `app/main.py`; routers also translate domain errors explicitly.

### Pagination

List endpoints that paginate return:

```json
{ "items": [], "page": 1, "page_size": 30, "total": 0, "pages": 1 }
```

### Synthetic data

`/api/dashboard`, `/api/twin`, `/api/simulations/*` and assistant replies all include `simulated: true` or an explicit `source_note` / `disclaimer`. The simulation clock is paced by `SIM_TICK_SECONDS` and seeded by `SIM_SEED` (default `20261`).

## Endpoint map

### Authentication (`/api/auth/*`)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Body `{"email","password","remember"}` → session payload + HttpOnly cookie |
| POST | `/api/auth/signup` | Body `{"name","email","password","terms"}` → creates a read-only `viewer` + session. Duplicate email → `409`; weak password → `422` |
| GET | `/api/auth/me` | Current session payload (`user`, `csrf_token`, `expires_at`) or `401` |
| POST | `/api/auth/logout` | Revokes the server session and clears the cookie |
| GET | `/api/auth/session-policy` | Session policy for the login/signup screens |

Session payload shape:

```json
{
  "user": { "id": 1, "code": "USR-01", "name": "Priya Menon", "role": "supervisor", "email": "priya.menon@portsync.demo" },
  "csrf_token": "…",
  "expires_at": "2026-11-11T18:00:00Z"
}
```

### Public website data (`/api/public/*`, no session required)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/public/summary` | Docks connected, active equipment, sync %, next arrivals — powers the landing hero widget |
| GET | `/api/public/track?code=SH-104` | Public status for a vessel (`SH-NNN`) or container (`CONT-NNNN`); `422` on pattern mismatch, `404` when unknown |

Both responses carry `simulated: true` and a `data_note` stating the data comes from the deterministic simulator, not live telemetry. Only code, status, location/berth and timestamps are exposed — no operational internals.

### System

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness, DB state, tick count, connected WebSocket clients |
| GET | `/api/system/info` | App, clock, user, environment, seed, LLM mode |
| GET | `/api/system/users` | Seeded operator profiles |
| GET | `/api/system/settings` | Health weights, resource weights, simulator clock |
| PUT | `/api/system/health-weights` | Replace the five health-score weights (each `0..1`) |
| PUT | `/api/system/sim-clock` | Pause/resume (`running`) and speed (`0.25..3`) |
| GET | `/api/system/audit` | Paginated audit trail (`page`, `page_size`) |
| POST | `/api/system/reset-demo` | Reseed the deterministic demo. Body: `{"confirm":"RESET"}` |

Reset is destructive by design, requires the literal confirmation string, and is intended for demos only.

### Dashboard, events and analytics

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | 10 KPIs, health breakdown, docks, queues, activity, analytics series, twin summary |
| GET | `/api/events` | Filter by `type`, `severity`, `entity_code`; paginated |
| GET | `/api/analytics` | `days=1..90`, `granularity=day\|week`: throughput, turnaround, utilisation, backlog |
| GET | `/api/analytics/bottlenecks` | Ranked constraint list |
| GET | `/api/analytics/export` | CSV download. `dataset=summary\|containers\|ships\|dispatches\|alerts\|activity`, `days=1..90` |

### Digital twin

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/twin` | Backend-computed 1600×900 layout: docks, vessels, cranes, trucks, warehouses, yard, KPIs, clock |

The twin never invents positions in the browser; every marker comes from this payload or a WebSocket `twin` frame.

### Ships and docks

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/ships` | List with status filters and pagination |
| GET | `/api/ships/{code}` | Vessel detail, containers, assignment history |
| POST | `/api/ships` | Register a vessel |
| PUT | `/api/ships/{code}` | Update editable fields |
| POST | `/api/ships/{code}/arrive` | Mark arrived / open discharge |
| POST | `/api/ships/{code}/unload` | Start discharge |
| POST | `/api/ships/{code}/unload/complete` | Complete discharge |
| POST | `/api/ships/{code}/depart` | Depart; blocked while operational work is open |
| GET | `/api/docks` | Berth list, occupancy, compatibility |
| PATCH | `/api/docks/{code}` | Status / capacity / notes |

### Resources

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/resources` | Aggregate crane, vehicle, driver inventory |
| GET/POST | `/api/resources/cranes` | List / create crane (`CR-NN`) |
| PUT/DELETE | `/api/resources/cranes/{code}` | Update / withdraw |
| GET/POST | `/api/resources/vehicles` | List / create truck |
| PUT/DELETE | `/api/resources/vehicles/{code}` | Update / withdraw |
| GET/POST | `/api/resources/drivers` | List / create driver |
| PUT/DELETE | `/api/resources/drivers/{code}` | Update / withdraw |
| GET | `/api/resources/{kind}/{code}/history` | Assignment + audit history (`kind=crane\|vehicle\|driver`) |

Deletes are guarded: equipment tied to active work is withdrawn instead of removed, and the response explains the guard.

### Allocation (explainable optimizer)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/allocations/recommend` | Rank dock / crane / truck / driver / warehouse candidates |
| POST | `/api/allocations/accept` | Commit the recommended plan; rejects double-booking |
| POST | `/api/allocations/override` | Commit a manual plan; `reason` is mandatory |
| GET | `/api/allocations/history` | Assignment audit, filter by `status`, `kind`, `ship_code` |

Recommend body:

```json
{ "ship_code": "SH-104", "kind": "full" }
```

Decision body (`accept` / `override`):

```json
{
  "ship_code": "SH-104",
  "dock_code": "D2",
  "crane_code": "CR-04",
  "truck_codes": ["TR-07"],
  "driver_codes": ["DR-03"],
  "warehouse_code": "WH-A",
  "score": 87.4,
  "source": "optimizer",
  "explanation": "Hard constraints satisfied; weighted score 87.4.",
  "reason": "Required only for override"
}
```

Hard constraints are applied before weighted scoring. A resource already committed to an overlapping window cannot be assigned twice — the API returns `409`.

### Containers

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/containers` | Filter by status, ship, warehouse, priority; paginated |
| GET | `/api/containers/board` | Kanban columns and counts |
| GET | `/api/containers/{code}` | Detail with event timeline and QR URL |
| PUT | `/api/containers/{code}/status` | Validated lifecycle transition |
| GET | `/api/containers/{code}/qr.svg` | QR code SVG for the container code |

Lifecycle:

```
waiting → allocated → loading → in_transit → at_yard → ready_for_dispatch → delivered
                ↑         |
                └ waiting ┘   (allocated → waiting is the only rollback)
```

`delivered` is reachable only through dispatch completion. A direct container status update to `delivered` is rejected with `409`.

### Warehouses

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/warehouses` | Capacity, occupancy, thresholds, tracked container counts |
| PATCH | `/api/warehouses/{code}` | Status, threshold, capacity; capacity cannot drop below occupancy |
| POST | `/api/warehouses/assign` | Move containers into a warehouse with capacity enforcement |

```json
{ "warehouse_code": "WH-A", "container_codes": ["CT-1042"], "note": "Priority stack" }
```

### Dispatch

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dispatch` | Road/rail dispatch list with summary |
| GET | `/api/dispatch/ready` | Dispatchable containers and eligible trucks |
| GET | `/api/dispatch/{code}` | Dispatch detail |
| POST | `/api/dispatch` | Create a road or rail dispatch |
| PATCH | `/api/dispatch/{code}/status` | `pending → scheduled → in_transit → completed`; cancel only from `pending`/`scheduled` |

```json
{
  "mode": "road",
  "destination": "Inland Depot North",
  "container_codes": ["CT-1042"],
  "carrier": "Coastal Haulage",
  "vehicle_code": "TR-07"
}
```

Completing a dispatch is the only path that can set its containers to `delivered`.

### Simulations

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/simulations` | Recent complete/applied scenarios |
| GET | `/api/simulations/current` | Latest scenario or `null` |
| POST | `/api/simulations/run` | Run a scenario on a read-only snapshot |
| POST | `/api/simulations/reset` | Reset scenario records |
| POST | `/api/simulations/apply` | Explicitly commit a scenario's proposed changes |

```json
{ "scenario_type": "crane_failure", "params": { "crane_code": "CR-04" } }
```

Supported types: `crane_failure`, `sudden_ship`, `truck_breakdown`, `warehouse_shortage`. `run` never mutates operational tables. `apply` requires the scenario id and performs the mutation plus audit/event records.

Apply body:

```json
{ "scenario_id": 12 }
```

### Alerts and maintenance

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/alerts` | Filter by severity, status, category |
| GET | `/api/alerts/summary` | Counts and rule-evaluated totals |
| POST | `/api/alerts/scan` | Run the operational alert rules now |
| POST | `/api/alerts/{id}/acknowledge` | Acknowledge |
| POST | `/api/alerts/{id}/resolve` | Resolve |
| POST | `/api/alerts/{id}/maintenance` | Create a maintenance task from a crane/truck alert |
| GET | `/api/maintenance` | Overview, risk register summary, tasks |
| GET | `/api/maintenance/risk` | Rule-based predictive maintenance risk list |
| POST | `/api/maintenance/tasks` | Create a task for `crane` or `vehicle` |
| PATCH | `/api/maintenance/tasks/{code}` | `scheduled → in_progress → completed` |

Maintenance advice is a transparent rule-based advisory, not a trained failure model. The response carries this disclaimer.

### Assistant

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/assistant/status` | `llm_configured`, mode (`llm` or `rules`), suggested prompts |
| POST | `/api/assistant/chat` | Grounded, read-only answer |

```json
{
  "message": "Which dock should SH-104 use?",
  "history": [{ "role": "user", "content": "What is the current health score?" }]
}
```

The assistant reads live operational state, never writes to the database, never executes changes, and instructs the operator to use the approval flow. When `LLM_API_KEY` is blank the backend rules engine answers from database facts. The key is read from backend environment variables only and is never returned to the browser.

## WebSocket

Connect to `ws://127.0.0.1:8010/ws/operations` (or same-origin `/ws/operations` through the dev/build proxy). **A valid session cookie is required**; unauthenticated sockets are closed with code `1008` before any data is sent.

On connect the server sends:

1. `hello` — topics and `simulated: true`
2. `twin` — the current digital twin state
3. `invalidate` — `{"topics":["all"]}` so the client can refetch

Server messages:

| `type` | Payload | Meaning |
| --- | --- | --- |
| `hello` | `{server, simulated, topics}` | Handshake metadata |
| `twin` | full twin state | Positions/KPIs changed; replace twin state |
| `event` | operational event object + `topics` | New activity event |
| `invalidate` | `{topics: string[]}` | Refetch TanStack Query caches for those topics |
| `pong` | — | Reply to a client `ping` |

Send the literal text `ping` to keep intermediaries alive; the server answers `pong`. The client reconnects with backoff after disconnects.

## Quick checks

```bash
# Health and public tracking need no session
curl http://127.0.0.1:8010/api/health
curl "http://127.0.0.1:8010/api/public/track?code=SH-104"

# Authenticated calls: log in, keep the cookie jar, capture the CSRF token
# from the login response, then send it on every mutation
curl -c cookies.txt -s -X POST http://127.0.0.1:8010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"priya.menon@portsync.demo","password":"PortSync2026!","remember":false}' \
  -o login.json
CSRF=$(python -c "import json;print(json.load(open('login.json'))['csrf_token'])")
curl -b cookies.txt -X POST http://127.0.0.1:8010/api/allocations/recommend \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"ship_code":"SH-104","kind":"full"}'
curl -b cookies.txt -OJ "http://127.0.0.1:8010/api/analytics/export?dataset=summary&days=7"
rm -f cookies.txt login.json
```
