from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.common import current_actor, notify
from app.core.database import get_db
from app.core.timeutil import utcnow
from app.models import Assignment, Container, Crane, Dock, Driver, MaintenanceTask, OperationalEvent, Vehicle
from app.schemas import CraneCreate, CraneUpdate, DriverCreate, DriverUpdate, VehicleCreate, VehicleUpdate
from app.services.common import create_alert_once, record_audit, record_event
from app.services.serializers import (
    assignment_out,
    container_out,
    crane_out,
    driver_out,
    event_out,
    maintenance_out,
    vehicle_out,
)

router = APIRouter(prefix="/resources", tags=["resources"])


def _vehicle_for_driver(db: Session, driver_id: int) -> str | None:
    vehicle = db.query(Vehicle).filter(Vehicle.driver_id == driver_id).first()
    return vehicle.code if vehicle else None


def _release_assignments(db: Session, kind: str, code: str) -> None:
    for row in (
        db.query(Assignment)
        .filter(Assignment.kind == kind, Assignment.resource_code == code, Assignment.status == "active")
        .all()
    ):
        row.status = "released"
        row.released_at = utcnow()


@router.get("")
def list_resources(db: Session = Depends(get_db)):
    cranes = db.query(Crane).order_by(Crane.code).all()
    vehicles = db.query(Vehicle).order_by(Vehicle.code).all()
    drivers = db.query(Driver).order_by(Driver.code).all()
    return {
        "cranes": [crane_out(c) for c in cranes],
        "vehicles": [vehicle_out(v) for v in vehicles],
        "drivers": [driver_out(d, _vehicle_for_driver(db, d.id)) for d in drivers],
        "summary": {
            "cranes_total": len(cranes),
            "cranes_available": sum(1 for c in cranes if c.status == "idle"),
            "cranes_active": sum(1 for c in cranes if c.status == "active"),
            "cranes_down": sum(1 for c in cranes if c.status in ("maintenance", "fault")),
            "vehicles_total": len(vehicles),
            "vehicles_available": sum(1 for v in vehicles if v.status == "available"),
            "vehicles_engaged": sum(1 for v in vehicles if v.status in ("assigned", "in_transit")),
            "vehicles_down": sum(1 for v in vehicles if v.status in ("maintenance", "fault")),
            "drivers_total": len(drivers),
            "drivers_on_duty": sum(1 for d in drivers if d.duty_status == "on_duty"),
            "avg_crane_health": round(sum(c.health for c in cranes) / len(cranes), 1) if cranes else 0,
            "avg_fuel": round(sum(v.fuel for v in vehicles) / len(vehicles), 1) if vehicles else 0,
        },
    }


@router.get("/cranes")
def list_cranes(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Crane)
    if status:
        query = query.filter(Crane.status == status)
    return [crane_out(c) for c in query.order_by(Crane.code).all()]


