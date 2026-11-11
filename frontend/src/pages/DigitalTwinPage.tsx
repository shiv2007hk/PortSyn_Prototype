import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";
import {
  Anchor,
  Boxes,
  Fuel,
  Gauge,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  Ship as ShipIcon,
  Truck,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useTwin, queryClient, keys } from "@/lib/hooks";
import { cn, fmtNumber, fmtTime } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, InlineNote, Panel, PanelHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { PageIntro } from "@/components/common/Bits";
import type { TwinState } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  approaching: "#60A5FA",
  arrived: "#FBBF24",
  waiting: "#FBBF24",
  docked: "#3B82F6",
  unloading: "#22D3EE",
  departed: "#475569",
  available: "#22C55E",
  idle: "#22C55E",
  assigned: "#3B82F6",
  in_transit: "#22D3EE",
  active: "#22D3EE",
  maintenance: "#F59E0B",
  fault: "#EF4444",
  occupied: "#3B82F6",
  operational: "#22C55E",
  restricted: "#F59E0B",
};

type Selection =
  | { type: "ship"; id: number }
  | { type: "crane"; id: number }
  | { type: "truck"; id: number }
  | { type: "warehouse"; code: string }
  | { type: "dock"; code: string }
  | null;

const INITIAL_VIEW = { x: 0, y: 0, w: 1600, h: 900 };

function ShipGlyph({ ship, selected, onSelect }: { ship: TwinState["ships"][number]; selected: boolean; onSelect: () => void }) {
  const color = STATUS_COLORS[ship.status] ?? "#94A3B8";
  const length = Math.max(44, Math.min(78, ship.length_m / 4.2));
  const half = length / 2;
  return (
    <g
      transform={`translate(${ship.x}, ${ship.y})`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onSelect}
      className="cursor-pointer"
    >
      {selected ? <circle r={half + 16} fill="none" stroke="#22D3EE" strokeWidth="1.2" strokeDasharray="3 3" /> : null}
      <polygon
        points={`${-half},-8 ${half - 7},-8 ${half},0 ${half - 7},8 ${-half},8 ${-half - 7},0`}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth="1.1"
      />
      <rect x={-half + 8} y={-5} width={Math.max(12, length - 26)} height={10} fill={color} fillOpacity={0.28} rx={1} />
      {Array.from({ length: 4 }).map((_, index) => (
        <line
          key={index}
          x1={-half + 10 + index * ((length - 22) / 4)}
          y1={-5}
          x2={-half + 10 + index * ((length - 22) / 4)}
          y2={5}
          stroke={color}
          strokeOpacity={0.4}
          strokeWidth="0.6"
        />
      ))}
      <rect x={-half + 2} y={-4} width={5} height={8} fill={color} fillOpacity={0.7} rx={1} />
      <text x={0} y={-13} textAnchor="middle" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#CBD5E1">
        {ship.code}
      </text>
      {ship.status === "unloading" ? (
        <text x={half + 8} y={3} fontSize="8" fontFamily="IBM Plex Mono, monospace" fill="#22D3EE">
          {ship.progress.toFixed(0)}%
        </text>
      ) : null}
    </g>
  );
}

function CraneGlyph({ crane, selected, onSelect }: { crane: TwinState["cranes"][number]; selected: boolean; onSelect: () => void }) {
  const color = STATUS_COLORS[crane.status] ?? "#94A3B8";
  return (
    <g transform={`translate(${crane.x}, ${crane.y})`} onPointerDown={(event) => event.stopPropagation()} onClick={onSelect} className="cursor-pointer">
      {selected ? <rect x={-16} y={-18} width={32} height={34} rx={3} fill="none" stroke="#22D3EE" strokeWidth="1" strokeDasharray="3 3" /> : null}
      <path d="M-11 10V-10h22v20" fill="#0B1A2A" stroke={color} strokeWidth="1.2" />
      <path d="M-13 -10h26M0 -10v-7M-7 -17h14" stroke={color} strokeWidth="1.2" fill="none" />
      <rect x={-3} y={-6} width={6} height={5} fill={color} fillOpacity={0.8} />
      <text x={0} y={24} textAnchor="middle" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" fill="#64748B">
        {crane.code}
      </text>
    </g>
  );
}

