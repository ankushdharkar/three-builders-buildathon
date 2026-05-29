"use client";

import { useState } from "react";
import type { BadgeTone } from "./format";
import { confidenceBars, statusBadge } from "./format";
import { summarize } from "./summary";
import type { Decision, Risk, Source } from "../agent/types";
import type { PipelineStep, TicketView } from "./viewModel";

/**
 * The Triage Console (D1): a three-column dashboard — queue ▸ current ticket +
 * decision/response ▸ retrieved sources + pipeline — over a justification footer.
 * Pure presentation driven entirely by the `tickets` prop, so it renders identically
 * from mock data today and from the live agent later. Selection is the only local
 * state; everything else is derived.
 */
export function Dashboard({ tickets }: { tickets: TicketView[] }) {
  // Default to the ticket currently being worked, else the first in the queue.
  const initial = tickets.find((t) => t.state === "processing") ?? tickets[0];
  const [selectedId, setSelectedId] = useState<number | undefined>(initial?.id);
  const selected = tickets.find((t) => t.id === selectedId) ?? initial;

  const summary = summarize(tickets);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Header summary={summary} />
      <div className="grid min-h-0 flex-1 grid-cols-[clamp(220px,22%,300px)_1fr_clamp(240px,26%,340px)]">
        <QueuePanel tickets={tickets} selectedId={selected?.id} onSelect={setSelectedId} />
        <CurrentTicketPanel ticket={selected} />
        <SourcesPanel ticket={selected} />
      </div>
      <JustificationFooter ticket={selected} />
    </div>
  );
}

/* ── Header ──────────────────────────────────────────────────────────────── */

function Header({ summary }: { summary: ReturnType<typeof summarize> }) {
  const segments = Array.from({ length: summary.total });
  return (
    <header className="flex items-center gap-6 border-b border-hr-border bg-panel px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded bg-hr-green font-mono text-sm font-bold text-black">
          {">"}
        </span>
        <h1 className="text-sm font-semibold tracking-tight">
          HackerRank <span className="text-hr-muted">Support Triage</span>
        </h1>
      </div>

      <div className="flex items-center gap-1" aria-hidden>
        {segments.map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-sm ${i < summary.done ? "bg-hr-green-bright" : "bg-hr-slate/60"}`}
          />
        ))}
      </div>

      <RunStatePill state={summary.runState} />

      <div className="ml-auto flex items-center gap-4 font-mono text-xs">
        <Tally label="replied" value={summary.replied} className="text-hr-green-bright" />
        <Tally label="escalated" value={summary.escalated} className="text-hr-amber" />
        <Tally label="invalid" value={summary.invalid} className="text-hr-muted" />
        <span data-testid="progress-tally" className="text-sm font-semibold">
          {summary.done} / {summary.total}
          <span className="ml-1 text-hr-muted">done</span>
        </span>
      </div>
    </header>
  );
}

function RunStatePill({ state }: { state: ReturnType<typeof summarize>["runState"] }) {
  const tone =
    state === "RUNNING"
      ? "border-hr-green text-hr-green-bright"
      : state === "DONE"
        ? "border-hr-green/40 text-hr-muted"
        : "border-hr-slate text-hr-muted";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-wider ${tone}`}>
      {state === "RUNNING" ? "▶ " : ""}
      {state}
    </span>
  );
}

function Tally({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <span className={className}>
      {label} <span className="font-semibold">{value}</span>
    </span>
  );
}

/* ── Left: Queue ─────────────────────────────────────────────────────────── */

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "text-hr-green-bright",
  warn: "text-hr-amber",
  muted: "text-hr-muted",
  active: "text-hr-green-bright hr-pulse",
  idle: "text-hr-slate",
};

