/**
 * Live data source for the Triage Console (build prompt 008 — UI↔backend integration).
 *
 * The Console renders `TicketView`s. These pure helpers (a) seed a queued view from a
 * core `Ticket` and (b) fold streamed `PipelineEvent`s (from `POST /api/triage`, 007)
 * into that view, so the same Dashboard components render live-agent data exactly as
 * they rendered mock data. No env flag: the home page always drives from the live API,
 * which itself returns the fake pipeline until the server's `REAL_*` flags are on — so
 * the UI always renders something sensible.
 */

import type { Decision, PipelineEvent, Stage } from "../../agent/types";
import type { Ticket } from "../../agent/types";
import type { QueueState, StepStatus, TicketView } from "../../dashboard/viewModel";

const STAGES: Stage[] = ["retrieve", "classify", "risk", "decide", "respond"];

/** A fresh, queued view for a ticket — all pipeline steps pending, no decision yet. */
export function seedView(ticket: Ticket): TicketView {
  return {
    id: ticket.id,
    subject: ticket.subject,
    company: ticket.company,
    issue: ticket.issue,
    state: "queued",
    sources: [],
    pipeline: STAGES.map((stage) => ({ stage, status: "pending" as StepStatus })),
  };
}

/** Queue badge state implied by a final decision. */
export function finalState(d: Decision): QueueState {
  if (d.status === "escalated") return "escalated";
  if (d.request_type === "invalid") return "invalid";
  return "replied";
}

/**
 * Pure reducer: fold one streamed `PipelineEvent` into a `TicketView`, returning a new
 * view. Lifecycle events advance the pipeline stepper; the `retrieve` event fills the
 * sources rail; the `final` event sets the decision + queue state. `respond` token
 * deltas are ignored here (the final decision carries the full response text).
 */
export function applyEvent(view: TicketView, event: PipelineEvent): TicketView {
  if ("decision" in event) {
    const d = event.decision;
    return {
      ...view,
      decision: d,
      sources: d.sources?.length ? d.sources : view.sources,
      state: finalState(d),
      // close out any step still marked running
      pipeline: view.pipeline.map((s) =>
        s.status === "running" ? { ...s, status: "done" as StepStatus } : s,
      ),
    };
  }
  if ("sources" in event) {
    return { ...view, state: "processing", sources: event.sources };
  }
  if ("tokenDelta" in event) {
    return view;
  }
  if ("status" in event) {
    const status: StepStatus =
      event.status === "start" ? "running" : event.status === "done" ? "done" : "error";
    const detail =
      event.status === "done" && event.ms != null
        ? `${event.ms}ms`
        : event.status === "error"
          ? "error"
          : undefined;
    return {
      ...view,
      state: "processing",
      pipeline: view.pipeline.map((s) =>
        s.stage === event.stage ? { stage: s.stage, status, detail: detail ?? s.detail } : s,
      ),
    };
  }
  return view;
}
