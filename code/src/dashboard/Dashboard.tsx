"use client";

import { useState } from "react";
import type { BadgeTone } from "./format";
import { confidenceBars, statusBadge } from "./format";
import { summarize } from "./summary";
import { SourceDrawer } from "./SourceDrawer";
import { resolveMockSourceDoc } from "./mockDocs";
import { parseSrcRefs } from "./srcRefs";
import type { Decision, DetectedRequest, Risk, Source, Urgency } from "../agent/types";
import type { PipelineStep, SourceDoc, TicketView } from "./viewModel";

/**
 * The Triage Console (D1) — "Signal" treatment: a mission-control three-column
 * dashboard (queue ▸ current ticket + decision/response ▸ sources + pipeline) over a
 * justification footer. Pure presentation driven entirely by the `tickets` prop, so it
 * renders identically from mock data today and from the live agent later. Selection is
 * the only local state; everything else is derived.
 */
export function Dashboard({
  tickets,
  resolveSourceDoc = resolveMockSourceDoc,
  initialTicketId,
  onRun,
}: {
  tickets: TicketView[];
  /** Maps a clicked source to the article shown in the drawer; mock today, live later. */
  resolveSourceDoc?: (source: Source) => SourceDoc | null;
  /** Deep-link target (e.g. `/?ticket=6` from the Accuracy/Review screens). */
  initialTicketId?: number;
  /** Starts (or re-runs) the triage queue. When omitted, no Run control is shown. */
  onRun?: () => void;
}) {
  // Honor a deep link first, else the ticket being worked, else the first in the queue.
  const deepLinked = tickets.find((t) => t.id === initialTicketId);
  const initial = deepLinked ?? tickets.find((t) => t.state === "processing") ?? tickets[0];
  const [selectedId, setSelectedId] = useState<number | undefined>(initial?.id);
  const selected = tickets.find((t) => t.id === selectedId) ?? initial;

  const [openDoc, setOpenDoc] = useState<SourceDoc | null>(null);
  // Open the drawer for the n-th (1-based) source of the selected ticket, e.g. a [src:n] chip.
  const openSource = (source: Source) => setOpenDoc(resolveSourceDoc(source));
  const openSrcRef = (n: number) => {
    const s = selected?.sources[n - 1];
    if (s) openSource(s);
  };

  const summary = summarize(tickets);

  return (
    <div className="signal-canvas flex h-screen flex-col bg-background font-sans text-foreground">
      <Header summary={summary} onRun={onRun} />
      <div className="grid min-h-0 flex-1 grid-cols-[clamp(240px,23%,320px)_1fr_clamp(248px,27%,360px)]">
        <QueuePanel tickets={tickets} selectedId={selected?.id} onSelect={setSelectedId} />
        <CurrentTicketPanel ticket={selected} />
        <SourcesPanel ticket={selected} onOpenSource={openSource} />
      </div>
      <JustificationFooter ticket={selected} onOpenSrc={openSrcRef} />
      <SourceDrawer doc={openDoc} onClose={() => setOpenDoc(null)} />
    </div>
  );
}

/* ── Tone → color mapping ────────────────────────────────────────────────── */

const DOT_COLOR: Record<BadgeTone, string> = {
  success: "var(--hr-green-bright)",
  warn: "var(--hr-amber)",
  muted: "var(--hr-muted-dim)",
  active: "var(--hr-green-bright)",
  idle: "var(--hr-slate)",
};

const TONE_TEXT: Record<BadgeTone, string> = {
  success: "text-hr-green-bright",
  warn: "text-hr-amber",
  muted: "text-hr-muted",
  active: "text-hr-green-bright",
  idle: "text-hr-muted-dim",
};

/* ── Header ──────────────────────────────────────────────────────────────── */

