# Deployment

PortSync is a two-tier application: a static React/Vite frontend and a FastAPI backend with PostgreSQL (SQLite fallback) and a WebSocket stream.

```
Browser
  ├─ HTTPS  /api/*  ─────────────► FastAPI (uvicorn :8010) ──► PostgreSQL
  └─ WSS    /ws/operations ──────► FastAPI WebSocket hub
```

Deploy behind the same origin where possible. Same-origin avoids CORS and mixed-content problems, and a single reverse proxy can forward both `/api` and `/ws`.

## Option 1 — Docker Compose (self-hosted)

Prerequisites: Docker Engine 24+ with Compose v2.

```bash
cp .env.example .env
# Edit .env: set a strong POSTGRES_PASSWORD, optionally LLM_API_KEY and CORS_ORIGINS
docker compose up --build
```

Then open `http://localhost:8080`.

What the stack does:

- `db` — PostgreSQL 16 with a named `pgdata` volume and `pg_isready` health check.
- `backend` — Python 3.12 image; waits for Postgres, runs `alembic upgrade head`, then starts uvicorn on `:8010`. The API seeds the deterministic demo dataset when the vessel table is empty.
- `frontend` — multi-stage build (Node 22 → nginx 1.27). nginx serves the SPA with history fallback and proxies `/api` and `/ws` to `backend:8010`.

Useful commands:

```bash
docker compose logs -f backend
docker compose exec backend alembic current
docker compose exec backend alembic upgrade head
docker compose down            # keep data
docker compose down -v         # DESTROY the Postgres volume
```

The Postgres password must be URL-safe because it is interpolated into `DATABASE_URL`. If you need characters such as `@`, `:`, `/` or `%`, set a fully encoded `DATABASE_URL` yourself and adjust the compose environment instead of relying on interpolation.

To run on SQLite inside containers instead, remove the `DATABASE_URL` environment entry and do not start `db`; the default is `sqlite:///backend/portsync.db`, which is **ephemeral unless you mount a volume over `/app`**.

## Option 2 — Managed frontend + backend + database

This is the recommended free-tier path for a demo: Vercel (frontend), Render (backend), Supabase or Neon (PostgreSQL).

### 1. Database (Supabase / Neon)

1. Create a PostgreSQL project.
2. Copy the **pooled** connection string from the dashboard:
   - Supabase → **Connect → Pooler → Transaction pooler** (port `6543`, user `postgres.<project-ref>`). The direct `db.<project-ref>.supabase.co` host is IPv6-only; the session pooler works too but transaction pooling is the right fit for serverless functions.
   - Neon → the string whose host contains `-pooler`.
3. Optional but recommended for Supabase: run [`supabase-schema.sql`](supabase-schema.sql) in the **SQL Editor**. It creates the 19 tables, indexes, the `alembic_version` head row and enables RLS with no policies on every table. Skipping it is fine — the API creates and seeds the schema on first boot; the file just makes the schema explicit and blocks PostgREST access through anon/authenticated keys.
4. Use the string as handed out:

   ```
   postgresql://postgres.<project-ref>:PASSWORD@<region>.pooler.supabase.com:6543/postgres?sslmode=require
   ```

   The backend rewrites it to the psycopg driver form automatically. URL-encode special characters in the password, or use the provider's encoded connection string.

### 2. Backend (Render Web Service)

- Root directory: `backend`
- Build command:

  ```bash
  pip install -r requirements.txt -r requirements-postgres.txt
  ```

- Start command:

  ```bash
  alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers
  ```

- Health check path: `/api/health`
- Environment variables:

  | Variable | Required | Notes |
  | --- | --- | --- |
  | `DATABASE_URL` | yes | `postgresql+psycopg://...` |
  | `CORS_ORIGINS` | yes | Exact frontend origin, e.g. `https://portsync.vercel.app`. Comma-separated, no trailing slash. |
  | `ENVIRONMENT` | recommended | `production` |
  | `SIM_ENABLED` | optional | Defaults `true` |
  | `SIM_TICK_SECONDS` | optional | Defaults `4` |
  | `SIM_SEED` | optional | Defaults `20261`; changes the synthetic dataset |
  | `LLM_API_KEY` | optional | Backend-only secret. Leave blank for the rules assistant. |
  | `LLM_BASE_URL` | optional | Any OpenAI-compatible endpoint |
  | `LLM_MODEL` | optional | Defaults `gpt-4o-mini` |

Never put `LLM_API_KEY` in a frontend variable or commit a real `.env`.

The initial migration creates the full schema. The app also calls `Base.metadata.create_all` at startup, so a fresh database works even if the migration is skipped — but run `alembic upgrade head` so migration history stays authoritative.

### 3. Frontend (Vercel)