@router.post("/cranes", status_code=201)
def create_crane(payload: CraneCreate, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    if db.query(Crane).filter(Crane.code == payload.code).first():
        raise HTTPException(status_code=409, detail=f"Crane {payload.code} already exists")
    dock = None
    if payload.dock_code:
        dock = db.query(Dock).filter(Dock.code == payload.dock_code).first()
        if not dock:
            raise HTTPException(status_code=404, detail=f"Dock {payload.dock_code} not found")
    crane = Crane(
        code=payload.code,
        crane_type=payload.crane_type,
        capacity_t=payload.capacity_t,
        health=payload.health,
        status=payload.status,
        dock_id=dock.id if dock else None,
        x=dock.cranes[0].x if dock and dock.cranes else 300,
        y=dock.cranes[0].y if dock and dock.cranes else 250,
    )
    db.add(crane)
    record_audit(db, actor=actor, action="crane_created", entity_type="crane", entity_code=crane.code)
    event = record_event(
        db, type="resource_created", title=f"{crane.code} added to the fleet",
        message=f"{crane.crane_type} crane with {crane.capacity_t} t lift capacity registered.",
        entity_type="crane", entity_code=crane.code,
    )
    db.commit()
    notify(event, ["resources", "dashboard", "twin"])
    return crane_out(crane)


@router.put("/cranes/{code}")
def update_crane(code: str, payload: CraneUpdate, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    crane = db.query(Crane).filter(Crane.code == code).first()
    if not crane:
        raise HTTPException(status_code=404, detail=f"Crane {code} not found")
    changes = payload.model_dump(exclude_unset=True)
    if "dock_code" in changes:
        dock_code = changes.pop("dock_code")
        dock = db.query(Dock).filter(Dock.code == dock_code).first() if dock_code else None
        if dock_code and not dock:
            raise HTTPException(status_code=404, detail=f"Dock {dock_code} not found")
        crane.dock_id = dock.id if dock else None
    for key, value in changes.items():
        setattr(crane, key, value)
    if payload.status in ("maintenance", "fault"):
        _release_assignments(db, "crane", code)
        create_alert_once(
            db,
            severity="critical" if payload.status == "fault" else "warning",
            category="crane_failure" if payload.status == "fault" else "equipment_health",
            title=f"{code} set to {payload.status}",
            message=f"Operator withdrew {code} from allocation ({payload.status}).",
            entity_type="crane",
            entity_code=code,
            source="operator",
        )
    record_audit(db, actor=actor, action="crane_updated", entity_type="crane", entity_code=code, detail=str(changes))
    event = record_event(
        db, type="resource_updated", title=f"{code} updated",
        message=f"Crane {code} is now {crane.status} · {crane.health:.0f}% health.",
        entity_type="crane", entity_code=code,
        severity="warning" if crane.status in ("maintenance", "fault") else "info",
    )
    db.commit()
    notify(event, ["resources", "dashboard", "twin", "alerts"])
    return crane_out(crane)


@router.delete("/cranes/{code}")
def deactivate_crane(code: str, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    crane = db.query(Crane).filter(Crane.code == code).first()
    if not crane:
        raise HTTPException(status_code=404, detail=f"Crane {code} not found")
    if crane.status == "active":
        raise HTTPException(status_code=409, detail="Release the active assignment before deactivating this crane")
    crane.status = "maintenance"
    record_audit(db, actor=actor, action="crane_deactivated", entity_type="crane", entity_code=code)
    event = record_event(
        db, type="resource_deactivated", title=f"{code} deactivated",
        message="Crane withdrawn from the allocation pool.", entity_type="crane", entity_code=code,
        severity="warning",
    )
    db.commit()
    notify(event, ["resources", "dashboard", "alerts"])
    return {"message": f"{code} deactivated", "crane": crane_out(crane)}


@router.get("/vehicles")
def list_vehicles(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Vehicle)
    if status:
        query = query.filter(Vehicle.status == status)
    return [vehicle_out(v) for v in query.order_by(Vehicle.code).all()]


@router.post("/vehicles", status_code=201)
def create_vehicle(payload: VehicleCreate, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    if db.query(Vehicle).filter(Vehicle.code == payload.code).first():
        raise HTTPException(status_code=409, detail=f"Vehicle {payload.code} already exists")
    driver = None
    if payload.driver_code:
        driver = db.query(Driver).filter(Driver.code == payload.driver_code).first()
        if not driver:
            raise HTTPException(status_code=404, detail=f"Driver {payload.driver_code} not found")
        if driver.duty_status != "on_duty":
            raise HTTPException(status_code=409, detail=f"Driver {driver.code} is {driver.duty_status}")
    vehicle = Vehicle(
        code=payload.code, capacity_t=payload.capacity_t, fuel=payload.fuel, health=payload.health,
        status=payload.status, driver_id=driver.id if driver else None,
    )
    db.add(vehicle)
    record_audit(db, actor=actor, action="vehicle_created", entity_type="vehicle", entity_code=vehicle.code)
    event = record_event(
        db, type="resource_created", title=f"{vehicle.code} added to the fleet",
        message=f"Terminal tractor with {vehicle.capacity_t} t payload registered.",
        entity_type="vehicle", entity_code=vehicle.code,
    )
    db.commit()
    db.refresh(vehicle)
    notify(event, ["resources", "dashboard", "twin"])
    return vehicle_out(vehicle)


@router.put("/vehicles/{code}")
def update_vehicle(code: str, payload: VehicleUpdate, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.code == code).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail=f"Vehicle {code} not found")
    changes = payload.model_dump(exclude_unset=True)
    if "driver_code" in changes:
        driver_code = changes.pop("driver_code")
        if driver_code:
            driver = db.query(Driver).filter(Driver.code == driver_code).first()
            if not driver:
                raise HTTPException(status_code=404, detail=f"Driver {driver_code} not found")
            if driver.duty_status != "on_duty":
                raise HTTPException(status_code=409, detail=f"Driver {driver.code} is not on duty")
            other = db.query(Vehicle).filter(Vehicle.driver_id == driver.id, Vehicle.id != vehicle.id).first()
            if other:
                raise HTTPException(status_code=409, detail=f"Driver {driver.code} is already on {other.code}")
            vehicle.driver_id = driver.id
        else:
            vehicle.driver_id = None
    for key, value in changes.items():
        setattr(vehicle, key, value)
    if payload.status in ("maintenance", "fault"):
        _release_assignments(db, "vehicle", code)
        if payload.status == "fault":
            create_alert_once(
                db, severity="critical", category="truck_breakdown",
                title=f"{code} reported a fault",
                message="Vehicle withdrawn from allocation after operator report.",
                entity_type="vehicle", entity_code=code, source="operator",
            )
    record_audit(db, actor=actor, action="vehicle_updated", entity_type="vehicle", entity_code=code, detail=str(changes))
    event = record_event(
        db, type="resource_updated", title=f"{code} updated",
        message=f"Truck {code} is now {vehicle.status} · fuel {vehicle.fuel:.0f}% · health {vehicle.health:.0f}%.",
        entity_type="vehicle", entity_code=code,
        severity="warning" if vehicle.status in ("maintenance", "fault") else "info",
    )
    db.commit()
    db.refresh(vehicle)
    notify(event, ["resources", "dashboard", "twin", "alerts"])
    return vehicle_out(vehicle)


@router.delete("/vehicles/{code}")
def deactivate_vehicle(code: str, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.code == code).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail=f"Vehicle {code} not found")
    if vehicle.status in ("assigned", "in_transit"):
        raise HTTPException(status_code=409, detail="Complete or release the vehicle's active task first")
    vehicle.status = "maintenance"
    record_audit(db, actor=actor, action="vehicle_deactivated", entity_type="vehicle", entity_code=code)
    event = record_event(
        db, type="resource_deactivated", title=f"{code} deactivated",
        message="Truck withdrawn from the allocation pool.", entity_type="vehicle", entity_code=code,
        severity="warning",
    )
    db.commit()
    notify(event, ["resources", "dashboard", "alerts"])
    return {"message": f"{code} deactivated", "vehicle": vehicle_out(vehicle)}


@router.get("/drivers")
def list_drivers(duty_status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Driver)
    if duty_status:
        query = query.filter(Driver.duty_status == duty_status)
    return [driver_out(d, _vehicle_for_driver(db, d.id)) for d in query.order_by(Driver.code).all()]


@router.post("/drivers", status_code=201)
def create_driver(payload: DriverCreate, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    if db.query(Driver).filter(Driver.code == payload.code).first():
        raise HTTPException(status_code=409, detail=f"Driver {payload.code} already exists")
    driver = Driver(**payload.model_dump())
    db.add(driver)
    record_audit(db, actor=actor, action="driver_created", entity_type="driver", entity_code=driver.code)
    event = record_event(
        db, type="resource_created", title=f"{driver.code} added to the duty roster",
        message=f"{driver.name} registered · {driver.shift}.", entity_type="driver", entity_code=driver.code,
    )
    db.commit()
    notify(event, ["resources", "dashboard"])
    return driver_out(driver)


@router.put("/drivers/{code}")
def update_driver(code: str, payload: DriverUpdate, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    driver = db.query(Driver).filter(Driver.code == code).first()
    if not driver:
        raise HTTPException(status_code=404, detail=f"Driver {code} not found")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("duty_status") and changes["duty_status"] != "on_duty":
        vehicle = db.query(Vehicle).filter(Vehicle.driver_id == driver.id).first()
        if vehicle:
            raise HTTPException(
                status_code=409,
                detail=f"Unassign {vehicle.code} from {driver.code} before changing duty status",
            )
    for key, value in changes.items():
        setattr(driver, key, value)
    record_audit(db, actor=actor, action="driver_updated", entity_type="driver", entity_code=code, detail=str(changes))
    event = record_event(
        db, type="resource_updated", title=f"{code} duty updated",
        message=f"{driver.name} is now {driver.duty_status.replace('_', ' ')}.",
        entity_type="driver", entity_code=code,
    )
    db.commit()
    notify(event, ["resources", "dashboard"])
    return driver_out(driver, _vehicle_for_driver(db, driver.id))


@router.delete("/drivers/{code}")
def deactivate_driver(code: str, actor: str = Depends(current_actor), db: Session = Depends(get_db)):
    driver = db.query(Driver).filter(Driver.code == code).first()
    if not driver:
        raise HTTPException(status_code=404, detail=f"Driver {code} not found")
    vehicle = db.query(Vehicle).filter(Vehicle.driver_id == driver.id).first()
    if vehicle:
        raise HTTPException(status_code=409, detail=f"Driver is assigned to {vehicle.code}; unassign first")
    driver.duty_status = "off_duty"
    record_audit(db, actor=actor, action="driver_deactivated", entity_type="driver", entity_code=code)
    event = record_event(
        db, type="resource_deactivated", title=f"{code} off duty",
        message=f"{driver.name} removed from the active roster.", entity_type="driver", entity_code=code,
    )
    db.commit()
    notify(event, ["resources", "dashboard"])
    return {"message": f"{code} deactivated", "driver": driver_out(driver)}


@router.get("/{kind}/{code}/history")
def resource_history(kind: str, code: str, db: Session = Depends(get_db)):
    kind_map = {"crane": "crane", "vehicle": "vehicle", "driver": "driver"}
    if kind not in kind_map:
        raise HTTPException(status_code=400, detail="kind must be crane, vehicle or driver")
    assignments = (
        db.query(Assignment)
        .filter(Assignment.resource_code == code)
        .order_by(Assignment.created_at.desc())
        .limit(30)
        .all()
    )
    events = (
        db.query(OperationalEvent)
        .filter(OperationalEvent.entity_code == code)
        .order_by(OperationalEvent.ts.desc())
        .limit(30)
        .all()
    )
    tasks = (
        db.query(MaintenanceTask)
        .filter(MaintenanceTask.equipment_code == code)
        .order_by(MaintenanceTask.created_at.desc())
        .all()
    )
    containers = []
    if kind == "crane":
        crane = db.query(Crane).filter(Crane.code == code).first()
        if not crane:
            raise HTTPException(status_code=404, detail=f"Crane {code} not found")
        containers = db.query(Container).filter(Container.crane_id == crane.id).limit(20).all()
    elif kind == "vehicle":
        vehicle = db.query(Vehicle).filter(Vehicle.code == code).first()
        if not vehicle:
            raise HTTPException(status_code=404, detail=f"Vehicle {code} not found")
        containers = db.query(Container).filter(Container.vehicle_id == vehicle.id).limit(20).all()
    else:
        if not db.query(Driver).filter(Driver.code == code).first():
            raise HTTPException(status_code=404, detail=f"Driver {code} not found")
    return {
        "assignments": [assignment_out(a) for a in assignments],
        "events": [event_out(e) for e in events],
        "maintenance": [maintenance_out(t) for t in tasks],
        "containers": [container_out(c) for c in containers],
    }