function Header({
  summary,
  onRun,
}: {
  summary: ReturnType<typeof summarize>;
  onRun?: () => void;
}) {
  const segments = Array.from({ length: summary.total });
  return (
    <header className="glass flex items-center gap-7 border-b border-hr-border px-6 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="relative grid h-7 w-7 place-items-center rounded-md bg-hr-green font-mono text-sm font-bold text-black shadow-[0_0_16px_-2px_var(--hr-green)]">
          {">"}
        </span>
        <h1 className="font-display text-[15px] font-semibold tracking-tight">
          HackerRank <span className="font-normal text-hr-muted">Support Triage</span>
        </h1>
      </div>

      {/* Segmented signal bar: thin bars, lit for done tickets. */}
      <div className="flex items-end gap-[3px]" aria-hidden>
        {segments.map((_, i) => {
          const lit = i < summary.done;
          return (
            <span
              key={i}
              className={`w-[3px] rounded-full ${lit ? "h-4 bg-hr-green-bright shadow-[0_0_6px_-1px_var(--hr-green-bright)]" : "h-2.5 bg-hr-slate/50"}`}
            />
          );
        })}
      </div>

      <RunStatePill state={summary.runState} />

      {onRun && <RunButton runState={summary.runState} onRun={onRun} />}

      <div className="ml-auto flex items-center gap-5 font-mono text-xs">
        <Tally label="replied" value={summary.replied} dot="var(--hr-green-bright)" className="text-hr-green-bright" />
        <Tally label="escalated" value={summary.escalated} dot="var(--hr-amber)" className="text-hr-amber" />
        <Tally label="invalid" value={summary.invalid} dot="var(--hr-muted-dim)" className="text-hr-muted" />
        <span className="h-5 w-px bg-hr-border" aria-hidden />
        <span data-testid="progress-tally" className="font-display text-base font-semibold tracking-tight">
          {summary.done} <span className="text-hr-muted-dim">/</span> {summary.total}
          <span className="ml-1.5 font-sans text-[11px] font-normal uppercase tracking-wider text-hr-muted">done</span>
        </span>
      </div>
    </header>
  );
}

function RunStatePill({ state }: { state: ReturnType<typeof summarize>["runState"] }) {
  const running = state === "RUNNING";
  const tone = running
    ? "border-hr-green/50 text-hr-green-bright"
    : state === "DONE"
      ? "border-hr-green/25 text-hr-muted"
      : "border-hr-slate text-hr-muted";
  return (
    <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium tracking-[0.15em] ${tone}`}>
      <span
        className={`dot ${running ? "dot-glow dot-ping" : ""}`}
        style={{ "--dot": running ? "var(--hr-green-bright)" : "var(--hr-slate)", fontSize: 10 } as React.CSSProperties}
      />
      {state}
    </span>
  );
}

/**
 * Run control (replaces the old auto-run-on-load). Drives the queue on click; the label
 * follows the run state — Run (idle) ▸ Running… (in flight, disabled) ▸ Re-run (done).
 */
function RunButton({
  runState,
  onRun,
}: {
  runState: ReturnType<typeof summarize>["runState"];
  onRun: () => void;
}) {
  const running = runState === "RUNNING";
  const label = running ? "Running…" : runState === "DONE" ? "Re-run" : "Run";
  return (
    <button
      type="button"
      data-testid="run-button"
      onClick={onRun}
      disabled={running}
      aria-label={label}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition-all ${
        running
          ? "cursor-not-allowed border-hr-slate text-hr-muted-dim"
          : "border-hr-green/50 bg-hr-green/10 text-hr-green-bright hover:bg-hr-green/20 hover:shadow-[0_0_16px_-4px_var(--hr-green-bright)]"
      }`}
    >
      <span aria-hidden className="font-sans text-[13px] leading-none">
        {running ? "" : runState === "DONE" ? "↻" : "▶"}
      </span>
      {label}
    </button>
  );
}

