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

/**
 * Per-field result of the Layer-1 sanitizer (`sanitize.ts`, D11). Carried on a ticket
 * so downstream steps (risk/classify) and the UI can react to malicious input without
 * re-scanning. All booleans default false; `matched_rules` lists fired injection-rule
 * ids for transparency.
 */
export interface SafetyFlags {
  /** One or more prompt-injection heuristics fired. */
  injection_suspected: boolean;
  /** Ids of the injection rules that matched (see `INJECTION_RULES`). */
  matched_rules: string[];
  /** A secret-shaped token (API/Stripe key, credential assignment) was detected. */
  contains_secret: boolean;
  /** PII-shaped data (email, long digit run / card-like) was detected. */
  contains_pii: boolean;
  /** Zero-width / bidi / control chars were present (evasion or spoofing). */
  unicode_obfuscation: boolean;
  /** The field exceeded the length cap and was truncated. */
  truncated: boolean;
}

/** Aggregate + per-field safety verdict attached to a sanitized ticket. */
export interface TicketSafety {
  /** OR/union across the three fields — the ticket-level signal. */
  flags: SafetyFlags;
  fields: { issue: SafetyFlags; subject: SafetyFlags; company: SafetyFlags };
}

/**
 * Urgency band — how time-pressured / impactful the request is for the user. Modeled
 * separately from `risk` (D12): the problem statement asks the agent to assess urgency
 * AND risk. Urgency = user impact/deadline pressure; risk = sensitivity/blast-radius of
 * acting. A blocked candidate mid-assessment is high-urgency / low-risk; a bulk PII
 * deletion is low-urgency / high-risk. Used to sort the human-review queue (B1).
 */
export type Urgency = "LOW" | "MED" | "HIGH";

/**
 * One detected sub-request within a ticket (D12). A row may bundle multiple requests;
 * the agent still emits a single synthesized 5-column row, but records the decomposition
 * here so the UI can show that every intent was considered (not half-handled).
 */
export interface DetectedRequest {
  summary: string;
  request_type: RequestType;
  product_area: ProductArea;
}

/** One input ticket from `support_tickets.csv` (id is the 1-based row index). */
export interface Ticket {
  id: number;
  issue: string;
  subject: string;
  company: "HackerRank" | "None" | string;
  /** Present only for the sample set (expected-output columns), used in eval. */
  expected?: Partial<Decision>;
  /**
   * Sanitized field text (D11 Layer 1). The original `issue`/`subject`/`company` stay
   * verbatim for a faithful output-CSV echo; the pipeline MUST read from `clean` so no
   * raw attacker-controlled text reaches the prompt. Populated by `sanitizeTicket`.
   */
  clean?: { issue: string; subject: string; company: string };
  /** Malicious-input verdict from the sanitizer (D11). Populated by `sanitizeTicket`. */
  safety?: TicketSafety;
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
  /** Urgency band (D12): user impact / time-pressure, distinct from `risk`. Optional. */
  urgency?: Urgency;
  /** Detected sub-requests when a ticket bundles more than one ask (D12). Optional. */
  requests?: DetectedRequest[];
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
