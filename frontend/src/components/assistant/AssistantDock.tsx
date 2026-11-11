import { useEffect, useRef, useState } from "react";
import { Bot, MessageSquare, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import type { AssistantReply } from "@/lib/types";
import { cn } from "@/lib/format";
import { Badge, Button } from "@/components/ui/primitives";
import { LogoMark } from "@/components/layout/Logo";

interface Turn {
  id: number;
  role: "user" | "assistant";
  content: string;
  meta?: Pick<AssistantReply, "mode" | "facts" | "data_note">;
}

const WELCOME =
  "I'm the PortSync operations assistant. I answer only from the live operational database — vessels, berths, trucks, containers, warehouses, dispatches and alerts. I'm read-only: I can recommend, not execute.";

export function AssistantDock() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ llm_configured: boolean; mode: string; suggestions: string[]; note: string } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([
    { id: 0, role: "assistant", content: WELCOME, meta: { mode: "rules", facts: [], data_note: "Read-only assistant." } },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.assistant
      .status()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, turns, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const id = Date.now();
    setTurns((current) => [...current, { id, role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const history = turns
        .filter((turn) => turn.id !== 0)
        .slice(-8)
        .map((turn) => ({ role: turn.role, content: turn.content }));
      const reply = await api.assistant.chat(message, history);
      setTurns((current) => [
        ...current,
        { id: id + 1, role: "assistant", content: reply.answer, meta: { mode: reply.mode, facts: reply.facts, data_note: reply.data_note } },
      ]);
    } catch (error) {
      setTurns((current) => [
        ...current,
        {
          id: id + 1,
          role: "assistant",
          content: error instanceof Error ? `I could not reach the operations API: ${error.message}` : "I could not reach the operations API.",
          meta: { mode: "rules", facts: [], data_note: "No data was returned." },
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex h-11 items-center gap-2 rounded-full border border-cyan-400/30 bg-ink-800 pl-2 pr-4 text-slate-200 shadow-float transition-transform hover:-translate-y-0.5",
          open && "hidden",
        )}
        aria-label="Open operations assistant"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/15">
          <Sparkles size={14} className="text-signal-cyan" />
        </span>
        <span className="text-[12.5px] font-medium">Ops assistant</span>
        <span className={cn("status-dot", status?.llm_configured ? "bg-emerald-400" : "bg-amber-400")} />
      </button>

      {open ? (
        <div className="fixed inset-x-3 bottom-3 z-40 flex h-[min(620px,calc(100vh-96px))] flex-col overflow-hidden rounded-panel border border-line-strong bg-ink-850/98 shadow-float backdrop-blur-md sm:left-auto sm:right-5 sm:bottom-5 sm:w-[400px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2.5">
              <LogoMark size={26} />
              <div>
                <div className="flex items-center gap-2 font-display text-[13px] font-semibold text-slate-100">
                  Operations assistant
                  <Badge className="border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300">
                    {status?.llm_configured ? "LLM" : "Rules"}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-1 font-mono text-3xs uppercase tracking-[0.08em] text-slate-500">
                  <ShieldCheck size={10} />
                  Read-only · grounded in live data
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-slate-500 hover:bg-ink-700 hover:text-slate-200"
              aria-label="Close assistant"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto scroll-thin px-4 py-4">
            {turns.map((turn) => (
              <div key={turn.id} className={cn("flex gap-2.5", turn.role === "user" ? "justify-end" : "justify-start")}>
                {turn.role === "assistant" ? (
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-cyan-400/25 bg-cyan-400/[0.08]">
                    <Bot size={13} className="text-cyan-300" />
                  </span>
                ) : null}
                <div
                  className={cn(
                    "max-w-[85%] rounded-md px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap",
                    turn.role === "user"
                      ? "bg-marine-600 text-white"
                      : "border border-line bg-ink-800 text-slate-300",
                  )}
                >
                  {turn.content}
                  {turn.role === "assistant" && turn.meta?.facts?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
                      {turn.meta.facts.map((fact) => (
                        <span
                          key={`${fact.label}-${fact.value}`}
                          className="rounded border border-line bg-ink-900/60 px-1.5 py-0.5 font-mono text-3xs text-slate-400"
                        >
                          {fact.label}: <span className="text-slate-200">{fact.value}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {turn.role === "assistant" && turn.meta?.data_note ? (
                    <div className="mt-2 font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">{turn.meta.data_note}</div>
                  ) : null}
                </div>
                {turn.role === "user" ? (
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-marine-600/25 font-mono text-3xs text-marine-300">
                    PM
                  </span>
                ) : null}
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="flex gap-1">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-400" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-400 [animation-delay:120ms]" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-400 [animation-delay:240ms]" />
                </span>
                Reading operational snapshot…
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-line px-3 py-2.5">
            <div className="mb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
              {(status?.suggestions ?? ["Which docks are available?", "Which trucks are ready?"]).slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="shrink-0 rounded-full border border-line bg-ink-800 px-2.5 py-1 text-[10.5px] text-slate-400 transition-colors hover:border-cyan-400/30 hover:text-slate-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            {status && !status.llm_configured ? (
              <div className="mb-2 flex items-start gap-1.5 rounded border border-amber-500/20 bg-amber-500/[0.05] px-2 py-1.5 text-[10.5px] leading-relaxed text-amber-200/80">
                <MessageSquare size={11} className="mt-0.5 shrink-0" />
                No LLM key configured — grounded rules engine active. Answers still come from live data.
              </div>
            ) : null}
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                send(input);
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about berths, trucks, containers…"
                className="field h-9 flex-1"
                maxLength={1000}
              />
              <Button type="submit" variant="primary" size="icon" loading={busy} disabled={!input.trim()} aria-label="Send message">
                {busy ? null : <Send size={14} />}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
