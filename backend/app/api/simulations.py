from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.common import current_actor, notify
from app.core.database import get_db
from app.models import SimulationScenario
from app.schemas import SimulationApplyRequest, SimulationRunRequest
from app.services import simulation_engine
from app.services.allocation_engine import AllocationError
from app.services.serializers import event_out

router = APIRouter(prefix="/simulations", tags=["simulations"])


@router.get("")
def list_scenarios(db: Session = Depends(get_db)):
    rows = (
        db.query(SimulationScenario)
        .filter(SimulationScenario.status.in_(["complete", "applied"]))
        .order_by(SimulationScenario.created_at.desc())
        .limit(20)
        .all()
    )
    return {"items": [simulation_engine.scenario_out(row) for row in rows]}


@router.get("/current")
def current_scenario(db: Session = Depends(get_db)):
    row = simulation_engine.latest_scenario(db)
    if not row:
        return {"scenario": None}
    return {"scenario": simulation_engine.scenario_out(row)}


@router.post("/run")
def run_simulation(
    payload: SimulationRunRequest,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    try:
        scenario = simulation_engine.run_simulation(db, payload.scenario_type, payload.params, actor)
    except AllocationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    notify(None, ["simulations"])
    return simulation_engine.scenario_out(scenario)


@router.post("/reset")
def reset_simulations(actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    count = simulation_engine.reset(db, actor)
    notify(None, ["simulations"])
    return {"message": f"{count} scenario(s) reset", "reset": count}


@router.post("/apply")
def apply_simulation(
    payload: SimulationApplyRequest,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    try:
        result = simulation_engine.apply_scenario(db, payload.scenario_id, actor)
    except AllocationError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    notify(result["event"], ["ships", "resources", "docks", "warehouses", "alerts", "dashboard", "simulations", "twin", "analytics", "containers"])
    result["event"] = event_out(result["event"])
    return result
