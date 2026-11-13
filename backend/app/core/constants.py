"""Domain constants shared by services, APIs and the seed generator."""

SHIP_STATUSES = ["approaching", "arrived", "waiting", "docked", "unloading", "departed"]
DOCK_STATUSES = ["available", "occupied", "maintenance"]
CRANE_STATUSES = ["idle", "active", "maintenance", "fault"]
CRANE_TYPES = ["STS", "RTG", "MHC"]
VEHICLE_STATUSES = ["available", "assigned", "in_transit", "idle", "maintenance", "fault"]
DUTY_STATUSES = ["on_duty", "off_duty", "on_break"]
CONTAINER_STATUSES = [
    "waiting",
    "allocated",
    "loading",
    "in_transit",
    "at_yard",
    "ready_for_dispatch",
    "delivered",
]
WAREHOUSE_STATUSES = ["operational", "restricted", "maintenance"]
DISPATCH_STATUSES = ["pending", "scheduled", "in_transit", "completed", "cancelled"]
DISPATCH_MODES = ["road", "rail"]
ALERT_SEVERITIES = ["critical", "warning", "info"]
ALERT_STATUSES = ["active", "acknowledged", "resolved"]
PRIORITIES = ["low", "normal", "high", "critical"]
MAINTENANCE_STATUSES = ["scheduled", "in_progress", "completed"]
ROLES = [
    "super_admin",
    "port_administrator",
    "port_operator",
    "fleet_manager",
    "warehouse_manager",
    "maintenance_manager",
    "supervisor",
    "operator",
    "viewer",
]

DEMO_USERS = [
    {"code": "USR-SA", "name": "Vikram Malhotra", "role": "super_admin", "email": "admin@portsync.demo"},
    {"code": "USR-PA", "name": "Sunita Rao", "role": "port_administrator", "email": "portadmin@portsync.demo"},
    {"code": "USR-PO", "name": "Karan Shah", "role": "port_operator", "email": "operator@portsync.demo"},
    {"code": "USR-FM", "name": "Rajesh Kumar", "role": "fleet_manager", "email": "fleet@portsync.demo"},
    {"code": "USR-WM", "name": "Meera Patel", "role": "warehouse_manager", "email": "warehouse@portsync.demo"},
    {"code": "USR-MM", "name": "David Chen", "role": "maintenance_manager", "email": "maintenance@portsync.demo"},
    # Legacy demo users preserved
    {"code": "USR-01", "name": "Priya Menon", "role": "supervisor", "email": "priya.menon@portsync.demo"},
    {"code": "USR-02", "name": "Arjun Rao", "role": "operator", "email": "arjun.rao@portsync.demo"},
]

CONTAINER_TRANSITIONS = {
    "waiting": ["allocated"],
    "allocated": ["loading", "waiting"],
    "loading": ["in_transit"],
    "in_transit": ["at_yard"],
    "at_yard": ["ready_for_dispatch"],
    "ready_for_dispatch": ["delivered"],
    "delivered": [],
}

PRIORITY_WEIGHT = {"low": 0.6, "normal": 1.0, "high": 1.35, "critical": 1.7}
SEVERITY_RANK = {"info": 1, "warning": 2, "critical": 3}

# Default, operator-editable scoring configuration (persisted in app_settings).
DEFAULT_HEALTH_WEIGHTS = {
    "dock_congestion": 0.25,
    "resource_availability": 0.20,
    "equipment_health": 0.20,
    "container_backlog": 0.20,
    "dispatch_performance": 0.15,
}
DEFAULT_RESOURCE_WEIGHTS = {
    "availability": 0.30,
    "equipment_health": 0.20,
    "fuel": 0.20,
    "capacity_suitability": 0.15,
    "distance_suitability": 0.15,
}
DEFAULT_DOCK_WEIGHTS = {
    "availability": 0.30,
    "suitability": 0.25,
    "priority_fit": 0.20,
    "congestion": 0.15,
    "schedule_fit": 0.10,
}

# ---------------------------------------------------------------------------
# Digital twin geometry (SVG viewBox 1600x900, top-down, sea at the north)
# ---------------------------------------------------------------------------

TWIN_SIZE = {"width": 1600, "height": 900}
QUAY_Y = 205

DOCKS = [
    {"code": "D1", "name": "Berth Alpha", "x": 150, "y": 150, "w": 250, "h": 105},
    {"code": "D2", "name": "Berth Bravo", "x": 450, "y": 150, "w": 250, "h": 105},
    {"code": "D3", "name": "Berth Charlie", "x": 750, "y": 150, "w": 250, "h": 105},
    {"code": "D4", "name": "Berth Delta", "x": 1050, "y": 150, "w": 250, "h": 105},
]

CRANE_SLOTS = [
    {"code": "CR-01", "dock": "D1", "x": 215, "y": 243},
    {"code": "CR-02", "dock": "D2", "x": 515, "y": 243},
    {"code": "CR-03", "dock": "D3", "x": 815, "y": 243},
    {"code": "CR-04", "dock": "D4", "x": 1115, "y": 243},
    {"code": "CR-05", "dock": "D2", "x": 615, "y": 243},
    {"code": "CR-06", "dock": "D3", "x": 915, "y": 243},
]

YARD = {"x": 190, "y": 360, "w": 620, "h": 250}
WAREHOUSE_SLOTS = [
    {"code": "WH-A", "x": 890, "y": 340, "w": 220, "h": 130},
    {"code": "WH-B", "x": 890, "y": 500, "w": 220, "h": 130},
]
GATE = {"x": 1380, "y": 700, "w": 120, "h": 80}
RAIL = {"x1": 1160, "y1": 790, "x2": 1560, "y2": 790}
APPROACH = {"x": 60, "y": 40, "w": 1480, "h": 80}

ROAD_Y = 690
ROAD_NODES = {
    "gate": (1430, 740),
    "rail": (1240, 780),
    "yard": (500, 610),
    "wh_a": (1000, 405),
    "wh_b": (1000, 565),
    "d1": (275, 300),
    "d2": (575, 300),
    "d3": (875, 300),
    "d4": (1175, 300),
}

TRUCK_PATHS = {
    "d1": [(275, 300), (275, 690), (1430, 690)],
    "d2": [(575, 300), (575, 690), (1430, 690)],
    "d3": [(875, 300), (875, 690), (1430, 690)],
    "d4": [(1175, 300), (1175, 690), (1430, 690)],
    "yard": [(500, 610), (500, 690), (1430, 690)],
    "wh_a": [(1000, 405), (1000, 690), (1430, 690)],
    "wh_b": [(1000, 565), (1000, 690), (1430, 690)],
}

TRUCK_STAGING = [
    (1120, 740), (1155, 740), (1190, 740), (1225, 740),
    (1120, 775), (1155, 775), (1190, 775), (1225, 775),
    (1290, 740), (1325, 740), (1290, 775), (1325, 775),
]

# Demo / disruption defaults
DEMO_SHIP_CODE = "SH-101"
WAREHOUSE_ALERT_THRESHOLD = 85.0