function TruckGlyph({ truck, selected, onSelect }: { truck: TwinState["trucks"][number]; selected: boolean; onSelect: () => void }) {
  const color = STATUS_COLORS[truck.status] ?? "#94A3B8";
  return (
    <g transform={`translate(${truck.x}, ${truck.y})`} onPointerDown={(event) => event.stopPropagation()} onClick={onSelect} className="cursor-pointer">
      {selected ? <circle r={12} fill="none" stroke="#22D3EE" strokeWidth="1" /> : null}
      <rect x={-7} y={-4} width={10} height={8} rx={1.2} fill={color} fillOpacity={0.35} stroke={color} strokeWidth="1" />
      <rect x={3} y={-3.5} width={4.5} height={7} rx={1} fill={color} fillOpacity={0.75} />
      <circle cx={-4.5} cy={4.5} r={1.6} fill="#0B1A2A" stroke={color} strokeWidth="0.8" />
      <circle cx={4} cy={4.5} r={1.6} fill="#0B1A2A" stroke={color} strokeWidth="0.8" />
      <text x={0} y={-8} textAnchor="middle" fontSize="7" fontFamily="IBM Plex Mono, monospace" fill="#64748B">
        {truck.code}
      </text>
    </g>
  );
}

function DetailPanel({ selection, twin }: { selection: Selection; twin: TwinState }) {
  if (!selection) {
    return (
      <Panel className="h-full">
        <PanelHeader title="Resource inspector" description="Select any vessel, berth, crane, truck or warehouse in the twin." icon={<Maximize2 size={15} />} />
        <div className="space-y-3 px-4 py-4 text-[12px] leading-relaxed text-slate-500">
          <p>
            The twin is generated from live backend status, not a background image. Ships snap to their assigned berth, trucks interpolate
            along quay routes, and crane colours follow the same state machine used by the optimizer.
          </p>
          <div className="space-y-1.5">
            {[
              ["Ships", "hull glyph + discharge %"],
              ["Berths", "occupancy & vessel"],
              ["Cranes", "status + health"],
              ["Trucks", "live route phase"],
              ["Storage", "TEU fill against capacity"],
            ].map(([label, hint]) => (
              <div key={label} className="flex items-center justify-between border-b border-line/60 pb-1.5 last:border-0">
                <span className="text-slate-400">{label}</span>
                <span className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">{hint}</span>
              </div>
            ))}
          </div>
          <div className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-700">{twin.source_note}</div>
        </div>
      </Panel>
    );
  }

  if (selection.type === "ship") {
    const ship = twin.ships.find((row) => row.id === selection.id);
    if (!ship) return null;
    return (
      <Panel>
        <PanelHeader title={ship.code} description={ship.name} icon={<ShipIcon size={15} />} action={<Badge className="normal-case">{ship.status}</Badge>} />
        <div className="space-y-2.5 px-4 py-4 text-[12px]">
          <Row label="Berth" value={ship.dock_code ?? "At anchorage"} />
          <Row label="Priority" value={ship.priority} />
          <Row label="Cargo" value={`${fmtNumber(ship.cargo_qty)} TEU`} />
          <Row label="LOA" value={`${ship.length_m} m`} />
          <div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Discharge</span>
              <span className="font-mono text-slate-300">{ship.progress.toFixed(0)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-600">
              <div className="h-full rounded-full bg-signal-cyan" style={{ width: `${ship.progress}%` }} />
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  if (selection.type === "crane") {
    const crane = twin.cranes.find((row) => row.id === selection.id);
    if (!crane) return null;
    return (
      <Panel>
        <PanelHeader title={crane.code} description={`${crane.crane_type} quay crane`} icon={<Gauge size={15} />} action={<Badge className="normal-case">{crane.status}</Badge>} />
        <div className="space-y-2.5 px-4 py-4 text-[12px]">
          <Row label="Berth" value={crane.dock_code ?? "Unassigned"} />
          <Row label="Health" value={`${crane.health}%`} />
          <Row label="Utilisation" value={`${crane.utilization}%`} />
          <div className="pt-1 font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">
            {crane.health < 60 ? "Below the 60% maintenance watch line" : "Inside operating band"}
          </div>
        </div>
      </Panel>
    );
  }

  if (selection.type === "truck") {
    const truck = twin.trucks.find((row) => row.id === selection.id);
    if (!truck) return null;
    return (
      <Panel>
        <PanelHeader title={truck.code} description={truck.driver ?? "Unassigned driver"} icon={<Truck size={15} />} action={<Badge className="normal-case">{truck.status}</Badge>} />
        <div className="space-y-2.5 px-4 py-4 text-[12px]">
          <Row label="Task" value={truck.task ?? "Idle"} />
          <Row label="Fuel" value={`${truck.fuel}%`} />
          <Row label="Health" value={`${truck.health}%`} />
          <Row label="Route" value={truck.route_key ?? "Staging"} />
          <div className="flex items-center gap-1.5 font-mono text-3xs uppercase tracking-[0.06em]">
            <Fuel size={11} className={truck.fuel < 20 ? "text-amber-300" : "text-slate-600"} />
            <span className={truck.fuel < 20 ? "text-amber-300" : "text-slate-600"}>
              {truck.fuel < 20 ? "Below 20% dispatch floor" : "Above dispatch floor"}
            </span>
          </div>
        </div>
      </Panel>
    );
  }

  if (selection.type === "warehouse") {
    const warehouse = twin.warehouses.find((row) => row.code === selection.code);
    if (!warehouse) return null;
    return (
      <Panel>
        <PanelHeader title={warehouse.code} description={warehouse.name} icon={<WarehouseIcon size={15} />} action={<Badge className="normal-case">{warehouse.status}</Badge>} />
        <div className="space-y-2.5 px-4 py-4 text-[12px]">
          <Row label="Zone" value={warehouse.zone} />
          <Row label="Occupancy" value={`${warehouse.occupancy} / ${warehouse.capacity_teu} TEU`} />
          <Row label="Available" value={`${warehouse.available} TEU`} />
          <Row label="Threshold" value={`${warehouse.threshold}%`} />
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-600">
            <div className={cn("h-full rounded-full", warehouse.utilization >= 95 ? "bg-red-400" : warehouse.above_threshold ? "bg-amber-400" : "bg-emerald-400")} style={{ width: `${warehouse.utilization}%` }} />
          </div>
        </div>
      </Panel>
    );
  }

  const dock = twin.docks.find((row) => row.code === selection.code);
  if (!dock) return null;
  return (
    <Panel>
      <PanelHeader title={dock.code} description={dock.name} icon={<Anchor size={15} />} action={<Badge className="normal-case">{dock.status}</Badge>} />
      <div className="space-y-2.5 px-4 py-4 text-[12px]">
        <Row label="Vessel" value={dock.ship?.code ?? "—"} />
        <Row label="Capacity" value={`${fmtNumber(dock.capacity_teu)} TEU`} />
        <Row label="Max LOA" value={`${dock.max_length_m} m`} />
        <Row label="Max draft" value={`${dock.max_draft_m} m`} />
        <Row label="Cargo fit" value={dock.allowed_cargo.join(", ")} />
        {dock.maintenance_until ? <Row label="Returns" value={fmtTime(dock.maintenance_until)} /> : null}
      </div>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/50 pb-2 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-right font-mono text-[11px] text-slate-200">{value}</span>
    </div>
  );
}

export function DigitalTwinPage() {
  const { data: twin, isLoading, isError, error } = useTwin();
  const [selection, setSelection] = useState<Selection>(null);
  const [view, setView] = useState(INITIAL_VIEW);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number; viewX: number; viewY: number; moved: boolean } | null>(null);
  const { lastMessageAt } = useRealtime();

  const clockMutation = useMutation({
    mutationFn: (body: { running?: boolean; speed?: number }) => api.system.updateClock(body),
    onSuccess: (result) => {
      queryClient.setQueryData(keys.twin, result.twin);
      queryClient.invalidateQueries({ queryKey: keys.system });
      toast.success(`Simulation ${result.sim_clock.running ? "running" : "paused"}`, {
        description: `Clock speed ${result.sim_clock.speed}×. Synthetic ticker only.`,
      });
    },
    onError: (mutationError) => toast.error("Could not change the simulation clock", { description: mutationError.message }),
  });

  const statusCounts = useMemo(() => {
    if (!twin) return {};
    return twin.ships.reduce<Record<string, number>>((acc, ship) => {
      acc[ship.status] = (acc[ship.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [twin]);

  const zoom = (factor: number) => {
    setView((current) => {
      const w = Math.max(420, Math.min(1600, current.w * factor));
      const h = Math.max(236, Math.min(900, current.h * factor));
      return { x: current.x + (current.w - w) / 2, y: current.y + (current.h - h) / 2, w, h };
    });
  };

  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    zoom(event.deltaY > 0 ? 1.12 : 0.89);
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y, moved: false };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    const scaleX = view.w / rect.width;
    const scaleY = view.h / rect.height;
    setView((current) => ({ ...current, x: drag.viewX - dx * scaleX, y: drag.viewY - dy * scaleY }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-3 xl:grid-cols-[1fr_290px]">
          <Skeleton className="h-[62vh]" />
          <Skeleton className="h-[62vh]" />
        </div>
      </div>
    );
  }

  if (isError || !twin) {
    return (
      <div className="space-y-4">
        <PageIntro eyebrow="Command · digital twin" title="Live port twin" description="The twin requires the operations API." />
        <InlineNote tone="critical">{error instanceof Error ? error.message : "Twin unavailable"}</InlineNote>
      </div>
    );
  }

  const layout = twin.layout;
  const clock = twin.sim_clock;

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Command · digital twin"
        title="Berth-to-gate, rendered from live state"
        description="Every marker is positioned by the backend from current vessel, crane, truck and storage records. Pan, zoom and inspect — the overlay refreshes over the WebSocket stream."
        meta={
          <>
            <Badge className="border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300">Synthetic positions</Badge>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">
              {lastMessageAt ? `Last stream frame ${fmtTime(new Date(lastMessageAt).toISOString(), true)}` : "Awaiting first stream frame"}
            </span>
          </>
        }
        actions={
          <>
            <Segmented
              options={[
                { value: "0.5", label: "0.5×" },
                { value: "1", label: "1×" },
                { value: "2", label: "2×" },
              ]}
              value={String(clock.speed)}
              onChange={(value) => clockMutation.mutate({ speed: Number(value) })}
            />
            <Button
              variant={clock.running ? "secondary" : "primary"}
              size="sm"
              loading={clockMutation.isPending}
              onClick={() => clockMutation.mutate({ running: !clock.running })}
            >
              {clock.running ? <Pause size={13} /> : <Play size={13} />}
              {clock.running ? "Pause clock" : "Resume clock"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <TwinKpi label="Queue" value={fmtNumber(twin.kpis.queue)} hint="waiting · allocated · loading" icon={<Boxes size={13} />} />
        <TwinKpi label="Dock occupancy" value={`${twin.kpis.dock_occupancy}%`} hint="occupied / usable berths" icon={<Anchor size={13} />} />
        <TwinKpi label="Storage fill" value={`${twin.kpis.warehouse_occupancy}%`} hint="weighted TEU" icon={<WarehouseIcon size={13} />} />
        <TwinKpi label="Active cranes" value={fmtNumber(twin.kpis.active_cranes)} hint="engaged on vessels" icon={<Gauge size={13} />} />
        <TwinKpi label="Trucks moving" value={fmtNumber(twin.kpis.active_trucks)} hint="assigned or in transit" icon={<Truck size={13} />} />
        <TwinKpi label="Yard boxes" value={fmtNumber(twin.yard.containers)} hint={`${twin.yard.fill}% of ${twin.yard.capacity}`} icon={<Boxes size={13} />} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Terminal 2 layout"
            description="Quay → yard → storage → gate → rail. Drag to pan, scroll to zoom."
            icon={<Maximize2 size={15} />}
            action={
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => zoom(1.18)} aria-label="Zoom out">
                  <Minus size={14} />
                </Button>
                <span className="w-12 text-center font-mono text-3xs tabular-nums text-slate-500">{Math.round((1600 / view.w) * 100)}%</span>
                <Button variant="ghost" size="icon" onClick={() => zoom(0.85)} aria-label="Zoom in">
                  <Plus size={14} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setView(INITIAL_VIEW)} aria-label="Reset view">
                  <Maximize2 size={13} />
                </Button>
              </div>
            }
          />
          <div className="relative bg-ink-950">
            <svg
              ref={svgRef}
              viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
              className="h-[min(66vh,720px)] min-h-[420px] w-full cursor-grab touch-none active:cursor-grabbing"
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              role="img"
              aria-label="Interactive top-down port digital twin"
            >
              <defs>
                <pattern id="waterGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M0 20h40" stroke="rgba(56,189,248,0.06)" strokeWidth="1" />
                </pattern>
                <pattern id="yardSlots" width="22" height="14" patternUnits="userSpaceOnUse">
                  <rect width="22" height="14" fill="none" stroke="rgba(148,163,184,0.10)" strokeWidth="0.7" />
                </pattern>
                <linearGradient id="landFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0C1D2E" />
                  <stop offset="100%" stopColor="#081420" />
                </linearGradient>
              </defs>

              <rect width="1600" height="300" fill="#061320" />
              <rect width="1600" height="300" fill="url(#waterGrid)" />
              <rect y="300" width="1600" height="600" fill="url(#landFill)" />
              <path d="M0 300h1600" stroke="rgba(34,211,238,0.35)" strokeWidth="2" />
              <path d="M0 306h1600" stroke="rgba(34,211,238,0.08)" strokeWidth="8" />

              {/* approach lane */}
              <g>
                <rect x={layout.approach.x} y={layout.approach.y} width={layout.approach.w} height={layout.approach.h} rx="6" fill="rgba(37,99,235,0.04)" stroke="rgba(96,165,250,0.28)" strokeDasharray="8 8" />
                <text x={layout.approach.x + 16} y={layout.approach.y + 22} fontSize="11" fontFamily="IBM Plex Mono, monospace" fill="#475569" letterSpacing="2">
                  APPROACH · ANCHORAGE
                </text>
                {[600, 760, 920, 1080, 1240].map((x) => (
                  <g key={x}>
                    <circle cx={x} cy={layout.approach.y + 56} r="12" fill="none" stroke="rgba(96,165,250,0.2)" strokeDasharray="2 3" />
                    <circle cx={x} cy={layout.approach.y + 56} r="2" fill="rgba(96,165,250,0.4)" />
                  </g>
                ))}
                <text x={layout.approach.x + layout.approach.w - 20} y={layout.approach.y + 22} textAnchor="end" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#1E3A5F">
                  ARRIVAL LANE
                </text>
              </g>

              {/* quay / docks */}
              {layout.docks.map((dock) => {
                const color = STATUS_COLORS[dock.status] ?? "#94A3B8";
                const selected = selection?.type === "dock" && selection.code === dock.code;
                return (
                  <g key={dock.code} onPointerDown={(event) => event.stopPropagation()} onClick={() => setSelection({ type: "dock", code: dock.code })} className="cursor-pointer">
                    <rect x={dock.x} y={dock.y} width={dock.w} height={dock.h} rx="4" fill={color} fillOpacity={0.05} stroke={color} strokeOpacity={selected ? 0.95 : 0.4} strokeWidth={selected ? 1.8 : 1.1} />
                    {Array.from({ length: 5 }).map((_, index) => (
                      <line key={index} x1={dock.x + 10} y1={dock.y + dock.h - 10 - index * 6} x2={dock.x + dock.w - 10} y2={dock.y + dock.h - 10 - index * 6} stroke={color} strokeOpacity={0.12} />
                    ))}
                    <text x={dock.x + 10} y={dock.y + 16} fontSize="11" fontFamily="IBM Plex Mono, monospace" fill="#94A3B8">
                      {dock.code} · {dock.name.replace("Berth ", "")}
                    </text>
                    <text x={dock.x + dock.w - 10} y={dock.y + 16} textAnchor="end" fontSize="9" fontFamily="IBM Plex Mono, monospace" fill={color}>
                      {dock.status.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {/* yard */}
              <g onPointerDown={(event) => event.stopPropagation()}>
                <rect x={layout.yard.x} y={layout.yard.y} width={layout.yard.w} height={layout.yard.h} rx="4" fill="#0B1A29" stroke="rgba(148,163,184,0.28)" />
                <rect x={layout.yard.x + 6} y={layout.yard.y + 6} width={layout.yard.w - 12} height={layout.yard.h - 12} fill="url(#yardSlots)" />
                <text x={layout.yard.x + 12} y={layout.yard.y + 22} fontSize="11" fontFamily="IBM Plex Mono, monospace" fill="#94A3B8">
                  CONTAINER YARD
                </text>
                <text x={layout.yard.x + layout.yard.w - 12} y={layout.yard.y + 22} textAnchor="end" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#22D3EE">
                  {twin.yard.containers} boxes · {twin.yard.fill}%
                </text>
                <rect x={layout.yard.x + 12} y={layout.yard.y + layout.yard.h - 18} width={layout.yard.w - 24} height="5" rx="2.5" fill="rgba(148,163,184,0.12)" />
                <rect x={layout.yard.x + 12} y={layout.yard.y + layout.yard.h - 18} width={(layout.yard.w - 24) * (twin.yard.fill / 100)} height="5" rx="2.5" fill="#22D3EE" />
              </g>

              {/* warehouses */}
              {layout.warehouses.map((slot) => {
                const warehouse = twin.warehouses.find((row) => row.code === slot.code);
                if (!warehouse) return null;
                const selected = selection?.type === "warehouse" && selection.code === slot.code;
                return (
                  <g key={slot.code} onPointerDown={(event) => event.stopPropagation()} onClick={() => setSelection({ type: "warehouse", code: slot.code })} className="cursor-pointer">
                    <rect x={slot.x} y={slot.y} width={slot.w} height={slot.h} rx="4" fill="#0C1D2E" stroke={selected ? "#22D3EE" : "rgba(148,163,184,0.3)"} strokeWidth={selected ? 1.8 : 1.1} />
                    <rect x={slot.x + 8} y={slot.y + 8} width={slot.w - 16} height={slot.h - 38} fill="rgba(34,211,238,0.03)" stroke="rgba(148,163,184,0.10)" />
                    <text x={slot.x + 12} y={slot.y + 24} fontSize="11" fontFamily="IBM Plex Mono, monospace" fill="#94A3B8">
                      {slot.code}
                    </text>
                    <text x={slot.x + slot.w - 12} y={slot.y + 24} textAnchor="end" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill={warehouse.utilization >= 85 ? "#F59E0B" : "#22D3EE"}>
                      {warehouse.utilization}%
                    </text>
                    <rect x={slot.x + 12} y={slot.y + slot.h - 22} width={slot.w - 24} height="6" rx="3" fill="rgba(148,163,184,0.12)" />
                    <rect
                      x={slot.x + 12}
                      y={slot.y + slot.h - 22}
                      width={(slot.w - 24) * (warehouse.utilization / 100)}
                      height="6"
                      rx="3"
                      fill={warehouse.utilization >= 95 ? "#EF4444" : warehouse.utilization >= warehouse.threshold ? "#F59E0B" : "#22C55E"}
                    />
                    <text x={slot.x + 12} y={slot.y + slot.h - 30} fontSize="8.5" fontFamily="IBM Plex Mono, monospace" fill="#475569">
                      {warehouse.occupancy}/{warehouse.capacity_teu} TEU
                    </text>
                  </g>
                );
              })}

              {/* roads */}
              <g>
                {Object.entries(layout.truck_paths).map(([key, points]) => (
                  <polyline
                    key={key}
                    points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="none"
                    stroke="rgba(148,163,184,0.09)"
                    strokeWidth="10"
                    strokeLinejoin="round"
                  />
                ))}
                <line x1="80" y1={layout.road_y} x2="1560" y2={layout.road_y} stroke="#12243A" strokeWidth="26" />
                <line x1="80" y1={layout.road_y} x2="1560" y2={layout.road_y} stroke="rgba(148,163,184,0.24)" strokeWidth="1" strokeDasharray="10 12" />
                {["d1", "d2", "d3", "d4", "yard", "wh_a", "wh_b"].map((key) => {
                  const node = layout.road_nodes[key];
                  if (!node) return null;
                  return (
                    <g key={key}>
                      <line x1={node.x} y1={node.y} x2={node.x} y2={layout.road_y} stroke="#12243A" strokeWidth="14" />
                      <line x1={node.x} y1={node.y} x2={node.x} y2={layout.road_y} stroke="rgba(148,163,184,0.16)" strokeWidth="0.8" strokeDasharray="6 8" />
                    </g>
                  );
                })}
                <text x="92" y={layout.road_y - 20} fontSize="9" fontFamily="IBM Plex Mono, monospace" fill="#334155" letterSpacing="1.5">
                  TERMINAL HAUL ROAD
                </text>
              </g>

              {/* rail */}
              <g>
                <line x1={layout.rail.x1} y1={layout.rail.y1} x2={layout.rail.x2} y2={layout.rail.y2} stroke="#12243A" strokeWidth="16" />
                <line x1={layout.rail.x1} y1={layout.rail.y1} x2={layout.rail.x2} y2={layout.rail.y2} stroke="#334155" strokeWidth="2" />
                <line x1={layout.rail.x1} y1={layout.rail.y1 + 6} x2={layout.rail.x2} y2={layout.rail.y2 + 6} stroke="#334155" strokeWidth="2" />
                {Array.from({ length: 24 }).map((_, index) => (
                  <line key={index} x1={layout.rail.x1 + 10 + index * 17} y1={layout.rail.y1 - 6} x2={layout.rail.x1 + 10 + index * 17} y2={layout.rail.y1 + 12} stroke="#1E3A5F" strokeWidth="1.4" />
                ))}
                <text x={layout.rail.x1} y={layout.rail.y1 - 16} fontSize="9" fontFamily="IBM Plex Mono, monospace" fill="#475569" letterSpacing="1.5">
                  {layout.rail.label.toUpperCase()}
                </text>
              </g>

              {/* gate */}
              <g onPointerDown={(event) => event.stopPropagation()}>
                <rect x={layout.gate.x} y={layout.gate.y} width={layout.gate.w} height={layout.gate.h} rx="4" fill="#0B1A29" stroke="rgba(34,211,238,0.35)" />
                <text x={layout.gate.x + layout.gate.w / 2} y={layout.gate.y + 24} textAnchor="middle" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="#22D3EE">
                  GATE
                </text>
                <text x={layout.gate.x + layout.gate.w / 2} y={layout.gate.y + 40} textAnchor="middle" fontSize="8" fontFamily="IBM Plex Mono, monospace" fill="#475569">
                  OUTBOUND
                </text>
                {[0, 1, 2].map((index) => (
                  <path key={index} d={`M${layout.gate.x + 30 + index * 24} ${layout.gate.y + 58}l8 8l-8 8`} stroke="#22D3EE" strokeOpacity="0.35" strokeWidth="1.4" fill="none" />
                ))}
              </g>

              {/* crane markers */}
              {twin.cranes.map((crane) => (
                <CraneGlyph key={crane.id} crane={crane} selected={selection?.type === "crane" && selection.id === crane.id} onSelect={() => setSelection({ type: "crane", id: crane.id })} />
              ))}

              {/* ships */}
              {twin.ships.map((ship) => (
                <ShipGlyph key={ship.id} ship={ship} selected={selection?.type === "ship" && selection.id === ship.id} onSelect={() => setSelection({ type: "ship", id: ship.id })} />
              ))}

              {/* trucks */}
              {twin.trucks.map((truck) => (
                <TruckGlyph key={truck.id} truck={truck} selected={selection?.type === "truck" && selection.id === truck.id} onSelect={() => setSelection({ type: "truck", id: truck.id })} />
              ))}
            </svg>

            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2 rounded border border-line bg-ink-950/80 px-2.5 py-1.5 backdrop-blur">
              <span className={cn("status-dot", clock.running ? "bg-emerald-400 animate-pulse-dot" : "bg-amber-400")} />
              <span className="font-mono text-3xs uppercase tracking-[0.1em] text-slate-400">
                {clock.running ? `Sim clock ${clock.speed}×` : "Sim clock paused"}
              </span>
              <span className="font-mono text-3xs uppercase tracking-[0.1em] text-slate-600">Every marker from API state</span>
            </div>

            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 rounded border border-line bg-ink-950/80 px-2.5 py-1.5 backdrop-blur">
              {[
                ["Available / operational", "#22C55E"],
                ["Assigned / occupied", "#3B82F6"],
                ["Working / in transit", "#22D3EE"],
                ["Maintenance", "#F59E0B"],
                ["Fault", "#EF4444"],
              ].map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5 font-mono text-3xs uppercase tracking-[0.05em] text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </Panel>

        <div className="space-y-3">
          <DetailPanel selection={selection} twin={twin} />
          <Panel>
            <PanelHeader title="Vessel states" description="Live count by status." icon={<ShipIcon size={15} />} />
            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {Object.entries(statusCounts).map(([status, count]) => (
                <Badge key={status} className="normal-case tracking-[0.04em]" dot={STATUS_COLORS[status] ? undefined : undefined}>
                  {status} · {count}
                </Badge>
              ))}
            </div>
          </Panel>
          <InlineNote tone="warning">
            Positions, speeds and telemetry are generated by the synthetic simulator. PortSync never presents them as live GPS or sensor
            readings.
          </InlineNote>
        </div>
      </div>
    </div>
  );
}

function TwinKpi({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return (
    <div className="rounded-panel border border-line bg-ink-750/70 px-3.5 py-2.5">
      <div className="flex items-center justify-between">
        <span className="micro-label">{label}</span>
        <span className="text-slate-600">{icon}</span>
      </div>
      <div className="mt-1.5 data-value text-[19px] font-medium leading-none">{value}</div>
      <div className="mt-1 truncate text-[10.5px] text-slate-600">{hint}</div>
    </div>
  );
}
