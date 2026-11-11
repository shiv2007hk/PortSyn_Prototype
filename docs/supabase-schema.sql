-- PortSync — Supabase PostgreSQL schema (19 tables)
--
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste this file → Run.
--
-- The API also creates missing tables automatically on first boot, so this file is
-- optional. Running it up front gives you the exact schema and locks the tables down
-- with Row Level Security. Do not insert demo data here: the backend seeds the
-- deterministic dataset on first start when the tables are empty.
--
-- Connection string for the API (Vercel/serverless): use the POOLED string from
-- Supabase Dashboard → Connect, not the direct db.<ref>.supabase.co host (IPv6-only,
-- unreachable from Vercel):
--   postgresql://postgres.<project-ref>:<PASSWORD>@<region>.pooler.supabase.com:6543/postgres?sslmode=require
-- You can paste it as-is; the backend rewrites it to the psycopg driver form.
--
-- RLS: enabled with no policies. The API connects as the postgres role, which
-- bypasses RLS, so the app keeps working while anon/authenticated API keys reach
-- nothing through PostgREST.

BEGIN;

CREATE TABLE IF NOT EXISTS alerts (
	id SERIAL NOT NULL, 
	severity VARCHAR(12) NOT NULL, 
	category VARCHAR(40) NOT NULL, 
	title VARCHAR(140) NOT NULL, 
	message TEXT NOT NULL, 
	entity_type VARCHAR(24), 
	entity_code VARCHAR(24), 
	status VARCHAR(16) NOT NULL, 
	source VARCHAR(24) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	acknowledged_at TIMESTAMP WITHOUT TIME ZONE, 
	resolved_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_alert_severity CHECK (severity IN ('critical','warning','info')), 
	CONSTRAINT ck_alert_status CHECK (status IN ('active','acknowledged','resolved'))
);

CREATE INDEX IF NOT EXISTS ix_alerts_category ON alerts (category);

CREATE INDEX IF NOT EXISTS ix_alerts_created_at ON alerts (created_at);

CREATE INDEX IF NOT EXISTS ix_alerts_entity_code ON alerts (entity_code);

CREATE INDEX IF NOT EXISTS ix_alerts_severity ON alerts (severity);

CREATE INDEX IF NOT EXISTS ix_alerts_status ON alerts (status);

