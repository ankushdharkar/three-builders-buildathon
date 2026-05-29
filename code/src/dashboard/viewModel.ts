/**
 * UI view-model types for the Triage Console.
 *
 * The headless agent contract (`src/agent/types.ts`) models a `Ticket` as pure input
 * and a `Decision` as the agent's output. The console additionally needs per-ticket
 * queue/render state — which stage is running, whether sources are already retrieved
 * before a decision exists, etc. Those concerns live here so the agent core stays
 * React/UI-free. A `TicketView` is the agent `Ticket` plus everything the dashboard
 * renders, so mock data and live-agent data render through the same components.
 */

import type { Decision, ProductArea, Source, Stage, Ticket } from "../agent/types";

/** Per-ticket lifecycle state shown in the queue. */
export type QueueState =
  | "queued"
  | "processing"
  | "replied"
  | "escalated"
  | "invalid";

/** Overall run state shown in the header (D9 auto-run; controls pending T1/B2). */
export type RunState = "IDLE" | "RUNNING" | "PAUSED" | "DONE";

/** Render status of a single pipeline step in the right rail. */
export type StepStatus = "pending" | "running" | "done" | "error";

export interface PipelineStep {
  stage: Stage;
  status: StepStatus;
  /** Human-readable detail, e.g. "120ms", "LOW", "0.4s". */
  detail?: string;
}

/** A core ticket plus everything the console renders for it. */
export interface TicketView {
  id: number;
  subject: string;
  company: Ticket["company"];
  issue: string;
  state: QueueState;
  /** Present once triaged; `decision.sources` mirrors `sources` below. */
  decision?: Decision;
  /** Retrieved sources, available even while still processing (before a decision). */
  sources: Source[];
  pipeline: PipelineStep[];
}

/**
 * The full corpus article behind a retrieved `Source`, shown in the Source detail
 * drawer (D12). The drawer proves grounding, so it needs the article `body` plus the
 * cited `snippet` to highlight. Mock-resolved today (`mockDocs.ts`); swaps to the real
 * corpus loader (`CorpusDoc`) once retrieval is wired live — same shape, drop-in.
 */
export interface SourceDoc {
  articleId: string;
  title: string;
  category: ProductArea | string;
  url?: string;
  body: string;
  snippet?: string;
}
