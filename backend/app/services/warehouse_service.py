from typing import Any

from sqlalchemy.orm import Session

from app.models import Container, Warehouse
from app.services.allocation_engine import AllocationError
from app.services.common import record_audit, record_event
from app.services.container_service import assign_to_warehouse


def assign_containers(
    db: Session, warehouse: Warehouse, codes: list[str], actor: str, note: str | None = None
) -> dict[str, Any]:
    if not codes:
        raise AllocationError("Select at least one container")
    if warehouse.status != "operational":
        raise AllocationError(f"{warehouse.code} is {warehouse.status}; storage is blocked")
    containers = db.query(Container).filter(Container.code.in_(codes)).all()
    if len(containers) != len(codes):
        raise AllocationError("One or more containers were not found")
    newcomers = [c for c in containers if c.warehouse_id != warehouse.id]
    if warehouse.occupancy + len(newcomers) > warehouse.capacity_teu:
        raise AllocationError(
            f"{warehouse.code} would exceed capacity "
            f"({warehouse.occupancy + len(newcomers)}/{warehouse.capacity_teu} TEU)"
        )
    for container in containers:
        if container.status not in ("in_transit", "at_yard"):
            raise AllocationError(
                f"{container.code} is {container.status.replace('_', ' ')}; it cannot be stored yet"
            )
        if container.status == "at_yard" and container.warehouse_id == warehouse.id:
            continue
        assign_to_warehouse(db, container, warehouse, actor)
    record_audit(
        db,
        actor=actor,
        action="warehouse_storage_assigned",
        entity_type="warehouse",
        entity_code=warehouse.code,
        detail=f"{len(containers)} container(s) · {note or 'operator assignment'}",
    )
    event = record_event(
        db,
        type="warehouse_intake",
        title=f"{len(containers)} container(s) received at {warehouse.code}",
        message=(
            f"{warehouse.code} occupancy is now {warehouse.occupancy}/{warehouse.capacity_teu} TEU "
            f"({warehouse.utilization}%)."
        ),
        entity_type="warehouse",
        entity_code=warehouse.code,
        payload={"containers": [c.code for c in containers][:20], "occupancy": warehouse.occupancy},
    )
    db.commit()
    return {"assigned": len(containers), "warehouse": warehouse, "event": event}
