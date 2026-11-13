export type UserRole =
  | "super_admin"
  | "port_administrator"
  | "port_operator"
  | "fleet_manager"
  | "warehouse_manager"
  | "maintenance_manager"
  | "supervisor"
  | "operator"
  | "viewer";

export interface DemoAccount {
  role: UserRole;
  title: string;
  name: string;
  email: string;
  badge: string;
  description: string;
  accent: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "super_admin",
    title: "Super Admin",
    name: "Vikram Malhotra",
    email: "admin@portsync.demo",
    badge: "Full Control",
    description: "Complete terminal authority, user & role admin, system configuration",
    accent: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  },
  {
    role: "port_operator",
    title: "Port Operator",
    name: "Karan Shah",
    email: "operator@portsync.demo",
    badge: "Operations",
    description: "Ship arrivals & departures, berth scheduling, container lifecycle",
    accent: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  },
  {
    role: "fleet_manager",
    title: "Fleet Manager",
    name: "Rajesh Kumar",
    email: "fleet@portsync.demo",
    badge: "Fleet & Cranes",
    description: "Vehicles, drivers, cranes, equipment allocation & resource optimizer",
    accent: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  {
    role: "warehouse_manager",
    title: "Warehouse Manager",
    name: "Meera Patel",
    email: "warehouse@portsync.demo",
    badge: "Storage & Dispatch",
    description: "Container storage, inventory management, warehouse zones & outbound dispatch",
    accent: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  },
  {
    role: "maintenance_manager",
    title: "Maintenance Manager",
    name: "David Chen",
    email: "maintenance@portsync.demo",
    badge: "Equipment Health",
    description: "Equipment diagnostics, maintenance schedules, repairs & predictive alerts",
    accent: "text-rose-400 border-rose-500/30 bg-rose-500/10",
  },
  {
    role: "supervisor",
    title: "Supervisor (Legacy)",
    name: "Priya Menon",
    email: "priya.menon@portsync.demo",
    badge: "Terminal 2",
    description: "Terminal supervisor with full operational oversight and override capabilities",
    accent: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  },
];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  port_administrator: "Port Administrator",
  port_operator: "Port Operator",
  fleet_manager: "Fleet Manager",
  warehouse_manager: "Warehouse Manager",
  maintenance_manager: "Maintenance Manager",
  supervisor: "Supervisor",
  operator: "Port Operator",
  viewer: "Read-only Viewer",
};

export const ROLE_ROUTE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    "/app",
    "/app/twin",
    "/app/ships",
    "/app/optimizer",
    "/app/fleet",
    "/app/containers",
    "/app/warehouse",
    "/app/simulations",
    "/app/alerts",
    "/app/analytics",
    "/app/system",
  ],
  port_administrator: [
    "/app",
    "/app/twin",
    "/app/ships",
    "/app/optimizer",
    "/app/fleet",
    "/app/containers",
    "/app/warehouse",
    "/app/simulations",
    "/app/alerts",
    "/app/analytics",
  ],
  supervisor: [
    "/app",
    "/app/twin",
    "/app/ships",
    "/app/optimizer",
    "/app/fleet",
    "/app/containers",
    "/app/warehouse",
    "/app/simulations",
    "/app/alerts",
    "/app/analytics",
  ],
  port_operator: [
    "/app",
    "/app/twin",
    "/app/ships",
    "/app/containers",
    "/app/alerts",
    "/app/analytics",
  ],
  operator: [
    "/app",
    "/app/twin",
    "/app/ships",
    "/app/containers",
    "/app/alerts",
    "/app/analytics",
  ],
  fleet_manager: [
    "/app",
    "/app/twin",
    "/app/fleet",
    "/app/optimizer",
    "/app/alerts",
    "/app/analytics",
  ],
  warehouse_manager: [
    "/app",
    "/app/containers",
    "/app/warehouse",
    "/app/alerts",
    "/app/analytics",
  ],
  maintenance_manager: [
    "/app",
    "/app/fleet",
    "/app/alerts",
    "/app/analytics",
  ],
  viewer: [
    "/app",
    "/app/twin",
    "/app/ships",
    "/app/containers",
    "/app/alerts",
    "/app/analytics",
  ],
};

export function hasRouteAccess(role: string | null | undefined, path: string): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;

  const normalized = path.replace(/\/$/, "");
  const allowed = ROLE_ROUTE_PERMISSIONS[role] ?? ROLE_ROUTE_PERMISSIONS.viewer;
  return allowed.includes(normalized);
}

export function getPermittedRoutes(role: string | null | undefined): string[] {
  if (!role) return ["/app"];
  return ROLE_ROUTE_PERMISSIONS[role] ?? ["/app"];
}

export function getDefaultRoute(role: string | null | undefined): string {
  const routes = getPermittedRoutes(role);
  return routes[0] ?? "/app";
}
