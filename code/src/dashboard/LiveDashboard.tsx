"use client";

import { useEffect, useRef, useState } from "react";

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
 * Seeds the queue from the loaded tickets, runs each through `POST /api/triage` (007),
 * folding streamed `PipelineEvent`s into the matching `TicketView` with `applyEvent`,
 * and renders the same presentational `Dashboard`. Tickets run sequentially so the
 * queue visibly fills in (D9 auto-run). When the run finishes, the collected decisions
 * are POSTed to `/api/output`, which regenerates `support_tickets/output.csv` — so a
 * fresh UI start always rewrites the graded file from that run. `runner`/`persist` are
 * injectable for tests; production uses `streamTriage` / the fetch writer.
 */
export function LiveDashboard({
  tickets,
  runner = defaultRunner,
  persist = defaultPersist,
}: {
  tickets: Ticket[];
  runner?: TriageRunner;
  persist?: Persist;
}) {
  const [views, setViews] = useState<TicketView[]>(() => tickets.map(seedView));
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // run the queue exactly once
    started.current = true;
    let cancelled = false;
    const results: RunResult[] = [];

    void (async () => {
      for (const ticket of tickets) {
        if (cancelled) return;
        try {
          await runner(ticket, (event) => {
            if (cancelled) return;
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
      if (!cancelled && results.length > 0) await persist(results);
    })();

    return () => {
      cancelled = true;
    };
  }, [tickets, runner, persist]);

  return <Dashboard tickets={views} />;
}
