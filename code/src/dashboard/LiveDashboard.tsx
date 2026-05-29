"use client";

import { useEffect, useRef, useState } from "react";

import type { PipelineEvent, Ticket } from "../agent/types";
import { applyEvent, seedView } from "../app/lib/triageSource";
import { streamTriage } from "../app/lib/triageClient";
import { Dashboard } from "./Dashboard";
import type { TicketView } from "./viewModel";

/** Drives one ticket through the live endpoint, emitting each streamed event. */
export type TriageRunner = (
  ticket: Ticket,
  onEvent: (event: PipelineEvent) => void,
) => Promise<void>;

const defaultRunner: TriageRunner = (ticket, onEvent) => streamTriage(ticket, onEvent);

/**
 * Client wrapper that drives the Triage Console from the live agent (build prompt 008).
 * Seeds the queue from the loaded tickets, then runs each through `POST /api/triage`
 * (007), folding streamed `PipelineEvent`s into the matching `TicketView` with
 * `applyEvent`, and renders the same presentational `Dashboard`. Tickets are processed
 * sequentially so the queue visibly fills in (D9 auto-run). `runner` is injectable for
 * tests; production uses `streamTriage`.
 */
export function LiveDashboard({
  tickets,
  runner = defaultRunner,
}: {
  tickets: Ticket[];
  runner?: TriageRunner;
}) {
  const [views, setViews] = useState<TicketView[]>(() => tickets.map(seedView));
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // run the queue exactly once
    started.current = true;
    let cancelled = false;

    void (async () => {
      for (const ticket of tickets) {
        if (cancelled) return;
        try {
          await runner(ticket, (event) => {
            if (cancelled) return;
            setViews((prev) =>
              prev.map((v) => (v.id === ticket.id ? applyEvent(v, event) : v)),
            );
          });
        } catch {
          // A failed ticket stays in its current state; continue down the queue.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tickets, runner]);

  return <Dashboard tickets={views} />;
}