CREATE TABLE IF NOT EXISTS app_settings (
	key VARCHAR(60) NOT NULL, 
	value VARCHAR(2000) NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS audit_logs (
	id SERIAL NOT NULL, 
	actor VARCHAR(60) NOT NULL, 
	action VARCHAR(60) NOT NULL, 
	entity_type VARCHAR(24) NOT NULL, 
	entity_code VARCHAR(40) NOT NULL, 
	detail TEXT, 
	ts TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action);

CREATE INDEX IF NOT EXISTS ix_audit_logs_ts ON audit_logs (ts);

CREATE TABLE IF NOT EXISTS docks (
	id SERIAL NOT NULL, 
	code VARCHAR(12) NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	capacity_teu INTEGER NOT NULL, 
	max_length_m INTEGER NOT NULL, 
	max_draft_m FLOAT NOT NULL, 
	allowed_cargo VARCHAR(200) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	maintenance_until TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_dock_status CHECK (status IN ('available','occupied','maintenance'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_docks_code ON docks (code);

CREATE INDEX IF NOT EXISTS ix_docks_status ON docks (status);

CREATE TABLE IF NOT EXISTS drivers (
	id SERIAL NOT NULL, 
	code VARCHAR(12) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	duty_status VARCHAR(20) NOT NULL, 
	shift VARCHAR(30) NOT NULL, 
	skills VARCHAR(120) NOT NULL, 
	workload FLOAT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_driver_duty CHECK (duty_status IN ('on_duty','off_duty','on_break'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_drivers_code ON drivers (code);

CREATE INDEX IF NOT EXISTS ix_drivers_duty_status ON drivers (duty_status);

CREATE TABLE IF NOT EXISTS maintenance_tasks (
	id SERIAL NOT NULL, 
	code VARCHAR(20) NOT NULL, 
	equipment_type VARCHAR(12) NOT NULL, 
	equipment_code VARCHAR(20) NOT NULL, 
	reason VARCHAR(200) NOT NULL, 
	risk_score INTEGER NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	scheduled_for TIMESTAMP WITHOUT TIME ZONE, 
	completed_at TIMESTAMP WITHOUT TIME ZONE, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_maintenance_status CHECK (status IN ('scheduled','in_progress','completed')), 
	CONSTRAINT ck_maintenance_equipment CHECK (equipment_type IN ('crane','vehicle')), 
	UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS ix_maintenance_tasks_equipment_code ON maintenance_tasks (equipment_code);

CREATE INDEX IF NOT EXISTS ix_maintenance_tasks_equipment_type ON maintenance_tasks (equipment_type);

CREATE INDEX IF NOT EXISTS ix_maintenance_tasks_status ON maintenance_tasks (status);

CREATE TABLE IF NOT EXISTS operational_events (
	id SERIAL NOT NULL, 
	type VARCHAR(40) NOT NULL, 
	severity VARCHAR(12) NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	message TEXT NOT NULL, 
	entity_type VARCHAR(24), 
	entity_code VARCHAR(24), 
	payload JSON, 
	ts TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_operational_events_entity_code ON operational_events (entity_code);

CREATE INDEX IF NOT EXISTS ix_operational_events_severity ON operational_events (severity);

CREATE INDEX IF NOT EXISTS ix_operational_events_ts ON operational_events (ts);

CREATE INDEX IF NOT EXISTS ix_operational_events_type ON operational_events (type);

CREATE TABLE IF NOT EXISTS simulation_scenarios (
	id SERIAL NOT NULL, 
	scenario_type VARCHAR(32) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	params JSON NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	result JSON, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	applied_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ix_simulation_scenarios_created_at ON simulation_scenarios (created_at);

CREATE INDEX IF NOT EXISTS ix_simulation_scenarios_scenario_type ON simulation_scenarios (scenario_type);

CREATE INDEX IF NOT EXISTS ix_simulation_scenarios_status ON simulation_scenarios (status);

CREATE TABLE IF NOT EXISTS users (
	id SERIAL NOT NULL, 
	code VARCHAR(16) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	role VARCHAR(20) NOT NULL, 
	email VARCHAR(120) NOT NULL, 
	password_hash VARCHAR(200), 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (code)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email);

CREATE TABLE IF NOT EXISTS warehouses (
	id SERIAL NOT NULL, 
	code VARCHAR(12) NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	zone VARCHAR(40) NOT NULL, 
	capacity_teu INTEGER NOT NULL, 
	occupancy INTEGER NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	threshold FLOAT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_warehouse_status CHECK (status IN ('operational','restricted','maintenance'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_warehouses_code ON warehouses (code);

CREATE INDEX IF NOT EXISTS ix_warehouses_status ON warehouses (status);

CREATE TABLE IF NOT EXISTS auth_sessions (
	id SERIAL NOT NULL, 
	token_hash VARCHAR(64) NOT NULL, 
	csrf_token VARCHAR(64) NOT NULL, 
	user_id INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	last_seen_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (token_hash), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_auth_sessions_user_id ON auth_sessions (user_id);

CREATE TABLE IF NOT EXISTS cranes (
	id SERIAL NOT NULL, 
	code VARCHAR(12) NOT NULL, 
	crane_type VARCHAR(12) NOT NULL, 
	capacity_t FLOAT NOT NULL, 
	health FLOAT NOT NULL, 
	utilization FLOAT NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	dock_id INTEGER, 
	x FLOAT NOT NULL, 
	y FLOAT NOT NULL, 
	moves_total INTEGER NOT NULL, 
	last_maintenance TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_crane_status CHECK (status IN ('idle','active','maintenance','fault')), 
	FOREIGN KEY(dock_id) REFERENCES docks (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_cranes_code ON cranes (code);

CREATE INDEX IF NOT EXISTS ix_cranes_dock_id ON cranes (dock_id);

CREATE INDEX IF NOT EXISTS ix_cranes_status ON cranes (status);

CREATE TABLE IF NOT EXISTS ships (
	id SERIAL NOT NULL, 
	code VARCHAR(16) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	cargo_type VARCHAR(40) NOT NULL, 
	cargo_qty INTEGER NOT NULL, 
	priority VARCHAR(12) NOT NULL, 
	eta TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	arrived_at TIMESTAMP WITHOUT TIME ZONE, 
	departed_at TIMESTAMP WITHOUT TIME ZONE, 
	vessel_length_m INTEGER NOT NULL, 
	draft_m FLOAT NOT NULL, 
	handling_hours FLOAT NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	dock_id INTEGER, 
	handling_progress FLOAT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_ship_status CHECK (status IN ('approaching','arrived','waiting','docked','unloading','departed')), 
	CONSTRAINT ck_ship_priority CHECK (priority IN ('low','normal','high','critical')), 
	FOREIGN KEY(dock_id) REFERENCES docks (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_ships_code ON ships (code);

CREATE INDEX IF NOT EXISTS ix_ships_dock_id ON ships (dock_id);

CREATE INDEX IF NOT EXISTS ix_ships_priority ON ships (priority);

CREATE INDEX IF NOT EXISTS ix_ships_status ON ships (status);

CREATE TABLE IF NOT EXISTS vehicles (
	id SERIAL NOT NULL, 
	code VARCHAR(12) NOT NULL, 
	capacity_t FLOAT NOT NULL, 
	fuel FLOAT NOT NULL, 
	health FLOAT NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	driver_id INTEGER, 
	current_task VARCHAR(140), 
	x FLOAT NOT NULL, 
	y FLOAT NOT NULL, 
	route_key VARCHAR(20), 
	route_phase FLOAT NOT NULL, 
	odometer_km FLOAT NOT NULL, 
	total_trips INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_vehicle_status CHECK (status IN ('available','assigned','in_transit','idle','maintenance','fault')), 
	FOREIGN KEY(driver_id) REFERENCES drivers (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_vehicles_code ON vehicles (code);

CREATE INDEX IF NOT EXISTS ix_vehicles_status ON vehicles (status);

CREATE TABLE IF NOT EXISTS containers (
	id SERIAL NOT NULL, 
	code VARCHAR(20) NOT NULL, 
	ship_id INTEGER, 
	cargo_type VARCHAR(40) NOT NULL, 
	priority VARCHAR(12) NOT NULL, 
	status VARCHAR(24) NOT NULL, 
	location VARCHAR(80) NOT NULL, 
	destination VARCHAR(100) NOT NULL, 
	weight_t FLOAT NOT NULL, 
	warehouse_id INTEGER, 
	crane_id INTEGER, 
	vehicle_id INTEGER, 
	dispatched_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_container_status CHECK (status IN ('waiting','allocated','loading','in_transit','at_yard','ready_for_dispatch','delivered')), 
	FOREIGN KEY(ship_id) REFERENCES ships (id), 
	FOREIGN KEY(warehouse_id) REFERENCES warehouses (id), 
	FOREIGN KEY(crane_id) REFERENCES cranes (id), 
	FOREIGN KEY(vehicle_id) REFERENCES vehicles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_containers_code ON containers (code);

CREATE INDEX IF NOT EXISTS ix_containers_created_at ON containers (created_at);

CREATE INDEX IF NOT EXISTS ix_containers_priority ON containers (priority);

CREATE INDEX IF NOT EXISTS ix_containers_ship_id ON containers (ship_id);

CREATE INDEX IF NOT EXISTS ix_containers_status ON containers (status);

CREATE INDEX IF NOT EXISTS ix_containers_updated_at ON containers (updated_at);

CREATE INDEX IF NOT EXISTS ix_containers_warehouse_id ON containers (warehouse_id);

CREATE TABLE IF NOT EXISTS dispatches (
	id SERIAL NOT NULL, 
	code VARCHAR(20) NOT NULL, 
	mode VARCHAR(10) NOT NULL, 
	destination VARCHAR(120) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	scheduled_departure TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	completed_at TIMESTAMP WITHOUT TIME ZONE, 
	carrier VARCHAR(80), 
	vehicle_id INTEGER, 
	capacity_teu INTEGER NOT NULL, 
	notes TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_dispatch_mode CHECK (mode IN ('road','rail')), 
	CONSTRAINT ck_dispatch_status CHECK (status IN ('pending','scheduled','in_transit','completed','cancelled')), 
	FOREIGN KEY(vehicle_id) REFERENCES vehicles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_dispatches_code ON dispatches (code);

CREATE INDEX IF NOT EXISTS ix_dispatches_created_at ON dispatches (created_at);

CREATE INDEX IF NOT EXISTS ix_dispatches_status ON dispatches (status);

CREATE TABLE IF NOT EXISTS assignments (
	id SERIAL NOT NULL, 
	kind VARCHAR(20) NOT NULL, 
	resource_code VARCHAR(20) NOT NULL, 
	resource_id INTEGER, 
	ship_id INTEGER, 
	container_id INTEGER, 
	score FLOAT NOT NULL, 
	source VARCHAR(20) NOT NULL, 
	explanation TEXT, 
	status VARCHAR(20) NOT NULL, 
	created_by VARCHAR(60) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	released_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT ck_assignment_status CHECK (status IN ('active','released')), 
	FOREIGN KEY(ship_id) REFERENCES ships (id), 
	FOREIGN KEY(container_id) REFERENCES containers (id)
);

CREATE INDEX IF NOT EXISTS ix_assignments_created_at ON assignments (created_at);

CREATE INDEX IF NOT EXISTS ix_assignments_kind ON assignments (kind);

CREATE INDEX IF NOT EXISTS ix_assignments_resource_code ON assignments (resource_code);

CREATE INDEX IF NOT EXISTS ix_assignments_ship_id ON assignments (ship_id);

CREATE INDEX IF NOT EXISTS ix_assignments_status ON assignments (status);

CREATE TABLE IF NOT EXISTS container_events (
	id SERIAL NOT NULL, 
	container_id INTEGER NOT NULL, 
	from_status VARCHAR(24), 
	to_status VARCHAR(24) NOT NULL, 
	note TEXT, 
	actor VARCHAR(60) NOT NULL, 
	ts TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(container_id) REFERENCES containers (id)
);

CREATE INDEX IF NOT EXISTS ix_container_events_container_id ON container_events (container_id);

CREATE INDEX IF NOT EXISTS ix_container_events_ts ON container_events (ts);

CREATE TABLE IF NOT EXISTS dispatch_items (
	id SERIAL NOT NULL, 
	dispatch_id INTEGER NOT NULL, 
	container_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(dispatch_id) REFERENCES dispatches (id), 
	FOREIGN KEY(container_id) REFERENCES containers (id)
);

CREATE INDEX IF NOT EXISTS ix_dispatch_items_container_id ON dispatch_items (container_id);

CREATE INDEX IF NOT EXISTS ix_dispatch_items_dispatch_id ON dispatch_items (dispatch_id);

-- Alembic bookkeeping so a later `alembic upgrade head` is a no-op.
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

INSERT INTO alembic_version (version_num)
SELECT '09427a22d60c'
WHERE NOT EXISTS (SELECT 1 FROM alembic_version);

-- Supabase hardening: block PostgREST access via the anon/authenticated keys.
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE docks ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ships ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;

COMMIT;
