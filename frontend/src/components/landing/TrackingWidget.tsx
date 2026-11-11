import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Anchor, ArrowRight, Boxes, CalendarClock, Loader2, MapPin, Search } from "lucide-react";
import { api, type PublicTrack } from "@/lib/api";
import { cn, fmtDateTime, titleCase } from "@/lib/format";

type Mode = "container" | "ship" | "schedule";

const TABS: { key: Mode; label: string }[] = [
  { key: "container", label: "Container" },
  { key: "ship", label: "Vessel" },
  { key: "schedule", label: "Schedule" },
];

const PLACEHOLDERS: Record<"container" | "ship", string> = {
  container: "CONT-0001",
  ship: "SH-104",
};

export function TrackingWidget() {
  const [mode, setMode] = useState<Mode>("container");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicTrack | null>(null);
  const [searching, setSearching] = useState(false);

  const summary = useQuery({ queryKey: ["public-summary"], queryFn: api.public.summary, refetchInterval: 60_000 });

  const schedule = useMemo(() => summary.data?.schedule ?? [], [summary.data]);

  const runSearch = async () => {
    const code = input.trim().toUpperCase();
    if (!/^(SH-\d{3}|CONT-\d{4})$/.test(code)) {
      setError("Enter a vessel code like SH-104 or a container code like CONT-0001.");
      setResult(null);
      return;
    }
    setSearching(true);
    setError(null);
    setResult(null);
    setQuery(code);
    try {
      const data = await api.public.track(code);
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tracking lookup failed.");
    } finally {
      setSearching(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setResult(null);
    setInput("");
    setQuery("");
  };

  return (
    <div className="w-full max-w-[420px]">
      <div className="rounded-card border border-white/15 bg-[#F7FBFE]/95 p-1 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.75)] backdrop-blur-xl">
        <div className="rounded-[13px] bg-white px-4 pb-4 pt-3.5">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#2477B8]">
              Track your operations
            </div>
            <span className="rounded border border-[#DCE5ED] bg-[#F4F8FB] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#6B7D8F]">
              Demo
            </span>
          </div>

          <div className="mt-3 flex gap-1 rounded-lg bg-[#F1F6FA] p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchMode(tab.key)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium transition-all",
                  mode === tab.key ? "bg-white text-[#102A43] shadow-sm" : "text-[#6B7D8F] hover:text-[#102A43]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode === "schedule" ? (
            <div className="mt-3 space-y-1.5">
              {summary.isLoading ? (
                <div className="flex items-center justify-center py-6 text-[#6B7D8F]">
                  <Loader2 size={16} className="animate-spin" />
                </div>
              ) : schedule.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-[#6B7D8F]">No vessels in the demonstration schedule.</p>
              ) : (
                schedule.map((row) => (
                  <div key={row.code} className="flex items-center justify-between rounded-lg border border-[#E6EEF4] px-2.5 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[11px] font-medium text-[#102A43]">{row.code}</div>
                      <div className="truncate text-[11px] text-[#6B7D8F]">{row.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[10px] text-[#2477B8]">{row.dock_code ?? "Approach"}</div>
                      <div className="font-mono text-[9.5px] uppercase tracking-[0.05em] text-[#8CA0B0]">{fmtDateTime(row.eta)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="mt-3 flex gap-2">
                <div className="relative flex-1">
                  {mode === "container" ? (
                    <Boxes size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8CA0B0]" />
                  ) : (
                    <Anchor size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8CA0B0]" />
                  )}
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void runSearch();
                    }}
                    placeholder={PLACEHOLDERS[mode]}
                    aria-label={mode === "container" ? "Container ID" : "Vessel ID"}
                    className="h-9 w-full rounded-lg border border-[#DCE5ED] bg-[#FBFDFE] pl-8 pr-2 font-mono text-[12px] uppercase tracking-[0.04em] text-[#102A43] placeholder:normal-case placeholder:tracking-normal placeholder:text-[#9AAEBD] focus:border-[#3979E8] focus:outline-none focus:ring-2 focus:ring-[#3979E8]/15"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void runSearch()}
                  disabled={searching}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#102A43] px-3 text-[12px] font-medium text-white transition-colors hover:bg-[#163A56] disabled:opacity-60"
                >
                  {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                  Search
                </button>
              </div>

              {error ? (
                <p className="mt-2 rounded-md border border-[#E9C9C3] bg-[#FCF2F0] px-2.5 py-2 text-[11px] leading-relaxed text-[#A33A2A]">{error}</p>
              ) : null}

              {result ? (
                <div className="mt-2.5 rounded-lg border border-[#D8E9F3] bg-[#F5FAFD] px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-medium text-[#102A43]">{result.code}</span>
                    <span className="rounded bg-[#2477B8] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-white">
                      {titleCase(result.status)}
                    </span>
                  </div>
                  {result.name ? <div className="mt-0.5 text-[11.5px] text-[#3F5668]">{result.name}</div> : null}
                  <div className="mt-1.5 space-y-1 text-[11px] text-[#5B7285]">
                    <div className="flex items-center gap-1.5"><MapPin size={11} /> {result.location}</div>
                    <div className="flex items-center gap-1.5"><CalendarClock size={11} /> Updated {fmtDateTime(result.last_update)}</div>
                  </div>
                </div>
              ) : !error && query ? (
                <p className="mt-2 text-[11px] text-[#8CA0B0]">No record returned for {query}.</p>
              ) : null}
            </>
          )}

          <p className="mt-2.5 flex items-center gap-1.5 text-[10px] leading-relaxed text-[#8CA0B0]">
            <span className="inline-block h-1 w-1 rounded-full bg-[#26B7D3]" />
            Demonstration data · not live port telemetry
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: "Docks connected", value: summary.data?.docks_connected ?? "—" },
          { label: "Active equipment", value: summary.data?.active_equipment ?? "—" },
          { label: "Port sync", value: summary.data ? `${summary.data.synchronization_pct}%` : "—" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-white/10 bg-[#061523]/85 px-2.5 py-2 backdrop-blur-md">
            <div className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[#7FA6BC]">{item.label}</div>
            <div className="mt-0.5 font-mono text-[15px] tabular-nums text-[#EAF7FC]">{item.value}</div>
          </div>
        ))}
      </div>
      <a
        href="#platform"
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#061523]/60 px-2.5 py-1 text-[11px] text-[#B6DFEE] backdrop-blur-md transition-colors hover:border-white/25 hover:text-white"
      >
        Explore the platform <ArrowRight size={12} />
      </a>
    </div>
  );
}
