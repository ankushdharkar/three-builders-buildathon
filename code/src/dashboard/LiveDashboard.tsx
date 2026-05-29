"use client";

import { useCallback, useRef, useState } from "react";

import type { Decision, PipelineEvent, Ticket } from "../agent/types";
import { applyEvent, seedView } from "../app/lib/triageSource";
import { streamTriage } from "../app/lib/triageClient";
import { Dashboard } from "./Dashboard";
import type { TicketView } from "./viewModel";

/** Drives one ticket through the live endpoint, emitting each streamed event. */
export type TriageRunner = (
  ticket: Ticket,
  onEvent: (event: PipelineEvent) => void,
) => Promise<void>;

/** One completed triage result, persisted to the graded output.csv. */
export interface RunResult {
  ticket: Ticket;
  decision: Decision;
}

/** Persists the completed run to `support_tickets/output.csv` (via POST /api/output). */
export type Persist = (results: RunResult[]) => Promise<void>;

const defaultRunner: TriageRunner = (ticket, onEvent) => streamTriage(ticket, onEvent);

const defaultPersist: Persist = async (results) => {
  try {
    await fetch("/api/output", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results }),
    });
  } catch {
    // Persisting output.csv is best-effort; a failed write never breaks the live view.
  }
};

/**
 * Client wrapper that drives the Triage Console from the live agent (build prompt 008).
 * Seeds the queue from the loaded tickets and renders the same presentational
 * `Dashboard`. The run is **user-triggered**: pressing Run (the Dashboard's `onRun`
 * control) streams each ticket through `POST /api/triage` (007), folding streamed
 * `PipelineEvent`s into the matching `TicketView` with `applyEvent`. Tickets run
 * sequentially so the queue visibly fills in. When the run finishes, the collected
 * decisions are POSTed to `/api/output`, which regenerates `support_tickets/output.csv`
 * — so the graded file is rewritten from each run rather than on every page load.
 * Pressing Run again re-seeds the queue and runs from scratch. `runner`/`persist` are
 * injectable for tests; production uses `streamTriage` / the fetch writer.
 */
export function LiveDashboard({
  tickets,
  runner = defaultRunner,
  persist = defaultPersist,
  initialTicketId,
}: {
  tickets: Ticket[];
  runner?: TriageRunner;
  persist?: Persist;
  /** Deep-link target (`/?ticket=N`) forwarded to the presentational Dashboard. */
  initialTicketId?: number;
}) {
  const [views, setViews] = useState<TicketView[]>(() => tickets.map(seedView));
  // Guards against re-entrant Run clicks while a run is already in flight.
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    // Re-seed so a re-run starts from a clean, fully-queued board.
    setViews(tickets.map(seedView));
    const results: RunResult[] = [];

    try {
      for (const ticket of tickets) {
        try {
          await runner(ticket, (event) => {
            if ("decision" in event) results.push({ ticket, decision: event.decision });
            setViews((prev) =>
              prev.map((v) => (v.id === ticket.id ? applyEvent(v, event) : v)),
            );
          });
        } catch {
          // A failed ticket stays in its current state; continue down the queue.
        }
      }
      // Regenerate output.csv from this run (best-effort).
      if (results.length > 0) await persist(results);
    } finally {
      running.current = false;
    }
  }, [tickets, runner, persist]);

  return <Dashboard tickets={views} initialTicketId={initialTicketId} onRun={run} />;
}
