# PortSync

**One Port. Every Resource. Intelligent Operations.**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/shiv2007hk/PortSyn_Prototype)

PortSync is a production-style smart port operations platform delivered as three connected experiences: a cinematic public website with a live tracking widget, a split-screen login/signup flow backed by real session authentication, and a dense operator workspace with a live operations dashboard, interactive digital twin, explainable resource allocation, container lifecycle, warehouse and dispatch control, what-if simulation, rule-based predictive maintenance and a grounded read-only assistant.

Every vessel schedule, position, container movement, crane, truck and sensor value is **synthetic simulator output**. No live AIS, GPS or equipment telemetry is ingested. The UI, API responses and assistant all label this explicitly.

## Highlights

- **Public website (`/`)** — cinematic maritime hero with an animated cargo vessel, drifting wave bands and parallax port, sticky navigation, floating container/vessel/schedule tracking widget backed by the public API, capability showcase, digital twin preview, allocation workflow, what-if simulation and operational-impact sections. Full light/dark theming and `prefers-reduced-motion` support.
- **Authentication (`/login`, `/signup`)** — real server sessions with HttpOnly cookies, CSRF-protected mutations and hashed passwords. Signup validation, password strength meter, show/hide password, remember-me, duplicate-email and wrong-password error states. New accounts are read-only viewers; no public signup can create an administrative account.
- **Operator workspace (`/app`)** — collapsible sidebar with the 10 operational modules, command topbar (global search, alerts, connection state, theme, session menu) and a master-detail layout with contextual detail rails, compact KPIs and audited mutations.
- **Live dashboard** — 10 KPIs, transparent/configurable health score, activity feed, queue and berth overview, 7-day series.
- **Digital twin** — 1600×900 backend-positioned SVG of berths, vessels, cranes, trucks, warehouses and yard, streamed over WebSocket with pause/speed controls.
- **Ships and berths** — vessel lifecycle, discharge control, departure guardrails, dock compatibility, explainable allocation with accept, override with a written reason, and audit history.
- **Resource optimizer** — hard constraints first (availability, certification, capacity, no double-booking), then weighted ranking; accept, reject, recalculate and manual override.
- **Fleet** — crane, truck and driver inventory with create/edit/withdraw, health, fuel, duty status and workload.
- **Containers** — validated Kanban lifecycle with QR codes. `delivered` is reachable only by completing a dispatch.
- **Warehouses and dispatch** — capacity-enforced receiving, threshold alerts, road and rail dispatch, completion that delivers containers.
- **Simulation centre** — four scenarios on a read-only snapshot. Nothing is written to operational tables until an explicit **Apply**.
- **Alerts and maintenance** — rule-based operational alerts, acknowledge/resolve, and advisory predictive-maintenance risk with scheduled tasks.
- **Analytics** — date window, throughput/turnaround/bottleneck views, CSV export, print-only report header.
- **Assistant** — floating read-only chat grounded on live database facts; optional OpenAI-compatible LLM, otherwise a deterministic rules engine. Never invents data and never executes changes.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS, Radix primitives, Lucide, Recharts, React Router, TanStack Query, Sonner |
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, WebSockets |
| Auth | Server-side sessions (HttpOnly cookie), PBKDF2 password hashing, CSRF double-submit, role-based read-only viewers |
| Data | PostgreSQL 16 primary; SQLite fallback for local development |
| Optional | OpenAI-compatible LLM for the assistant; OR-Tools is not required (transparent weighted ranking is built in) |

## Repository layout

```
portsync/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers
│   │   ├── core/           # settings, database, constants, time
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic contracts
│   │   ├── seed/           # deterministic demo dataset
│   │   ├── services/       # allocation, simulation, maintenance, twin, analytics, assistant
│   │   ├── tests/          # pytest API suite
│   │   ├── websocket/      # connection hub
│   │   └── main.py         # app factory, lifespan, middleware, WebSocket route
│   ├── alembic/            # initial schema migration
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── requirements-postgres.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/     # shell, primitives, charts, landing, auth scenes, feature views
│   │   ├── pages/          # landing, login, signup + 10 routed app pages
│   │   ├── lib/            # API client, auth provider, WebSocket provider, types, formatters
│   │   └── main.tsx
│   ├── nginx.conf
│   ├── Dockerfile
│   └── .env.example
├── docs/
│   ├── API.md
│   └── DEPLOYMENT.md
├── docker-compose.yml
├── .env.example
└── .gitignore
```

## Quick start

Prerequisites: Python 3.12+, Node 20+ (Node 24 tested), npm.

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows Git Bash
source .venv/Scripts/activate
# Windows PowerShell
# .venv\Scripts\Activate.ps1
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8010
```

The API starts on `http://127.0.0.1:8010`:

- Swagger UI: `http://127.0.0.1:8010/docs`
- Health: `http://127.0.0.1:8010/api/health`
- WebSocket: `ws://127.0.0.1:8010/ws/operations`

On first start the app creates the schema and seeds the deterministic demo dataset (`SIM_SEED=20261`) plus two demonstration accounts (`SEED_DEMO_USERS=true`):

| Account | Role | Password |
| --- | --- | --- |
| `priya.menon@portsync.demo` | supervisor | `PortSync2026!` |
| `arjun.rao@portsync.demo` | operator | `PortSync2026!` |

Public signup creates **read-only viewer** accounts that the backend enforces on every mutation. Change `DEMO_PASSWORD` or set `SEED_DEMO_USERS=false` in `backend/.env` before exposing the app beyond localhost.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` and `/ws` to `127.0.0.1:8010`, so no frontend environment variables are needed in development.

### 3. PostgreSQL (optional)

```bash
cd backend
pip install -r requirements-postgres.txt
alembic upgrade head
```

Then set `DATABASE_URL` in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/portsync
```

Copy `backend/.env.example` to `backend/.env` and edit. Placeholders only belong in the example file.

## Configuration

Backend variables are read from `backend/.env` or the process environment. See [`backend/.env.example`](backend/.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | Environment label |
| `DATABASE_URL` | SQLite `backend/portsync.db` | Database connection |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed browser origins |
| `SESSION_COOKIE_NAME` | `portsync_session` | HttpOnly session cookie name |
| `SESSION_HOURS` | `12` | Session lifetime without "remember this device" |
| `REMEMBER_DAYS` | `30` | Session lifetime with "remember this device" |
| `CSRF_HEADER` | `X-CSRF-Token` | Header name for CSRF double-submit |
| `SEED_DEMO_USERS` | `true` | Seed the two demonstration accounts |
| `DEMO_PASSWORD` | `PortSync2026!` | Password for seeded accounts |
| `SIM_ENABLED` | `true` | Run the simulator ticker |
| `SIM_TICK_SECONDS` | `4` | Wall-clock seconds per simulated tick |
| `SIM_SEED` | `20261` | Deterministic dataset seed |
| `LLM_API_KEY` | empty | Optional backend-only secret |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint — e.g. Groq: `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | `gpt-4o-mini` | Model name — e.g. Groq: `openai/gpt-oss-120b` |

Frontend build-time variables are documented in [`frontend/.env.example`](frontend/.env.example). Leave `VITE_API_URL` and `VITE_WS_URL` blank for same-origin or dev-proxy setups.

## Database, migrations and seed

```bash
cd backend

alembic current           # inspect revision
alembic upgrade head      # apply the initial schema
alembic downgrade base    # drop the schema (destructive)
```

Startup behavior:

1. `Base.metadata.create_all` ensures tables exist.
2. If no vessels exist, `seed_if_empty` loads docks, vessels, cranes, trucks, drivers, containers, warehouses, dispatches, alerts, users and settings.
3. If `SIM_ENABLED=true`, the simulator ticker starts in the background.

The in-app **Reset demo dataset** action (and `POST /api/system/reset-demo`) restores the seeded baseline. It requires `{"confirm":"RESET"}` and is intended for demos, not public use.

## Tests and quality checks

```bash
# Backend: 18 API tests (auth, sessions, CSRF, viewer read-only, public tracking,
# dashboard, twin, allocation, containers, dispatch, simulations, alerts, analytics)
cd backend
pytest -q

# Frontend: TypeScript strict check, then production build
cd frontend
npm run typecheck
npm run build
```

The backend suite covers health, login/signup/session policy, CSRF rejection, viewer read-only enforcement, public tracking, dashboard, twin, ships/docks, allocation, containers, warehouses, dispatch, simulations, alerts/maintenance, assistant and analytics export.

## Demo walkthrough

0. **Public site** — watch the cargo vessel cross the hero water, try the tracking widget with `CONT-0001` or `SH-104` (labels itself as demonstration data), then open **Login**.
1. **Sign in** with `priya.menon@portsync.demo` / `PortSync2026!` (or create a read-only account via **Signup** to see server-enforced viewer permissions).
2. **Reset** from the top bar to restore the deterministic baseline.
3. **Overview** — inspect the 10 KPIs; open **Configure health weights** and change the weighting. The score recomputes from components, not a hidden model.
4. **Digital twin** — pause the clock, zoom/pan, select vessels and equipment. Markers are backend-computed.
5. **Ships & Docks** — select `SH-104`, request a recommendation, accept it. Try a manual override and confirm a reason is required.
6. **Optimizer** — review hard-constraint exclusions, weighted scores and alternatives; accept or recalculate.
7. **Fleet** — create a crane (`CR-NN`), edit driver duty status, withdraw equipment not tied to active work.
8. **Containers** — advance a container through the Kanban lifecycle. Confirm `Delivered` is not offered directly.
9. **Warehouse & Dispatch** — receive containers within capacity, create a road or rail dispatch, move it to `in_transit`, then `completed`. Only dispatch completion delivers containers.
10. **Simulation Centre** — run `crane_failure` or `sudden_ship`; compare before/after KPIs. The real dataset is untouched until **Apply**.
11. **Alerts & Maintenance** — acknowledge a critical alert, create a maintenance task from an equipment alert, advance the task.
12. **Analytics** — change the date window, export a CSV, print the report.
13. **Assistant** — ask about the health score, a vessel or a bottleneck. If no LLM key is configured, the response states it is using the grounded rules engine.

## API and real-time

- Full endpoint map — including `/api/auth/*`, `/api/public/*`, error semantics and the WebSocket protocol: [`docs/API.md`](docs/API.md).
- OpenAPI: `/openapi.json`; Swagger: `/docs`.
- WebSocket `/ws/operations` requires a valid session cookie (unauthenticated sockets are closed with code 1008) and sends `hello`, `twin`, `event`, `invalidate` and `pong`. Event and invalidate frames drive TanStack Query invalidation on the client.

## Deployment

Local all-in-one stack:

```bash
cp .env.example .env
# set a strong POSTGRES_PASSWORD
docker compose up --build
# open http://localhost:8080
```

Managed deployment (Vercel + Render + Supabase/Neon), CORS, WebSocket proxying, environment variables and troubleshooting: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

One-click Render Blueprint (Postgres + FastAPI + static frontend): click **Deploy to Render** at the top of this README, or use Dashboard → **New +** → **Blueprint** → this repo. It provisions `portsync-db`, `portsync-api` and `portsync-web` from [`render.yaml`](render.yaml); use the **Blueprint** flow (not "Web Service"), since plain web services do not read `render.yaml`. For Vercel, either import the repo with **Root Directory** `frontend` and the `VITE_API_URL` / `VITE_WS_URL` variables (API on Render), or deploy both tiers in one Vercel project via Vercel Services (root [`vercel.json`](vercel.json), repo root as Root Directory, no `VITE_*` variables needed) — see Option 2 and Option 4 in that doc.

## Security and operating constraints

- **No secrets in the repo.** Only placeholders appear in `.env.example`. Real keys and passwords belong in backend/deployment environment variables.
- **Sessions are real, not stubbed.** Login/signup issue server-side sessions delivered as HttpOnly cookies (`Secure` in production/staging or over HTTPS); tokens are stored only as SHA-256 digests and are revoked on logout. There is no hardcoded success path — wrong credentials return `401` and the UI surfaces it.
- **Passwords are hashed** with PBKDF2-SHA256 (per-user salt) before storage and never logged or returned.
- **CSRF is enforced** for every non-safe API call via double-submit (`X-CSRF-Token` issued at login, mirrored by the client). Requests without it get `403`.
- **Viewer accounts are read-only.** Public signup always creates `viewer` accounts; the API rejects every mutation from them (`403`) regardless of what the UI shows, except logout.
- **No unrestricted admin via public signup.** Signups can never create supervisor/operator accounts; those exist only via the seeded demonstration users.
- **The LLM key never reaches the frontend.** The API reports only whether an LLM is configured and which mode is active.
- **The assistant is read-only.** It cannot create, update, delete, apply simulations or execute operational changes; it points operators to the approval flow.
- **Operational changes require explicit operator action.** Allocation accept/override, lifecycle transitions, dispatch completion and simulation apply are separate, audited endpoints attributed to the signed-in session.
- **Simulations do not mutate live data on run.** Results are computed on a snapshot; only `POST /api/simulations/apply` commits them.
- **Delivered only via dispatch.** Container status cannot jump to `delivered`; the only path is completing a dispatch.
- **Synthetic data is labeled.** Dashboard, twin, simulation, public tracking and assistant payloads carry `simulated` / `source_note` / `disclaimer` fields.
- **Before exposing publicly:** set `ENVIRONMENT=production`, serve over HTTPS, rotate `DEMO_PASSWORD` or set `SEED_DEMO_USERS=false`, restrict `CORS_ORIGINS` to the deployed origin, and put the API behind a proxy that terminates TLS.
- **Predictive maintenance is advisory.** It is a transparent rule-based risk score, not a trained failure model.

## License

Prototype for demonstration and hackathon use. Add a license before redistribution.
