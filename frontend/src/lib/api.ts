import type {
  Alert,
  Analytics,
  AssistantReply,
  Assignment,
  Container,
  ContainerBoard,
  ContainerDetail,
  Crane,
  Dashboard,
  Dispatch,
  Dock,
  Driver,
  EventRow,
  HealthScore,
  MaintenanceOverview,
  MaintenanceTask,
  Paged,
  Recommendation,
  Scenario,
  Ship,
  ShipDetail,
  SystemInfo,
  TwinState,
  Vehicle,
  Warehouse,
} from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const CSRF_KEY = "portsync-csrf";

export function setCsrfToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(CSRF_KEY, token);
    else sessionStorage.removeItem(CSRF_KEY);
  } catch {
    /* session storage can be blocked */
  }
}

function csrfToken(): string | null {
  try {
    return sessionStorage.getItem(CSRF_KEY);
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const token = csrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${BASE}/api${path}`, { ...init, headers, credentials: "include" });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).join("; ");
    } catch {
      /* non-JSON error body */
    }
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("portsync:unauthorized"));
    }
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

export interface AuthUser {
  id: number;
  code: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthSession {
  user: AuthUser;
  csrf_token: string;
  expires_at: string;
}

export interface PublicSummary {
  docks_connected: number;
  docks_operational: number;
  active_equipment: number;
  active_cranes: number;
  active_trucks: number;
  synchronization_pct: number;
  schedule: {
    code: string;
    name: string;
    status: string;
    eta: string | null;
    dock_code: string | null;
    cargo_qty: number;
  }[];
  simulated: boolean;
  data_note: string;
}

export interface PublicTrack {
  kind: "ship" | "container";
  code: string;
  name?: string;
  status: string;
  location: string;
  destination?: string;
  priority?: string;
  eta?: string | null;
  last_update: string;
  simulated: boolean;
  data_note: string;
}

export const api = {
  auth: {
    login: (body: { email: string; password: string; remember?: boolean }) => post<AuthSession>("/auth/login", body),
    signup: (body: { name: string; email: string; password: string; terms?: boolean }) => post<AuthSession>("/auth/signup", body),
    me: () => get<AuthSession>("/auth/me"),
    logout: () => post<{ message: string }>("/auth/logout", {}),
    policy: () =>
      get<{ session_hours: number; remember_days: number; min_password_length: number; signup_role: string; demo_users_seeded: boolean }>(
        "/auth/session-policy",
      ),
  },

  public: {
    summary: () => get<PublicSummary>("/public/summary"),
    track: (code: string) => get<PublicTrack>(`/public/track${qs({ code })}`),
  },

  dashboard: () => get<Dashboard>("/dashboard"),
  events: (params: { type?: string; severity?: string; page?: number; page_size?: number } = {}) =>
    get<Paged<EventRow>>(`/events${qs(params)}`),
  twin: () => get<TwinState>("/twin"),

  ships: {
    list: (params: { status?: string; q?: string; include_departed?: boolean; page?: number; page_size?: number } = {}) =>
      get<Paged<Ship>>(`/ships${qs(params)}`),
    get: (code: string) => get<ShipDetail>(`/ships/${code}`),
    create: (body: Record<string, unknown>) => post<{ ship: Ship; event: EventRow }>("/ships", body),
    update: (code: string, body: Record<string, unknown>) => put<Ship>(`/ships/${code}`, body),
    arrive: (code: string) => post<{ message: string; event: EventRow }>(`/ships/${code}/arrive`),
    unload: (code: string) => post<{ message: string; created_containers: number; event: EventRow }>(`/ships/${code}/unload`),
    completeUnload: (code: string) => post<{ message: string; event: EventRow }>(`/ships/${code}/unload/complete`),
    depart: (code: string) => post<{ message: string; event: EventRow }>(`/ships/${code}/depart`),
  },

  docks: {
    list: () => get<{ items: Dock[] }>("/docks"),
    update: (code: string, body: Record<string, unknown>) => patch<Dock>(`/docks/${code}`, body),
  },

  allocations: {
    recommend: (body: { ship_code: string; kind?: string; dock_code?: string; container_code?: string }) =>
      post<Recommendation>("/allocations/recommend", body),
    accept: (body: object) => post<{ message: string; event: EventRow }>("/allocations/accept", body),
    override: (body: object) => post<{ message: string; event: EventRow }>("/allocations/override", body),
    history: (params: { kind?: string; status?: string; page?: number; page_size?: number } = {}) =>
      get<Paged<Assignment>>(`/allocations/history${qs(params)}`),
  },

  resources: {
    summary: () =>
      get<{ cranes: Crane[]; vehicles: Vehicle[]; drivers: Driver[]; summary: Record<string, number> }>("/resources"),
    cranes: () => get<Crane[]>("/resources/cranes"),
    vehicles: () => get<Vehicle[]>("/resources/vehicles"),
    drivers: () => get<Driver[]>("/resources/drivers"),
    createCrane: (body: Record<string, unknown>) => post<Crane>("/resources/cranes", body),
    updateCrane: (code: string, body: Record<string, unknown>) => put<Crane>(`/resources/cranes/${code}`, body),
    deleteCrane: (code: string) => del<{ message: string }>(`/resources/cranes/${code}`),
    createVehicle: (body: Record<string, unknown>) => post<Vehicle>("/resources/vehicles", body),
    updateVehicle: (code: string, body: Record<string, unknown>) => put<Vehicle>(`/resources/vehicles/${code}`, body),
    deleteVehicle: (code: string) => del<{ message: string }>(`/resources/vehicles/${code}`),
    createDriver: (body: Record<string, unknown>) => post<Driver>("/resources/drivers", body),
    updateDriver: (code: string, body: Record<string, unknown>) => put<Driver>(`/resources/drivers/${code}`, body),
    deleteDriver: (code: string) => del<{ message: string }>(`/resources/drivers/${code}`),
    history: (kind: string, code: string) =>
      get<{
        assignments: Assignment[];
        events: EventRow[];
        maintenance: MaintenanceTask[];
        containers: Container[];
      }>(`/resources/${kind}/${code}/history`),
  },

  containers: {
    list: (params: { status?: string; priority?: string; ship_code?: string; q?: string; page?: number; page_size?: number } = {}) =>
      get<Paged<Container>>(`/containers${qs(params)}`),
    board: (params: { priority?: string; ship_code?: string; q?: string } = {}) =>
      get<ContainerBoard>(`/containers/board${qs(params)}`),
    get: (code: string) => get<ContainerDetail>(`/containers/${code}`),
    updateStatus: (code: string, body: Record<string, unknown>) =>
      put<{ container: Container; event: EventRow }>(`/containers/${code}/status`, body),
    qrUrl: (code: string) => `${BASE}/api/containers/${code}/qr.svg`,
  },

  warehouses: {
    list: () =>
      get<{ items: Warehouse[]; summary: Record<string, number>; note: string }>("/warehouses"),
    update: (code: string, body: Record<string, unknown>) => patch<Warehouse>(`/warehouses/${code}`, body),
    assign: (body: { warehouse_code: string; container_codes: string[]; note?: string }) =>
      post<{ message: string; warehouse: Warehouse; event: EventRow }>("/warehouses/assign", body),
  },

  dispatch: {
    list: (params: { status?: string; mode?: string; page?: number; page_size?: number } = {}) =>
      get<Paged<Dispatch> & { summary: Record<string, number> }>(`/dispatch${qs(params)}`),
    ready: () => get<{ containers: Container[]; vehicles: Vehicle[] }>("/dispatch/ready"),
    create: (body: Record<string, unknown>) => post<{ dispatch: Dispatch; event: EventRow }>("/dispatch", body),
    updateStatus: (code: string, status: string) =>
      patch<{ dispatch: Dispatch; event: EventRow }>(`/dispatch/${code}/status`, { status }),
  },

  simulations: {
    list: () => get<{ items: Scenario[] }>("/simulations"),
    current: () => get<{ scenario: Scenario | null }>("/simulations/current"),
    run: (scenario_type: string, params: Record<string, unknown> = {}) =>
      post<Scenario>("/simulations/run", { scenario_type, params }),
    reset: () => post<{ message: string; reset: number }>("/simulations/reset"),
    apply: (scenario_id: number) => post<{ scenario: Scenario; summary: string; event: EventRow }>("/simulations/apply", { scenario_id }),
  },

  alerts: {
    list: (params: { severity?: string; status?: string; category?: string; page?: number; page_size?: number } = {}) =>
      get<Paged<Alert>>(`/alerts${qs(params)}`),
    summary: () =>
      get<{ active: number; acknowledged: number; resolved: number; critical: number; warning: number; info: number; by_category: Record<string, number> }>(
        "/alerts/summary",
      ),
    scan: () => post<{ created: number; items: Alert[] }>("/alerts/scan"),
    acknowledge: (id: number) => post<Alert>(`/alerts/${id}/acknowledge`, {}),
    resolve: (id: number) => post<Alert>(`/alerts/${id}/resolve`, {}),
    toMaintenance: (id: number) => post<MaintenanceTask>(`/alerts/${id}/maintenance`),
  },

  maintenance: {
    overview: () => get<MaintenanceOverview>("/maintenance"),
    createTask: (body: Record<string, unknown>) => post<MaintenanceTask>("/maintenance/tasks", body),
    updateTask: (code: string, status: string) => patch<MaintenanceTask>(`/maintenance/tasks/${code}`, { status }),
  },

  analytics: {
    get: (days: number, granularity: "day" | "week" = "day") => get<Analytics>(`/analytics${qs({ days, granularity })}`),
    exportUrl: (dataset: string, days: number) => `${BASE}/api/analytics/export${qs({ dataset, days })}`,
  },

  assistant: {
    status: () =>
      get<{ llm_configured: boolean; mode: string; read_only: boolean; model: string | null; suggestions: string[]; note: string }>(
        "/assistant/status",
      ),
    chat: (message: string, history: { role: "user" | "assistant"; content: string }[]) =>
      post<AssistantReply>("/assistant/chat", { message, history }),
  },

  system: {
    info: () => get<SystemInfo>("/system/info"),
    settings: () => get<{ health_weights: Record<string, number>; resource_weights: Record<string, number>; sim_clock: { running: boolean; speed: number }; health: HealthScore }>("/system/settings"),
    updateHealthWeights: (weights: Record<string, number>) =>
      put<{ weights: Record<string, number>; health: HealthScore; note: string }>("/system/health-weights", weights),
    updateClock: (body: { running?: boolean; speed?: number }) =>
      put<{ sim_clock: { running: boolean; speed: number }; twin: TwinState }>("/system/sim-clock", body),
    resetDemo: () => post<{ message: string; seed: number }>("/system/reset-demo", { confirm: "RESET" }),
    audit: (page = 1, page_size = 30) => get<Paged<{ id: number; actor: string; action: string; entity_type: string; entity_code: string; detail: string; ts: string }>>(`/system/audit${qs({ page, page_size })}`),
    health: () => get<{ status: string; database: string; environment: string; sim_tick: number; ws_clients: number; time: string }>("/health"),
  },
};

export type Api = typeof api;