function QueuePanel({
  tickets,
  selectedId,
  onSelect,
}: {
  tickets: TicketView[];
  selectedId?: number;
  onSelect: (id: number) => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-hr-border bg-panel">
      <PanelTitle>Queue</PanelTitle>
      <ul data-testid="queue" className="min-h-0 flex-1 overflow-y-auto">
        {tickets.map((t) => {
          const badge = statusBadge(t.state);
          const active = t.id === selectedId;
          return (
            <li key={t.id}>
              <button
                type="button"
                aria-label={`Ticket #${t.id}: ${t.subject}`}
                aria-current={active}
                onClick={() => onSelect(t.id)}
                className={`flex w-full items-center gap-2 border-l-2 px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "border-hr-green bg-panel-raised"
                    : "border-transparent hover:bg-panel-raised/60"
                }`}
              >
                <span className={`font-mono text-sm ${TONE_CLASSES[badge.tone]}`}>{badge.symbol}</span>
                <span className="font-mono text-xs text-hr-muted">#{t.id}</span>
                <span className="truncate text-xs text-foreground/90">{t.subject}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

/* ── Center: Current ticket ──────────────────────────────────────────────── */

function CurrentTicketPanel({ ticket }: { ticket?: TicketView }) {
  if (!ticket) {
    return (
      <section data-testid="current-ticket" className="grid min-h-0 place-items-center text-hr-muted">
        Press Run to start
      </section>
    );
  }
  return (
    <section data-testid="current-ticket" className="flex min-h-0 flex-col overflow-y-auto px-6 py-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-hr-muted">CURRENT TICKET #{ticket.id}</span>
      </div>

      <h2 className="mt-1 text-lg font-semibold leading-snug">{ticket.subject}</h2>
      <div className="mt-2">
        <CompanyChip company={ticket.company} />
      </div>

      <p className="mt-4 whitespace-pre-wrap border-l-2 border-hr-border pl-3 font-mono text-sm leading-relaxed text-foreground/85">
        {ticket.issue}
      </p>

      {ticket.decision ? (
        <>
          <DecisionCard decision={ticket.decision} />
          <ResponseBlock decision={ticket.decision} />
        </>
      ) : (
        <ProcessingNote />
      )}
    </section>
  );
}

function CompanyChip({ company }: { company: TicketView["company"] }) {
  const isHR = company === "HackerRank";
  return (
    <span
      className={`rounded px-2 py-0.5 font-mono text-[11px] ${
        isHR ? "bg-hr-green text-black" : "border border-hr-slate text-hr-muted"
      }`}
    >
      {company}
    </span>
  );
}

const RISK_TONE: Record<Risk, string> = {
  LOW: "text-hr-green-bright",
  MED: "text-hr-amber",
  HIGH: "text-red-400",
};

function DecisionCard({ decision }: { decision: Decision }) {
  const bars = confidenceBars(decision.confidence);
  return (
    <div
      data-testid="decision-card"
      className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-hr-border bg-panel-raised p-4 font-mono text-sm sm:grid-cols-4"
    >
      <Field label="status">
        <span className="text-hr-green-bright">{decision.status}</span>
      </Field>
      <Field label="request_type">{decision.request_type}</Field>
      <Field label="product_area">{decision.product_area || "—"}</Field>
      <Field label="risk">
        <span className={RISK_TONE[decision.risk]}>{decision.risk}</span>
      </Field>
      <div className="col-span-2 sm:col-span-4">
        <span className="text-[11px] uppercase tracking-wider text-hr-muted">confidence</span>
        <div className="mt-1 flex items-center gap-2">
          <span className="tracking-widest text-hr-green-bright">
            {"▰".repeat(bars.filled)}
            <span className="text-hr-slate">{"▱".repeat(bars.total - bars.filled)}</span>
          </span>
          <span className="text-foreground/80">{decision.confidence.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-hr-muted">{label}</div>
      <div className="mt-0.5 text-foreground">{children}</div>
    </div>
  );
}

function ResponseBlock({ decision }: { decision: Decision }) {
  const escalated = decision.status === "escalated";
  return (
    <div className="mt-5">
      <div className="text-[11px] uppercase tracking-wider text-hr-muted">Response</div>
      <p
        className={`mt-1.5 whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed ${
          escalated ? "border-hr-amber/40 bg-hr-amber/5" : "border-hr-border bg-panel"
        }`}
      >
        {decision.response}
      </p>
    </div>
  );
}

function ProcessingNote() {
  return (
    <div className="mt-5 flex items-center gap-2 rounded-lg border border-hr-green/30 bg-hr-green/5 p-4 text-sm text-hr-muted">
      <span className="hr-pulse text-hr-green-bright">▶</span>
      Triaging this ticket… decision and response will appear here.
    </div>
  );
}

/* ── Right: Sources + Pipeline ───────────────────────────────────────────── */

function SourcesPanel({ ticket }: { ticket?: TicketView }) {
  return (
    <aside data-testid="sources" className="flex min-h-0 flex-col border-l border-hr-border bg-panel">
      <PanelTitle>Retrieved sources</PanelTitle>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {ticket && ticket.sources.length > 0 ? (
          <ul className="space-y-1.5">
            {ticket.sources.map((s) => (
              <SourceRow key={s.articleId} source={s} />
            ))}
          </ul>
        ) : (
          <p className="px-1 py-2 text-xs text-hr-muted">No sources retrieved.</p>
        )}

        {ticket && ticket.pipeline.length > 0 && (
          <>
            <div className="mt-4 mb-1 px-1 text-[11px] uppercase tracking-wider text-hr-muted">
              Pipeline
            </div>
            <ul className="space-y-1 font-mono text-xs">
              {ticket.pipeline.map((step) => (
                <PipelineRow key={step.stage} step={step} />
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

function SourceRow({ source }: { source: Source }) {
  return (
    <li className="rounded-md border border-hr-border bg-panel-raised px-2.5 py-2">
      <div className="flex items-center gap-2 font-mono text-xs">
        <span className="text-hr-green-bright">▸ {source.score.toFixed(2)}</span>
        <span className="ml-auto rounded bg-hr-slate/40 px-1.5 py-0.5 text-[10px] text-hr-muted">
          {source.category}
        </span>
      </div>
      <div className="mt-1 text-xs leading-snug text-foreground/90">{source.title}</div>
    </li>
  );
}

const STEP_MARK: Record<PipelineStep["status"], { mark: string; cls: string }> = {
  done: { mark: "✓", cls: "text-hr-green-bright" },
  running: { mark: "▶", cls: "text-hr-green-bright hr-pulse" },
  pending: { mark: "○", cls: "text-hr-slate" },
  error: { mark: "✕", cls: "text-red-400" },
};

function PipelineRow({ step }: { step: PipelineStep }) {
  const m = STEP_MARK[step.status];
  return (
    <li className="flex items-center gap-2">
      <span className={m.cls}>{m.mark}</span>
      <span className="text-foreground/85">{step.stage}</span>
      {step.detail && <span className="ml-auto text-hr-muted">{step.detail}</span>}
    </li>
  );
}

/* ── Footer: Justification ───────────────────────────────────────────────── */

function JustificationFooter({ ticket }: { ticket?: TicketView }) {
  return (
    <footer
      data-testid="justification"
      className="flex items-start gap-3 border-t border-hr-border bg-panel px-5 py-3 text-sm"
    >
      <span className="mt-0.5 shrink-0 font-mono text-[11px] uppercase tracking-wider text-hr-muted">
        Justification
      </span>
      <p className="leading-snug text-foreground/85">
        {ticket?.decision ? ticket.decision.justification : "—"}
      </p>
    </footer>
  );
}

/* ── Shared ──────────────────────────────────────────────────────────────── */

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-hr-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-hr-muted">
      {children}
    </div>
  );
}
