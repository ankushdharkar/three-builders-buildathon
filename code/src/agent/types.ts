/**
 * Shared domain types for the support-triage agent and its UI.
 *
 * These mirror the output contract in `CLAUDE.md` §1 (the five graded columns) plus
 * the extra signals the Triage Console renders (sources, pipeline, confidence/risk).
 * They live in the headless agent core so the batch CLI, the live agent, and the UI
 * all speak one vocabulary. The mock data layer produces values of exactly these
 * types, so swapping mock → live agent later is a drop-in change.
 */

/** Graded enum: final routing decision for a ticket (`AGENTS.md` / spec). */
export type TicketStatus = "replied" | "escalated";

/** Graded enum: the kind of request a ticket represents. */
export type RequestType = "product_issue" | "feature_request" | "bug" | "invalid";

/**
 * Corpus-native `product_area` closed set (D8) plus the meta/out-of-scope value and
 * the empty (no-area) escalation case. Never invent a value outside this union; a
 * detected new area surfaces via `Decision.suggestedProductArea` instead.
 */
export type ProductArea =
  | "screen"
  | "interviews"
  | "chakra"
  | "library"
  | "integrations"
  | "settings"
  | "engage"
  | "skillup"
  | "community"
  | "general-help"
  | "conversation_management"
  | "";

/** Risk band from the risk-check pipeline step; gates escalation (guardrails). */
export type RiskLevel = "LOW" | "MED" | "HIGH";

/** Per-ticket lifecycle state as it moves through the queue/pipeline. */
export type QueueState =
  | "queued"
  | "processing"
  | "replied"
  | "escalated"
  | "invalid";

/** Overall run state shown in the header (D9 auto-run; controls pending T1). */
export type RunState = "IDLE" | "RUNNING" | "PAUSED" | "DONE";

/** Stages of the triage pipeline, in order, shown in the right rail. */
export type PipelineStage =
  | "retrieve"
  | "classify"
  | "risk"
  | "decide"
  | "generate";

export type PipelineStepStatus = "pending" | "running" | "done" | "error";

export interface PipelineStep {
  stage: PipelineStage;
  status: PipelineStepStatus;
  /** Human-readable detail, e.g. "120ms", "LOW", "0.4s". */
  detail?: string;
}

/** A retrieved corpus article backing the decision (grounding evidence). */
export interface RetrievedSource {
  id: string;
  title: string;
  /** Fused relevance score in [0, 1]. */
  score: number;
  /** Top-level corpus category this article belongs to. */
  category: ProductArea;
}

/** The agent's decision for a ticket — the five graded columns + UI signals. */
export interface Decision {
  status: TicketStatus;
  requestType: RequestType;
  productArea: ProductArea;
  /** User-facing answer, grounded in the corpus (free-form). */
  response: string;
  /** Concise, corpus-traceable explanation of the decision (free-form). */
  justification: string;
  /** Model confidence in [0, 1]; gates human review (B1). */
  confidence: number;
  risk: RiskLevel;
  /** Open-set hook (D8/B1): a detected new area routed to human review. */
  suggestedProductArea?: { value: string; reason: string };
}

/** One support ticket plus everything the console needs to render it. */
export interface Ticket {
  id: number;
  subject: string;
  company: "HackerRank" | "None";
  issue: string;
  state: QueueState;
  /** Present once the ticket has been triaged (queued/processing → undefined). */
  decision?: Decision;
  sources: RetrievedSource[];
  pipeline: PipelineStep[];
}
