import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError

from app.api import (
    alerts,
    allocations,
    analytics,
    assistant,
    auth,
    containers,
    dispatch,
    docks,
    public,
    resources,
    ships,
    simulations,
    system,
    twin,
    warehouses,
)
from app.core.auth_guard import AuthGuardMiddleware
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import token_digest
from app.core.timeutil import utcnow
from app.models import AuthSession
from app.seed.seed_data import ensure_demo_credentials, seed_if_empty
from app.services import ticker
from app.services.allocation_engine import AllocationError
from app.services.digital_twin import state as twin_state
from app.websocket.manager import manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s · %(message)s",
)
logger = logging.getLogger("portsync")

_ticker_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _ticker_task
    app.state.db_boot_error = None
    db_ready = False
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seeded = seed_if_empty(db)
            if seeded:
                logger.info("Seeded deterministic demo dataset (seed=%s)", settings.sim_seed)
            ensure_demo_credentials(db)
        finally:
            db.close()
        db_ready = True
    except Exception as exc:
        app.state.db_boot_error = f"{type(exc).__name__}: {exc}"
        logger.exception(
            "Database bootstrap failed — starting in degraded mode. "
            "Set DATABASE_URL to a reachable PostgreSQL URL (on Vercel use the pooled Neon connection string)."
        )

    manager.loop = asyncio.get_running_loop()
    if settings.sim_enabled and db_ready:
        _ticker_task = asyncio.create_task(ticker.ticker_loop())
    _url = make_url(settings.database_url)
    logger.info("PortSync API ready · env=%s · db=%s://%s/%s", settings.environment, _url.drivername, _url.host or "local", _url.database or "")
    try:
        yield
    finally:
        if _ticker_task:
            _ticker_task.cancel()
            try:
                await _ticker_task
            except asyncio.CancelledError:
                pass
        logger.info("PortSync API shutting down")


app = FastAPI(
    title="PortSync API",
    description=(
        "One Port. Every Resource. Intelligent Operations.\n\n"
        "Smart port operations platform: vessels, berths, cranes, trucks, drivers, containers, "
        "warehouses, dispatch, simulation, alerts and analytics. All data is synthetic simulator output."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(AuthGuardMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    elapsed = (time.perf_counter() - started) * 1000
    if request.url.path not in ("/api/health",):
        logger.info("%s %s → %s (%.0f ms)", request.method, request.url.path, response.status_code, elapsed)
    response.headers["X-Process-Time-Ms"] = f"{elapsed:.0f}"
    return response


@app.exception_handler(AllocationError)
async def allocation_error_handler(request: Request, exc: AllocationError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(OperationalError)
async def database_unavailable_handler(request: Request, exc: OperationalError):
    logger.error("Database error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Database unavailable. The API could not reach its database — "
                "check the DATABASE_URL setting on the deployment."
            )
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


for router in (
    auth.router,
    public.router,
    system.router,
    analytics.router,
    ships.router,
    docks.router,
    resources.router,
    allocations.router,
    containers.router,
    warehouses.router,
    dispatch.router,
    simulations.router,
    alerts.router,
    alerts.maintenance_router,
    assistant.router,
    twin.router,
):
    app.include_router(router, prefix="/api")


@app.get("/", tags=["system"])
def root():
    return {
        "name": "PortSync API",
        "tagline": "One Port. Every Resource. Intelligent Operations.",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
        "websocket": "/ws/operations",
        "data_note": "Synthetic simulator data. No live GPS or equipment telemetry is used.",
    }


@app.websocket("/ws/operations")
async def operations_socket(websocket: WebSocket):
    manager.loop = asyncio.get_running_loop()
    db = SessionLocal()
    try:
        token = websocket.cookies.get(settings.session_cookie_name)
        session = None
        if token:
            session = (
                db.query(AuthSession)
                .filter(AuthSession.token_hash == token_digest(token), AuthSession.expires_at > utcnow())
                .first()
            )
        if session is None:
            await websocket.close(code=1008)
            return
        await manager.connect(websocket)
        await websocket.send_json(
            {
                "type": "hello",
                "data": {
                    "server": "PortSync operations stream",
                    "simulated": True,
                    "topics": ["event", "invalidate", "twin"],
                },
            }
        )
        await websocket.send_json({"type": "twin", "data": twin_state(db)})
        await websocket.send_json({"type": "invalidate", "data": {"topics": ["all"]}})
        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)
        db.close()
