export type Severity = "critical" | "warning" | "info";
export type Priority = "low" | "normal" | "high" | "critical";
export type CargoType = "general" | "reefer" | "hazardous" | "bulk";

export interface Paged<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

export interface EventRow {
  id: number;
  type: string;
  severity: Severity;
  title: string;
  message: string;
  entity_type: string | null;
  entity_code: string | null;
  payload: Record<string, unknown> | null;
  ts: string;
}

export interface HealthComponent {
  key: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface HealthScore {
  score: number;
  grade: string;
  components: HealthComponent[];
  weights: Record<string, number>;
  formula: string;
}

export interface KpiCard {
  key: string;
  label: string;
  value: number;
  unit: string;
  hint: string;
}

export interface Dashboard {
  generated_at: string;
  kpis: KpiCard[];
  summary: Record<string, number>;
  health: HealthScore;
  activity: EventRow[];
  charts: {
    arrivals_7d: { date: string; arrivals: number; throughput: number; dispatches: number; alerts: number }[];
    utilization: { name: string; value: number }[];
    dock_status: Dock[];
    ships_by_status: Record<string, number>;
    alerts_by_severity: Record<string, number>;
    pending_dispatches: Dispatch[];
    warehouses: Warehouse[];
  };
  data_note: string;
}

export interface Dock {
  id: number;
  code: string;
  name: string;
  capacity_teu: number;
  max_length_m: number;
  max_draft_m: number;
  allowed_cargo: string[];
  status: "available" | "occupied" | "maintenance";
  maintenance_until: string | null;
  ship: { id: number; code: string; name: string; priority: Priority; status: string } | null;
  utilization: number;
  cranes?: Crane[];
  wait_min?: number;
  idle_cranes?: number;
}

export interface Ship {
  id: number;
  code: string;
  name: string;
  cargo_type: CargoType;
  cargo_qty: number;
  priority: Priority;
  eta: string | null;
  arrived_at: string | null;
  departed_at: string | null;
  handling_hours: number;
  status: "approaching" | "arrived" | "waiting" | "docked" | "unloading" | "departed";
  dock_id: number | null;
  dock_code: string | null;
  handling_progress: number;
  vessel_length_m: number;
  draft_m: number;
  containers_total: number;
  created_at: string;
  updated_at: string;
}

export interface Crane {
  id: number;
  code: string;
  crane_type: "STS" | "RTG" | "MHC";
  capacity_t: number;
  health: number;
  utilization: number;
  status: "idle" | "active" | "maintenance" | "fault";
  dock_id: number | null;
  dock_code: string | null;
  x: number | null;
  y: number | null;
  moves_total: number;
  last_maintenance: string | null;
}

export interface Vehicle {
  id: number;
  code: string;
  capacity_t: number;
  fuel: number;
  health: number;
  status: "available" | "assigned" | "in_transit" | "idle" | "maintenance" | "fault";
  driver_id: number | null;
  driver_code: string | null;
  driver_name: string | null;
  current_task: string | null;
  x: number | null;
  y: number | null;
  route_key: string | null;
  route_phase: number;
  odometer_km: number;
  total_trips: number;
}

export interface Driver {
  id: number;
  code: string;
  name: string;
  duty_status: "on_duty" | "off_duty" | "on_break";
  shift: string;
  skills: string[];
  workload: number;
  vehicle_code: string | null;
}

export interface Container {
  id: number;
  code: string;
  ship_id: number | null;
  ship_code: string | null;
  cargo_type: CargoType;
  priority: Priority;
  status:
    | "waiting"
    | "allocated"
    | "loading"
    | "in_transit"
    | "at_yard"
    | "ready_for_dispatch"
    | "delivered";
  location: string;
  destination: string;
  weight_t: number;
  warehouse_code: string | null;
  crane_code: string | null;
  vehicle_code: string | null;
  dispatched_at: string | null;
  created_at: string;
  updated_at: string;
  waiting_hours: number | null;
}

export interface ContainerBoard {
  columns: {
    status: Container["status"];
    count: number;
    priority_counts: Record<string, number>;
    items: Container[];
  }[];
  total: number;
  truncated: boolean;
}

export interface ContainerDetail {
  container: Container;
  history: { from_status: string; to_status: string; note: string; actor: string; ts: string }[];
  dispatch: Dispatch | null;
  ship: { code: string | null; name: string | null };
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  zone: string;
  capacity_teu: number;
  occupancy: number;
  available: number;
  utilization: number;
  status: "operational" | "restricted" | "maintenance";
  threshold: number;
  above_threshold: boolean;
  container_counts?: Record<string, number>;
  tracked_containers?: number;
}

export interface Dispatch {
  id: number;
  code: string;
  mode: "road" | "rail";
  destination: string;
  status: "pending" | "scheduled" | "in_transit" | "completed" | "cancelled";
  scheduled_departure: string | null;
  completed_at: string | null;
  carrier: string | null;
  vehicle_code: string | null;
  capacity_teu: number;
  container_codes: string[];
  container_count: number;
  notes: string | null;
  created_at: string;
}

export interface Alert {
  id: number;
  severity: Severity;
  category: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_code: string | null;
  status: "active" | "acknowledged" | "resolved";
  source: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface MaintenanceTask {
  id: number;
  code: string;
  equipment_type: "crane" | "vehicle";
  equipment_code: string;
  reason: string;
  risk_score: number;
  status: "scheduled" | "in_progress" | "completed";
  scheduled_for: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface RiskEntry {
  equipment_type: "crane" | "vehicle";
  code: string;
  name: string;
  risk_score: number;
  level: "critical" | "warning" | "normal";
  factors: { label: string; value: string; detail: string }[];
  health: number;
  utilization: number;
  days_since_service: number;
  status: string;
  recommendation: string;
  disclaimer: string;
}

export interface MaintenanceOverview {
  risks: RiskEntry[];
  tasks: MaintenanceTask[];
  summary: { critical: number; warning: number; normal: number; open_tasks: number };
  disclaimer: string;
}

export interface Assignment {
  id: number;
  kind: string;
  resource_code: string;
  ship_id: number;
  ship_code: string | null;
  score: number;
  source: string;
  explanation: string | null;
  status: string;
  created_by: string;
  created_at: string;
  released_at: string | null;
}

export interface ScoredResource {
  kind: string;
  code: string;
  name?: string;
  score: number;
  status?: string;
  breakdown: { key: string; label: string; value: number; weight: number; contribution: number }[];
  detail?: Record<string, unknown>;
  wait_min?: number;
  warnings?: string[];
}

export interface Recommendation {
  ship: { code: string; name: string; priority: Priority; status: string };
  dock: ScoredResource | null;
  crane: ScoredResource | null;
  trucks: ScoredResource[];
  drivers: ScoredResource[];
  warehouse: ScoredResource | null;
  alternatives: { docks?: ScoredResource[]; cranes?: ScoredResource[]; trucks?: ScoredResource[]; warehouses?: ScoredResource[] };
  rejected: { kind: string; code: string; reason: string }[];
  weights: Record<string, number | Record<string, number>>;
  overall_score: number;
  blockers: string[];
  expected_wait_min: number;
  estimated_travel_km: number;
  expected_impact: {
    discharge_hours: number;
    container_cycle_min: number;
    crane_move_rate: string;
    priority_weight: number;
    note: string;
  };
  explanation: string[];
  generated_at: string;
}

export interface ShipDetail {
  ship: Ship;
  container_counts: Record<string, number>;
  assignments: Assignment[];
  assignment_history: Assignment[];
  events: EventRow[];
  containers: Container[];
  delay_hours: number;
}

export interface TwinLayout {
  width: number;
  height: number;
  docks: { code: string; name: string; status: string; ship_code: string | null; x: number; y: number; w: number; h: number }[];
  warehouses: { code: string; x: number; y: number; w: number; h: number }[];
  yard: { x: number; y: number; w: number; h: number };
  gate: { x: number; y: number; w: number; h: number };
  rail: { x1: number; y1: number; x2: number; y2: number; label: string };
  approach: { x: number; y: number; w: number; h: number };
  road_y: number;
  road_nodes: Record<string, { x: number; y: number }>;
  truck_paths: Record<string, { x: number; y: number }[]>;
  crane_slots: { code: string; x: number; y: number; dock: string }[];
}

export interface TwinState {
  ts: string;
  layout: TwinLayout;
  ships: {
    id: number;
    code: string;
    name: string;
    status: string;
    priority: Priority;
    x: number;
    y: number;
    heading: number | null;
    dock_code: string | null;
    cargo_qty: number;
    progress: number;
    length_m: number;
  }[];
  cranes: {
    id: number;
    code: string;
    crane_type: string;
    status: string;
    x: number;
    y: number;
    dock_code: string | null;
    health: number;
    utilization: number;
  }[];
  trucks: {
    id: number;
    code: string;
    status: string;
    x: number;
    y: number;
    heading: number;
    fuel: number;
    health: number;
    driver: string | null;
    driver_code: string | null;
    route_key: string | null;
    task: string | null;
  }[];
  warehouses: (Warehouse & { x: number; y: number; w: number; h: number })[];
  docks: Dock[];
  yard: { x: number; y: number; w: number; h: number; containers: number; capacity: number; fill: number };
  kpis: {
    queue: number;
    dock_occupancy: number;
    warehouse_occupancy: number;
    active_cranes: number;
    active_trucks: number;
  };
  sim_clock: { running: boolean; speed: number; source: string };
  simulated: boolean;
  source_note: string;
}

export interface SimulationRow {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  unit: string;
  lower_is_better: boolean;
}

export interface Scenario {
  id: number;
  scenario_type: "crane_failure" | "sudden_ship" | "truck_breakdown" | "warehouse_shortage";
  name: string;
  params: Record<string, string | number>;
  status: "complete" | "applied" | "reset";
  created_at: string;
  applied_at: string | null;
  result?: {
    before: { health: number; kpis: Record<string, number> };
    after: { health: number; kpis: Record<string, number> };
    comparison: SimulationRow[];
    affected: {
      resources: { type: string; code: string; detail: string }[];
      containers: string[];
      ships: { code: string; detail: string }[];
    };
    recommendations: { action: string; detail: string; target?: string }[];
    narrative: string[];
    delays: Record<string, number | string>;
    disclaimer: string;
  };
}

export interface Analytics {
  generated_at: string;
  period: { days: number; granularity: string; from: string | null; to: string | null };
  kpis: { key: string; label: string; value: number; unit: string; hint: string }[];
  series: { date: string; label?: string; arrivals: number; throughput: number; dispatches: number; alerts: number }[];
  utilization: { name: string; value: number }[];
  bottlenecks: { title: string; severity: string; detail: string }[];
  comparison: { metric: string; baseline: number; optimized: number; delta_pct: number; note: string };
  health: HealthScore;
  delivered_recent: { code: string; ship_code: string | null; delivered_at: string | null; warehouse: string | null }[];
  data_note: string;
}

export interface SystemInfo {
  app: string;
  version: string;
  environment: string;
  port: { name: string; code: string; timezone: string };
  simulation: { enabled: boolean; tick_seconds: number; seed: number; running: boolean; speed: number; tick: number };
  assistant: { llm_configured: boolean; mode: string; read_only: boolean };
  realtime: { websocket_clients: number; topics: string[] };
  current_user: { id: number; code: string; name: string; role: string; email: string } | null;
  data_note: string;
}

export interface AssistantReply {
  answer: string;
  mode: "rules" | "llm";
  grounded: boolean;
  facts: { label: string; value: string }[];
  suggestions: string[];
  data_note: string;
}
