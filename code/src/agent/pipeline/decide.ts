/**
 * Decide step (005): turn the classification + risk band + retrieval support into a
 * routing decision (status + how to respond), applying the escalation guardrails.
 *
 * This is a pure, deterministic function — given the same inputs it always routes the
 * same way, which is the auditable core of the agent. Guardrail order matters: hard
 * refusals first, then meta/out-of-scope, then the escalate-on-risk/uncertainty rules,
 * and finally the grounded-answer default.
 */

import { isProductArea } from "../types";
import type { Source, Status, Ticket } from "../types";
import type { Classification } from "./classify";
import type { RiskAssessment } from "./risk";

/** How `respond.ts` should phrase the reply. */
export type ResponseKind =
  | "answer"
  | "escalation"
  | "out_of_scope"
  | "decline_courtesy"
  | "decline_trivia"
  | "refuse_injection";

export interface Routing {
  status: Status;
  /** May be overridden vs the classification (e.g. an outage becomes a `bug`). */
  request_type: Classification["request_type"];
  responseKind: ResponseKind;
  needs_review: boolean;
  confidence: number;
  reasons: string[];
}

/**
 * Below this confidence we still REPLY (grounded) but flag the decision for human
 * review. (009: low confidence is deliberately NOT an escalation trigger — with
 * BM25-only retrieval, relevance/confidence scores are modest for ordinary answerable
 * FAQ tickets, and escalating those was the over-escalation bug. We escalate only on
 * genuine risk / out-of-corpus / new-area signals, not on a modest score.)
 */
const LOW_CONFIDENCE = 0.45;

export function decide(
  ticket: Ticket,
  classification: Classification,
  assessment: RiskAssessment,
  sources: Source[],
): Routing {
  const outOfScope = ticket.company === "None";
  const supported = sources.length > 0;
  const risky = assessment.risk === "HIGH";
  const c = classification;

  const base = { confidence: c.confidence, request_type: c.request_type };

  // 1. Hard refusals (deterministic, from classify heuristics).
  if (c.refusal === "injection") {
    return {
      ...base,
      status: "replied",
      request_type: "invalid",
      responseKind: "refuse_injection",
      needs_review: true,
      reasons: ["prompt-injection detected — refused, not executed"],
    };
  }
  if (c.refusal === "courtesy") {
    return {
      ...base,
      status: "replied",
      request_type: "invalid",
      responseKind: "decline_courtesy",
      needs_review: false,
      reasons: ["courtesy / thanks message"],
    };
  }

  // 2. Not an actionable request (trivia / chit-chat / meta). Reply, don't escalate,
  //    unless it somehow also tripped a high-risk signal.
  if (c.request_type === "invalid") {
    if (risky) return escalate(base, "invalid but high-risk");
    return {
      ...base,
      status: "replied",
      responseKind: outOfScope ? "out_of_scope" : "decline_trivia",
      needs_review: false,
      reasons: [outOfScope ? "out of scope for HackerRank support" : "not an actionable support request"],
    };
  }

  // 3. Full outage → it's a bug, and it's escalated.
  if (assessment.signals.includes("outage")) {
    return {
      ...base,
      status: "escalated",
      request_type: "bug",
      responseKind: "escalation",
      needs_review: false,
      reasons: ["platform outage reported"],
    };
  }

  // 4. High-risk (money / PII / account deletion / score dispute) → escalate.
  if (risky) return escalate(base, `high-risk: ${assessment.signals.join(", ")}`);

  // 5. A GENUINELY new product area (outside the closed set) → escalate + human review
  //    (D8 open-set / B1). The model sometimes fills `suggested_product_area` with a value
  //    that is ALREADY in our closed set (e.g. "screen"); that is not a new area, so it
  //    must NOT escalate (009 — was the over-escalation root cause for ordinary FAQs).
  if (c.suggested_product_area && !isProductArea(c.suggested_product_area.value)) {
    return {
      ...base,
      status: "escalated",
      responseKind: "escalation",
      needs_review: true,
      reasons: [`unrecognized product area "${c.suggested_product_area.value}" — needs review`],
    };
  }

  // 6. Nothing in the corpus supports an answer (genuinely out-of-corpus).
  if (!supported) {
    if (outOfScope) {
      return {
        ...base,
        status: "replied",
        responseKind: "out_of_scope",
        needs_review: false,
        reasons: ["out of scope and unsupported by the corpus"],
      };
    }
    return {
      ...base,
      status: "escalated",
      responseKind: "escalation",
      needs_review: true,
      reasons: ["no supporting corpus articles — cannot ground an answer"],
    };
  }

  // 7. Default — grounded answer. A modest confidence still replies, but is flagged
  //    for human review rather than escalated (009).
  const lowConfidence = c.confidence < LOW_CONFIDENCE;
  return {
    ...base,
    status: "replied",
    responseKind: "answer",
    needs_review: lowConfidence,
    reasons: [
      lowConfidence
        ? "supported, low-risk — grounded reply (low confidence, flagged for review)"
        : "supported, low-risk, confident — grounded reply",
    ],
  };
}

function escalate(
  base: { confidence: number; request_type: Classification["request_type"] },
  reason: string,
): Routing {
  return {
    ...base,
    status: "escalated",
    responseKind: "escalation",
    needs_review: false,
    reasons: [reason],
  };
}