- Framework preset: Vite
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables (Production and Preview):

  | Variable | Value |
  | --- | --- |
  | `VITE_API_URL` | `https://your-backend.onrender.com` |
  | `VITE_WS_URL` | `wss://your-backend.onrender.com/ws/operations` |

Set both at build time; Vite inlines them. `VITE_API_URL` must be the origin only (no `/api` suffix) because the client appends `/api/...`.

After the frontend URL is known, update the backend `CORS_ORIGINS` and redeploy/restart the API.

The client uses `BrowserRouter`, so the host must fall back to `index.html` for unknown paths (deep links such as `/analytics`). The bundled nginx config already does this; in Option 4 the root `vercel.json` handles it inside the frontend service. For a standalone Vercel project (this option), add a rewrite to `/index.html`. On another static host, add an SPA rewrite/fallback for non-file routes.

### Alternative: same-origin rewrite

Instead of CORS, you can leave `VITE_API_URL` and `VITE_WS_URL` blank and add a reverse proxy / rewrite from the frontend host to the backend (`/api/*` and `/ws/*`). The bundled nginx config is a working example. If you use a CDN rewrite, confirm WebSocket upgrade headers are forwarded, otherwise live updates fall back to manual refresh.

## Option 3 — Render Blueprint (everything on Render)

