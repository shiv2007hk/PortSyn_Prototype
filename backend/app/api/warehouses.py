from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.common import current_actor, notify
from app.core.database import get_db
from app.models import Container, Warehouse
from app.schemas import WarehouseAssignRequest, WarehouseUpdate
from app.services import warehouse_service
from app.services.common import record_audit, record_event
from app.services.serializers import event_out, warehouse_out

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


@router.get("")
def list_warehouses(db: Session = Depends(get_db)):
    warehouses = db.query(Warehouse).order_by(Warehouse.code).all()
    rows = []
    for wh in warehouses:
        data = warehouse_out(wh)
        counts = dict(
            db.query(Container.status, func.count(Container.id))
            .filter(Container.warehouse_id == wh.id)
            .group_by(Container.status)
            .all()
        )
        data["container_counts"] = counts
        data["tracked_containers"] = sum(counts.values())
        rows.append(data)
    total_capacity = sum(w.capacity_teu for w in warehouses) or 1
    total_occupancy = sum(w.occupancy for w in warehouses)
    return {
        "items": rows,
        "summary": {
            "capacity_teu": total_capacity,
            "occupancy_teu": total_occupancy,
            "available_teu": max(0, total_capacity - total_occupancy),
            "occupancy_pct": round(total_occupancy / total_capacity * 100, 1),
            "above_threshold": sum(1 for w in warehouses if w.utilization >= w.threshold),
            "operational": sum(1 for w in warehouses if w.status == "operational"),
        },
        "note": "Occupancy includes legacy stock recorded before live container tracking, plus tracked containers received through PortSync.",
    }


@router.patch("/{code}")
def update_warehouse(
    code: str,
    payload: WarehouseUpdate,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    warehouse = db.query(Warehouse).filter(Warehouse.code == code).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail=f"Warehouse {code} not found")
    changes = payload.model_dump(exclude_unset=True)
    if "capacity_teu" in changes and changes["capacity_teu"] < warehouse.occupancy:
        raise HTTPException(
            status_code=409,
            detail=f"Capacity cannot fall below current occupancy ({warehouse.occupancy} TEU)",
        )
    for key, value in changes.items():
        setattr(warehouse, key, value)
    record_audit(
        db, actor=actor, action="warehouse_updated", entity_type="warehouse", entity_code=code, detail=str(changes)
    )
    event = record_event(
        db,
        type="warehouse_updated",
        title=f"{code} settings updated",
        message=f"{code} is now {warehouse.status} · threshold {warehouse.threshold}% · capacity {warehouse.capacity_teu} TEU.",
        entity_type="warehouse",
        entity_code=code,
    )
    db.commit()
    notify(event, ["warehouses", "dashboard", "alerts"])
    data = warehouse_out(warehouse)
    data["container_counts"] = {}
    data["tracked_containers"] = 0
    return data


@router.post("/assign")
def assign_containers(
    payload: WarehouseAssignRequest,
    actor: str = Depends(current_actor),
    db: Session = Depends(get_db),
):
    warehouse = db.query(Warehouse).filter(Warehouse.code == payload.warehouse_code).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail=f"Warehouse {payload.warehouse_code} not found")
    try:
        result = warehouse_service.assign_containers(db, warehouse, payload.container_codes, actor, payload.note)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    event = result["event"]
    notify(event, ["warehouses", "containers", "dashboard", "twin", "analytics", "alerts"])
    return {
        "message": f"{result['assigned']} container(s) stored",
        "warehouse": warehouse_out(warehouse),
        "event": event_out(event),
    }