function Tally({ label, value, dot, className }: { label: string; value: number; dot: string; className: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <span className="dot dot-glow" style={{ "--dot": dot, fontSize: 8 } as React.CSSProperties} />
      <span className="text-hr-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

/* ── Left: Queue ─────────────────────────────────────────────────────────── */

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
    <aside className="glass flex min-h-0 flex-col border-r border-hr-border">
      <PanelTitle>Queue</PanelTitle>
      <ul data-testid="queue" className="min-h-0 flex-1 overflow-y-auto py-1.5">
        {tickets.map((t, i) => {
          const badge = statusBadge(t.state);
          const active = t.id === selectedId;
          const processing = t.state === "processing";
          return (
            <li key={t.id} className="rise-in px-2" style={{ animationDelay: `${i * 35}ms` }}>
              <button
                type="button"
                aria-label={`Ticket #${t.id}: ${t.subject}`}
                aria-current={active}
                onClick={() => onSelect(t.id)}
                className={`group relative flex w-full items-center gap-2.5 rounded-md border px-3 py-2.5 text-left transition-all ${
                  active
                    ? "border-hr-green/40 bg-hr-green/[0.07] shadow-[inset_2px_0_0_0_var(--hr-green-bright)]"
                    : "border-transparent hover:border-hr-border hover:bg-panel-raised/70"
                }`}
              >
                <span
                  className={`dot ${badge.tone === "idle" ? "" : "dot-glow"} ${processing ? "dot-ping" : ""}`}
                  style={{ "--dot": DOT_COLOR[badge.tone], fontSize: 9 } as React.CSSProperties}
                />
                <span className="font-mono text-[11px] text-hr-muted-dim">#{String(t.id).padStart(2, "0")}</span>
                <span className={`truncate text-[13px] ${active ? "text-foreground" : "text-foreground/80"}`}>
                  {t.subject}
                </span>
                <span className={`ml-auto shrink-0 font-mono text-[9px] uppercase tracking-wider ${TONE_TEXT[badge.tone]} ${processing ? "hr-pulse" : ""}`}>
                  {badge.label}
                </span>
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
      <section data-testid="current-ticket" className="grid min-h-0 place-items-center font-mono text-sm text-hr-muted">
        Press Run to start
      </section>
    );
  }
  return (
    <section data-testid="current-ticket" className="flex min-h-0 flex-col overflow-y-auto px-8 py-6">
      <div className="rise-in" style={{ animationDelay: "60ms" }}>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-hr-muted-dim">
          Current Ticket · #{String(ticket.id).padStart(2, "0")}
        </span>
        <h2 className="mt-1.5 font-display text-[26px] font-semibold leading-[1.15] tracking-tight">
          {ticket.subject}
        </h2>
        <div className="mt-3">
          <CompanyChip company={ticket.company} />
        </div>
      </div>

      {/* Issue transcript */}
      <div className="rise-in mt-5" style={{ animationDelay: "110ms" }}>
        <div className="relative rounded-lg border border-hr-border bg-panel/60 p-4">
          <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-hr-border-bright" aria-hidden />
          <p className="whitespace-pre-wrap pl-3 font-mono text-[13px] leading-relaxed text-foreground/85">
            {ticket.issue}
          </p>
        </div>
      </div>

      {ticket.decision ? (
        <>
          {ticket.decision.requests && ticket.decision.requests.length > 1 && (
            <Decomposition requests={ticket.decision.requests} />
          )}
          <DecisionCard decision={ticket.decision} />
          <ResponseBlock decision={ticket.decision} />
        </>
      ) : ticket.state === "queued" ? (
        <QueuedNote />
      ) : (
        <ProcessingNote />
      )}
    </section>
  );
}

/**
 * Multi-request decomposition (D12): a ticket may bundle several asks. The agent emits
 * one synthesized decision but lists the detected sub-requests here, so a reviewer can
 * see every intent was considered rather than silently dropped.
 */
function Decomposition({ requests }: { requests: DetectedRequest[] }) {
  return (
    <div className="rise-in mt-5" style={{ animationDelay: "130ms" }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hr-muted-dim">
          Detected requests · {requests.length}
        </span>
        <span className="h-px flex-1 bg-hr-border" />
      </div>
      <ul data-testid="decomposition" className="space-y-1.5">
        {requests.map((r, i) => (
          <li
            key={i}
            className="flex items-center gap-2.5 rounded-lg border border-hr-border bg-panel/60 px-3 py-2"
          >
            <span className="font-mono text-[11px] text-hr-muted-dim">{i + 1}</span>
            <span className="flex-1 text-[13px] text-foreground/85">{r.summary}</span>
            <span className="rounded bg-hr-slate/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-hr-muted">
              {r.request_type}
            </span>
            {r.product_area && (
              <span className="rounded bg-hr-slate/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-hr-muted">
                {r.product_area}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompanyChip({ company }: { company: TicketView["company"] }) {
  const isHR = company === "HackerRank";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] ${
        isHR ? "bg-hr-green/15 text-hr-green-bright ring-1 ring-inset ring-hr-green/30" : "text-hr-muted ring-1 ring-inset ring-hr-slate"
      }`}
    >
      <span className="dot" style={{ "--dot": isHR ? "var(--hr-green-bright)" : "var(--hr-slate)", fontSize: 8 } as React.CSSProperties} />
      {company}
    </span>
  );
}

const RISK_TONE: Record<Risk, string> = {
  LOW: "text-hr-green-bright",
  MED: "text-hr-amber",
  HIGH: "text-hr-red",
};

// Urgency is user impact / time-pressure (distinct from risk): higher = more pressing.
const URGENCY_TONE: Record<Urgency, string> = {
  LOW: "text-hr-muted",
  MED: "text-hr-amber",
  HIGH: "text-hr-amber",
};

function DecisionCard({ decision }: { decision: Decision }) {
  const bars = confidenceBars(decision.confidence);
  return (
    <div
      data-testid="decision-card"
      className="rise-in glass mt-6 rounded-xl border border-hr-border-bright p-5"
      style={{ animationDelay: "160ms" }}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hr-muted-dim">Decision</span>
        <span className="h-px flex-1 bg-hr-border" />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="status">
          <span className="text-hr-green-bright text-glow">{decision.status}</span>
        </Field>
        <Field label="request_type">{decision.request_type}</Field>
        <Field label="product_area">{decision.product_area || "—"}</Field>
        <Field label="risk">
          <span className={`${RISK_TONE[decision.risk]} text-glow`}>{decision.risk}</span>
        </Field>
        <Field label="urgency">
          {decision.urgency ? (
            <span className={URGENCY_TONE[decision.urgency]}>{decision.urgency}</span>
          ) : (
            "—"
          )}
        </Field>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hr-muted-dim">confidence</span>
          <span className="font-mono text-xs text-foreground/80">{decision.confidence.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {Array.from({ length: bars.total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < bars.filled ? "bg-hr-green-bright shadow-[0_0_8px_-2px_var(--hr-green-bright)]" : "bg-hr-slate/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-hr-muted-dim">{label}</div>
      <div data-testid={`field-${label}`} className="mt-1 break-words font-mono text-sm text-foreground">
        {children}
      </div>
    </div>
  );
}

function ResponseBlock({ decision }: { decision: Decision }) {
  const escalated = decision.status === "escalated";
  return (
    <div className="rise-in mt-6" style={{ animationDelay: "210ms" }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hr-muted-dim">Response</span>
        <span className="h-px flex-1 bg-hr-border" />
      </div>
      <div className={`relative overflow-hidden rounded-xl border p-5 ${escalated ? "border-hr-amber/35 bg-hr-amber/[0.04]" : "border-hr-border bg-panel/60"}`}>
        <span
          className={`absolute left-0 top-0 bottom-0 w-[3px] ${escalated ? "bg-hr-amber" : "bg-hr-green-bright"}`}
          aria-hidden
        />
        <p className="whitespace-pre-wrap pl-3 text-[14px] leading-relaxed text-foreground/90">{decision.response}</p>
      </div>
    </div>
  );
}

function QueuedNote() {
  return (
    <div
      className="rise-in mt-6 flex items-center gap-3 rounded-xl border border-hr-border bg-panel/60 p-5 text-sm text-hr-muted"
      style={{ animationDelay: "160ms" }}
    >
      <span className="dot" style={{ "--dot": "var(--hr-slate)", fontSize: 12 } as React.CSSProperties} />
      <span className="font-mono text-[13px]">Queued — press Run to triage this ticket.</span>
    </div>
  );
}

function ProcessingNote() {
  return (
    <div
      className="rise-in mt-6 flex items-center gap-3 rounded-xl border border-hr-green/25 bg-hr-green/[0.04] p-5 text-sm text-hr-muted"
      style={{ animationDelay: "160ms" }}
    >
      <span className="dot dot-glow dot-ping" style={{ "--dot": "var(--hr-green-bright)", fontSize: 12 } as React.CSSProperties} />
      <span className="font-mono text-[13px]">Triaging this ticket… decision and response will stream in here.</span>
    </div>
  );
}

/* ── Right: Sources + Pipeline ───────────────────────────────────────────── */

function SourcesPanel({
  ticket,
  onOpenSource,
}: {
  ticket?: TicketView;
  onOpenSource: (source: Source) => void;
}) {
  return (
    <aside data-testid="sources" className="glass flex min-h-0 flex-col border-l border-hr-border">
      <PanelTitle>Retrieved sources</PanelTitle>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {ticket && ticket.sources.length > 0 ? (
          <ul className="space-y-2">
            {ticket.sources.map((s, i) => (
              <SourceRow key={s.articleId} source={s} index={i} onOpen={onOpenSource} />
            ))}
          </ul>
        ) : (
          <p className="px-1 py-2 font-mono text-xs text-hr-muted-dim">No sources retrieved.</p>
        )}

        {ticket && ticket.pipeline.length > 0 && (
          <>
            <div className="mt-6 mb-3 flex items-center gap-2 px-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hr-muted-dim">Pipeline</span>
              <span className="h-px flex-1 bg-hr-border" />
            </div>
            <ol className="relative ml-1.5 border-l border-hr-border">
              {ticket.pipeline.map((step) => (
                <PipelineRow key={step.stage} step={step} />
              ))}
            </ol>
          </>
        )}
      </div>
    </aside>
  );
}

function SourceRow({
  source,
  index,
  onOpen,
}: {
  source: Source;
  index: number;
  onOpen: (source: Source) => void;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, source.score)) * 100);
  return (
    <li className="rise-in" style={{ animationDelay: `${120 + index * 50}ms` }}>
      <button
        type="button"
        aria-label={`Source: ${source.title}`}
        onClick={() => onOpen(source)}
        className="group w-full rounded-lg border border-hr-border bg-panel-raised/60 px-3 py-2.5 text-left transition-colors hover:border-hr-border-bright hover:bg-panel-raised"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-hr-green-bright">{source.score.toFixed(2)}</span>
          <span className="ml-auto rounded bg-hr-slate/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-hr-muted">
            {source.category}
          </span>
        </div>
        {/* relevance micro-bar */}
        <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-hr-slate/30" aria-hidden>
          <span className="block h-full rounded-full bg-hr-green-bright/80 shadow-[0_0_6px_-1px_var(--hr-green-bright)]" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[13px] leading-snug text-foreground/85">
          <span className="flex-1">{source.title}</span>
          <span className="shrink-0 font-mono text-[10px] text-hr-muted-dim opacity-0 transition-opacity group-hover:opacity-100">
            view ↗
          </span>
        </div>
      </button>
    </li>
  );
}

const STEP_MARK: Record<PipelineStep["status"], { dot: string; ping: boolean; text: string }> = {
  done: { dot: "var(--hr-green-bright)", ping: false, text: "text-foreground/85" },
  running: { dot: "var(--hr-green-bright)", ping: true, text: "text-hr-green-bright" },
  pending: { dot: "var(--hr-slate)", ping: false, text: "text-hr-muted-dim" },
  error: { dot: "var(--hr-red)", ping: false, text: "text-hr-red" },
};

function PipelineRow({ step }: { step: PipelineStep }) {
  const m = STEP_MARK[step.status];
  return (
    <li className="relative flex items-center gap-2 py-1.5 pl-4 font-mono text-xs">
      <span
        className={`absolute -left-[5px] dot ${step.status === "pending" ? "" : "dot-glow"} ${m.ping ? "dot-ping" : ""}`}
        style={{ "--dot": m.dot, fontSize: 9 } as React.CSSProperties}
      />
      <span className={m.text}>{step.stage}</span>
      {step.status === "done" && <span className="text-hr-green-bright">✓</span>}
      {step.detail && <span className="ml-auto text-hr-muted-dim">{step.detail}</span>}
    </li>
  );
}

/* ── Footer: Justification ───────────────────────────────────────────────── */

function JustificationFooter({
  ticket,
  onOpenSrc,
}: {
  ticket?: TicketView;
  onOpenSrc: (n: number) => void;
}) {
  const justification = ticket?.decision?.justification;
  const sourceCount = ticket?.sources.length ?? 0;
  return (
    <footer
      data-testid="justification"
      className="glass flex items-center gap-4 border-t border-hr-border px-6 py-3.5"
    >
      <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-hr-muted-dim">
        <span className="dot dot-glow" style={{ "--dot": "var(--hr-green-bright)", fontSize: 7 } as React.CSSProperties} />
        Justification
      </span>
      <p className="text-[13px] leading-snug text-foreground/80">
        {justification
          ? parseSrcRefs(justification).map((seg, i) =>
              "src" in seg ? (
                <SrcChip key={i} n={seg.src} disabled={seg.src > sourceCount} onOpen={onOpenSrc} />
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )
          : "—"}
      </p>
    </footer>
  );
}

/** A clickable `[src: n]` citation chip that opens the n-th source in the drawer. */
function SrcChip({ n, disabled, onOpen }: { n: number; disabled: boolean; onOpen: (n: number) => void }) {
  if (disabled) {
    return <span className="font-mono text-[11px] text-hr-muted-dim">[src {n}]</span>;
  }
  return (
    <button
      type="button"
      aria-label={`Open source ${n}`}
      onClick={() => onOpen(n)}
      className="mx-0.5 rounded border border-hr-green/30 bg-hr-green/[0.06] px-1 py-px align-baseline font-mono text-[11px] text-hr-green-bright transition-colors hover:border-hr-green/60 hover:bg-hr-green/15"
    >
      src {n}
    </button>
  );
}

/* ── Shared ──────────────────────────────────────────────────────────────── */

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-hr-border px-4 py-3">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-hr-muted">
        {children}
      </span>
    </div>
  );
}