`render.yaml` at the repo root is a [Blueprint](https://render.com/docs/blueprint-spec) that provisions the whole stack in one step:

| Resource | Type | Notes |
| --- | --- | --- |
| `portsync-db` | Render Postgres | Free plan (expires 30 days after creation), PG 16, `portsync` database/user |
| `portsync-api` | Web service (Python) | Installs both requirements files, runs `alembic upgrade head`, serves uvicorn on `$PORT`; health check `/api/health` |
| `portsync-web` | Static site | `npm ci && npm run build`, publishes `dist/`, SPA rewrite to `index.html` |

To deploy:

1. Push this repo (with `render.yaml`) to GitHub.
2. Render Dashboard → **New +** → **Blueprint** → select the repo → **Apply**.

Blueprint behavior worth knowing:

- `DATABASE_URL` is wired from the database's internal connection string; `app.core.config` qualifies `postgresql://` to `postgresql+psycopg://` automatically, so the provider's URL works as-is.
- Session cookies are sent with `SameSite=None; Secure` when `ENVIRONMENT=production`, because two `*.onrender.com` subdomains are cross-site (the domain is on the Public Suffix List) and a `Lax` cookie would never reach the API.
- Service URLs are derived from service names (`portsync-api` / `portsync-web`). If Render appends a random suffix because a name is taken, update `CORS_ORIGINS` on the API and `VITE_API_URL` / `VITE_WS_URL` on the static site, then redeploy both.
- `LLM_API_KEY` is intentionally not set — add it (and optionally `LLM_BASE_URL` / `LLM_MODEL`) in the dashboard to leave rules mode.
- Free web services spin down after ~15 minutes of inactivity; the first request after that pays a cold start.

## Option 4 — Vercel Services (frontend + API in one Vercel project)

`vercel.json` at the repo root deploys both tiers as a single Vercel project using [Vercel Services](https://vercel.com/docs/services):

| Service | Root | Runtime | Public path |
| --- | --- | --- | --- |
| `portsync-api` | `backend/` | FastAPI (`app.main:app`, Python 3.12) | `/api/*` and `/ws/*` |
| `portsync-web` | `frontend/` | Vite static build | everything else |

No service bindings are needed: the frontend is a static build that calls the API from the browser over the public `/api` path (a binding only injects internal URLs into server-side functions). The SPA fallback lives in the frontend service's own rewrite rule, so the service names and public paths can be changed in one place.

Setup:

1. Import the repo into Vercel with the **repository root** as the Root Directory (not `frontend/`).
2. Set environment variables (Project → Settings → Environment Variables):
   - `DATABASE_URL` — **required**: the provider's **pooled** PostgreSQL URL (Supabase port `6543`, Neon `-pooler` host), e.g. `postgresql://postgres.<ref>:PASSWORD@<region>.pooler.supabase.com:6543/postgres?sslmode=require`. SQLite does not persist on Vercel; a plain `postgresql://` URL is qualified automatically. See [`supabase-schema.sql`](supabase-schema.sql) for the optional one-shot schema.
   - `ENVIRONMENT=production`
   - Optional: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `SIM_ENABLED`, `SIM_TICK_SECONDS`, `SIM_SEED`, `SEED_DEMO_USERS`, `DEMO_PASSWORD`.
3. Deploy. Leave `VITE_API_URL` and `VITE_WS_URL` unset — routing is same-origin.

Serverless behavior worth knowing:

- Every cold start runs the FastAPI lifespan: `Base.metadata.create_all`, demo seeding and demo credentials. `alembic upgrade head` is not run automatically — run it from your machine against the hosted database for schema changes.
- WebSocket connections are pinned to one function instance and close at the function duration limit. The client reconnects with exponential backoff and falls back to 15-second polling while offline, so the twin recovers.
- The WebSocket hub and simulator ticker are in-process: with `SIM_ENABLED=true`, each warm instance advances its own ticker and broadcasts only to clients pinned to that instance. HTTP data stays consistent (Postgres). For one deterministic demo clock, set `SIM_ENABLED=false` on Vercel.
- WebSockets require Fluid compute, which is the default for projects created after April 23, 2025.

Local development: `npx vercel dev --local` runs both services together without authenticating with Vercel.

## Environment reference

| Variable | Default | Scope |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | Backend |
| `DATABASE_URL` | `sqlite:///backend/portsync.db` | Backend |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Backend |
| `SIM_ENABLED` | `true` | Backend |
| `SIM_TICK_SECONDS` | `4` | Backend |
| `SIM_SEED` | `20261` | Backend |
| `LLM_API_KEY` | empty | Backend secret |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Backend |
| `LLM_MODEL` | `gpt-4o-mini` | Backend |
| `VITE_API_URL` | empty (same origin) | Frontend build |
| `VITE_WS_URL` | derived from page origin | Frontend build |
| `POSTGRES_USER` / `POSTGRES_DB` / `POSTGRES_PASSWORD` | none | Compose only |

## Operations

### Seeding and demo reset

- On startup, if `ships` is empty, the API seeds a full deterministic dataset from `SIM_SEED`.
- Resetting migrations does not reseed automatically until the next startup.
- The in-app **Reset demo dataset** action posts `/api/system/reset-demo` with `{"confirm":"RESET"}` and restores the baseline. It deletes operational records, so do not expose it to untrusted users.

### Health and monitoring

- `GET /api/health` returns `status`, `database`, environment, tick count and WebSocket client count. Point uptime checks here.
- `GET /api/system/audit` is the audit trail for accepts, overrides, lifecycle changes, maintenance and simulation apply.
- The simulator ticker logs each failure with the `portsync.ticker` logger; uvicorn access logs are enabled by default.

### Scaling notes

- The WebSocket hub is in-process. Multiple API replicas will each broadcast only to their own clients. For horizontal scaling, add a shared pub/sub layer (Redis) or use sticky sessions.
- SQLite with WAL is single-writer oriented; use PostgreSQL for any concurrent deployment.
- The ticker runs once per process. Running multiple API replicas with `SIM_ENABLED=true` multiplies simulated progress. Keep one simulator owner: either run a single replica or set `SIM_ENABLED=false` on all but one instance.

## Security checklist before public exposure

This prototype ships **without authentication** and is intended for controlled demos.

- Add authentication/authorization at the reverse proxy or API gateway; do not rely on `X-Actor` for access control.
- Terminate TLS for both HTTPS and WSS.
- Keep `.env` out of version control; only `.env.example` placeholders belong in the repo.
- Keep `LLM_API_KEY` on the backend only; rotate it if exposed.
- Restrict `CORS_ORIGINS` to known frontend origins.
- Restrict or disable `/api/system/reset-demo` in public environments.
- Treat the assistant as read-only: it cannot mutate data, and all operational changes still require an explicit operator request through accept/apply endpoints.
- Keep the synthetic-data labeling visible. No live vessel, GPS or equipment telemetry is used.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Frontend loads but API calls fail | `VITE_API_URL` missing at build time, or the backend `CORS_ORIGINS` does not include the frontend origin |
| WebSocket never connects | Proxy is not forwarding `Upgrade` / `Connection` headers; check nginx `/ws/` block or CDN settings |
| `psycopg` import error | Reinstall from `requirements.txt` (it pins `psycopg[binary]`) and redeploy |
| `alembic upgrade head` cannot connect | Check `DATABASE_URL`, SSL mode and that the database exists |
| Login or any API call returns `500` / `503` | The API cannot reach its database. Open `/api/health`: `database_target` shows the host in use and `detail` the connection error. On Vercel set `DATABASE_URL` to Neon's **pooled** connection string (`-pooler` host, `?sslmode=require`; the direct host is IPv6-only), then redeploy so the variable takes effect |
| Data disappears after redeploy | Host is using SQLite on ephemeral storage; switch to PostgreSQL or mount a persistent volume |
| Health score changed unexpectedly | Health weights are operator-editable via `/api/system/health-weights`; reset demo to restore defaults |
| Assistant says rules mode | `LLM_API_KEY` is blank or the backend has not been restarted after setting it |
