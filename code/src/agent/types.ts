/**
 * Canonical data contract for the support-triage agent.
 *
 * This is the single source of truth (build prompt 001 / `04-architecture.md`) that
 * the retrieval, LLM, pipeline, batch CLI, streaming API, and UI all import. Field
 * names on `Decision` are the snake_case graded output columns (`status`,
 * `request_type`, `product_area`, …) so the agent core and the output CSV speak one
 * vocabulary with no mapping layer in between.
 *
 * UI-only view-model types (queue state, run state, per-step render status) live in
 * `src/dashboard/viewModel.ts`, not here — this module stays headless and importable
 * from Node-only code with no React/Next dependency.
 */

/**
 * `product_area` closed set (D8). No spec enum exists for this column, so we emit
 * HackerRank's own corpus-native top-level categories, plus `conversation_management`
 * (out-of-scope / meta) and `''` (no-area escalation). Never emit a value outside
 * this set — a detected new area surfaces via `Decision.suggested_product_area` and
 * routes to human review (B1).
 */
export const PRODUCT_AREAS = [
  "screen",
  "interviews",
  "chakra",
  "library",
  "integrations",
  "settings",
  "engage",
  "skillup",
  "community",
  "general-help",
  "conversation_management",
  "",
] as const;

export type ProductArea = (typeof PRODUCT_AREAS)[number];

/** Runtime guard for the closed set — used when reconciling LLM/retrieval votes. */
export function isProductArea(value: unknown): value is ProductArea {
  return (
    typeof value === "string" &&
    (PRODUCT_AREAS as readonly string[]).includes(value)
  );
}

/** Graded enum: final routing decision. */
export type Status = "replied" | "escalated";

/** Graded enum: the kind of request a ticket represents. */
export type RequestType = "product_issue" | "feature_request" | "bug" | "invalid";

/** Risk band from the risk-check step; gates escalation (guardrails). */
export type Risk = "LOW" | "MED" | "HIGH";

/** One input ticket from `support_tickets.csv` (id is the 1-based row index). */
export interface Ticket {
  id: number;
  issue: string;
  subject: string;
  company: "HackerRank" | "None" | string;
  /** Present only for the sample set (expected-output columns), used in eval. */
  expected?: Partial<Decision>;
}

/** A retrieved corpus article backing the decision (grounding evidence). */
export interface Source {
  articleId: string;
  title: string;
  category: ProductArea | string;
  url?: string;
  /** Fused relevance score (RRF); higher is more relevant. */
  score: number;
  snippet?: string;
}

/** The agent's decision for a ticket — the five graded columns + agent signals. */
export interface Decision {
  status: Status;
  request_type: RequestType;
  product_area: ProductArea;
  /** User-facing answer, grounded in the corpus (free-form). */
  response: string;
  /** Concise, corpus-traceable explanation of the decision (free-form). */
  justification: string;
  risk: Risk;
  /** Model confidence in [0, 1]; gates human review (B1). */
  confidence: number;
  /** Open-set / uncertainty hook (B1): route to a human-review queue. */
  needs_review?: boolean;
  /** Open-set hook (D8/B1): a detected new area, never emitted as product_area. */
  suggested_product_area?: { value: string; reason: string };
  sources: Source[];
}

/** Triage pipeline stages, in execution order. */
export type Stage = "retrieve" | "classify" | "risk" | "decide" | "respond";

/**
 * A streaming event from the agent pipeline. Consumed by the API bridge (007) and
 * the live UI (008). Narrow by the presence of `sources` / `tokenDelta` / `decision`
 * (the `final` event) or fall through to the `{ status }` lifecycle event.
 */
export type PipelineEvent =
  | { stage: Stage; status: "start" | "done" | "error"; ms?: number; error?: string }
  | { stage: "retrieve"; sources: Source[] }
  | { stage: "respond"; tokenDelta: string }
  | { stage: "final"; decision: Decision };
