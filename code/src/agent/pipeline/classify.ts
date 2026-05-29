/**
 * Classify step (005): determine `request_type` + `product_area` for a ticket.
 *
 * Two layers:
 *  1. Deterministic safety heuristics run FIRST and can short-circuit without the LLM —
 *     prompt-injection and courtesy-only messages. We do not trust the model to refuse
 *     an injection (D11 layer 2); detecting it in code is the hard backstop.
 *  2. Otherwise the LLM classifies (open-set product_area), and we reconcile its pick
 *     with the top retrieved source category via a HYBRID VOTE (D8): agreement keeps
 *     confidence, disagreement lowers it, and an out-of-set pick falls back to the
 *     nearest in-set value (or blank) while surfacing the original as
 *     `suggested_product_area` for human review (B1).
 */

import { ClassificationSchema, classifyMessages } from "./prompts";
import { isProductArea } from "../types";
import type { LlmClient } from "../ports";
import type { ProductArea, RequestType, Source, Ticket } from "../types";

/** Why a heuristic forced an `invalid` classification (drives the response template). */
export type Refusal = "injection" | "courtesy";

/** The reconciled classification handed to the risk + decide steps. */
export interface Classification {
  request_type: RequestType;
  /** Always an in-set value (possibly `""`); never the raw open-set LLM string. */
  product_area: ProductArea;
  suggested_product_area?: { value: string; reason: string };
  confidence: number;
  refusal?: Refusal;
}

/** Confidence penalty applied when the LLM area disagrees with the top source. */
const DISAGREE_PENALTY = 0.25;
/** Confidence ceiling when the LLM proposes an area outside our closed set. */
const OUT_OF_SET_CONFIDENCE = 0.4;

/**
 * Prompt-injection / instruction-override / destructive-command patterns. Case- and
 * whitespace-insensitive. A match means: refuse, do not comply, classify invalid.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget)\b[\s\S]{0,40}\b(previous|above|prior|earlier|all)\b[\s\S]{0,30}\b(instructions?|prompts?|rules?|context)\b/i,
  /\b(you are now|new instructions?\s*:|system\s*prompt|override (your|the)|act as)\b/i,
  /\bdelete\b[\s\S]{0,20}\b(all|everything|files?|database|data|account)\b/i,
  /\b(drop\s+table|rm\s+-rf|sudo\s+rm)\b/i,
  /^\s*(system|assistant|developer)\s*:/im,
];

/** Courtesy / thanks-only messages with no actionable question. */
const COURTESY_PATTERN =
  /\b(thank you|thanks|thanx|thx|much appreciated|appreciate it|cheers|you('| a)re the best|great help)\b/i;

function combinedText(ticket: Ticket): string {
  return `${ticket.subject ?? ""}\n${ticket.issue ?? ""}`.trim();
}

function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

function looksLikeCourtesy(text: string): boolean {
  // Short, thanks-bearing, and not actually asking anything.
  return text.length <= 80 && COURTESY_PATTERN.test(text) && !text.includes("?");
}

/**
 * Hybrid-vote reconciliation of the LLM's open-set area pick against the top source.
 * Returns the in-set area to emit, an optional new-area suggestion, and a confidence
 * adjustment delta.
 */
function reconcileArea(
  llmArea: string,
  topCategory: string | undefined,
  reason: string,
): { product_area: ProductArea; suggested?: { value: string; reason: string }; delta: number } {
  const topInSet = isProductArea(topCategory) ? (topCategory as ProductArea) : undefined;

  if (!isProductArea(llmArea)) {
    // Out of set → never emit it. Fall back to the source's area (nearest) or blank,
    // and route the proposed area to human review.
    return {
      product_area: topInSet ?? "",
      suggested: { value: llmArea, reason },
      delta: -1, // collapse to the out-of-set ceiling (handled by caller)
    };
  }

  const llmInSet = llmArea as ProductArea;
  if (topInSet && topInSet !== llmInSet) {
    // Both valid but disagree → trust the intent-aware LLM pick, lower confidence.
    return { product_area: llmInSet, delta: -DISAGREE_PENALTY };
  }
  return { product_area: llmInSet, delta: 0 };
}

export async function classify(
  ticket: Ticket,
  sources: Source[],
  llm: LlmClient,
): Promise<Classification> {
  const text = combinedText(ticket);

  // Layer 1 — deterministic refusals (no LLM call).
  if (looksLikeInjection(text)) {
    return {
      request_type: "invalid",
      product_area: "conversation_management",
      confidence: 0.95,
      refusal: "injection",
    };
  }
  if (looksLikeCourtesy(text)) {
    return {
      request_type: "invalid",
      product_area: "conversation_management",
      confidence: 0.9,
      refusal: "courtesy",
    };
  }

  // Layer 2 — LLM classification + hybrid-vote reconciliation.
  const out = await llm.chatJson<{
    request_type: RequestType;
    product_area: string;
    suggested_product_area?: { value: string; reason: string };
    confidence: number;
  }>(ClassificationSchema, classifyMessages(ticket, sources));

  const baseConfidence = clamp01(out.confidence ?? 0.5);

  // Invalid (trivia / chit-chat / meta) → meta area, no source reconciliation.
  if (out.request_type === "invalid") {
    return {
      request_type: "invalid",
      product_area: "conversation_management",
      confidence: baseConfidence,
    };
  }

  const topCategory = sources[0]?.category as string | undefined;
  const reconciled = reconcileArea(
    out.product_area,
    topCategory,
    out.suggested_product_area?.reason ?? "LLM proposed an area outside the closed set",
  );

  const confidence =
    reconciled.delta === -1
      ? Math.min(baseConfidence, OUT_OF_SET_CONFIDENCE)
      : clamp01(baseConfidence + reconciled.delta);

  return {
    request_type: out.request_type,
    product_area: reconciled.product_area,
    suggested_product_area: reconciled.suggested ?? out.suggested_product_area,
    confidence,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
