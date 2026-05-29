/**
 * Pipeline orchestrator (005): implements the `Pipeline` port via `createPipeline`.
 *
 * `run(ticket)` streams `PipelineEvent`s through the five stages —
 * retrieve → classify → risk → decide → respond — emitting a `start`/`done` pair per
 * stage, the retrieved `sources`, the response as `tokenDelta` chunks, and a closing
 * `final` event carrying the assembled `Decision`. The retriever and LLM client are
 * INJECTED (the container passes the real ones; tests pass fakes/stubs), so this module
 * never imports 003/004's network paths directly.
 *
 * Status: the stages are already separate, deterministic units (classify/risk/decide/
 * respond) emitting per-stage events, and the D8 hybrid vote lives in `classify.ts`.
 * What's deferred is per-stage *LLM* reconciliation (e.g. a dedicated risk LLM and a
 * confidence-reconciliation pass) beyond the current single classify + single respond
 * structured calls.
 */

// TODO(post-sprint): split into multi-step pipeline w/ per-stage events + hybrid vote

import { classify } from "./classify";
import { decide } from "./decide";
import { respond } from "./respond";
import { assessRisk } from "./risk";
import type { LlmClient, Pipeline, Retriever } from "../ports";
import type { Decision, PipelineEvent, Source, Ticket } from "../types";

/** How many corpus articles to retrieve per ticket. */
const RETRIEVE_K = 5;
/** Token-delta chunk size for the streamed response (UI cosmetics, deterministic). */
const CHUNK_SIZE = 24;

function chunkText(text: string, size = CHUNK_SIZE): string[] {
  if (text.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/** A retrieval query that favors the (often cleaner) issue body over a noisy subject. */
function buildQuery(ticket: Ticket): string {
  return [ticket.issue, ticket.subject].filter(Boolean).join("\n").trim();
}

function buildJustification(
  reasons: string[],
  signals: string[],
  cited: string[],
  suggested?: { value: string; reason: string },
): string {
  const parts: string[] = [];
  parts.push(reasons.join("; ") || "routine triage");
  if (signals.length > 0) parts.push(`risk signals: ${signals.join(", ")}`);
  if (cited.length > 0) parts.push(`grounded in ${cited.map((id) => `[src:${id}]`).join(", ")}`);
  if (suggested) parts.push(`suggested new area: "${suggested.value}" (${suggested.reason})`);
  return parts.join(". ") + ".";
}

export function createPipeline({ retrieve, llm }: { retrieve: Retriever; llm: LlmClient }): Pipeline {
  return {
    async *run(ticket: Ticket): AsyncIterable<PipelineEvent> {
      try {
        // ── retrieve ──────────────────────────────────────────────────────────────
        yield { stage: "retrieve", status: "start" };
        let sources: Source[] = [];
        try {
          sources = await retrieve.retrieve(buildQuery(ticket), { k: RETRIEVE_K });
        } catch (err) {
          yield { stage: "retrieve", status: "error", error: errMsg(err) };
        }
        yield { stage: "retrieve", sources };
        yield { stage: "retrieve", status: "done" };

        // ── classify ──────────────────────────────────────────────────────────────
        yield { stage: "classify", status: "start" };
        const classification = await classify(ticket, sources, llm);
        yield { stage: "classify", status: "done" };

        // ── risk ──────────────────────────────────────────────────────────────────
        yield { stage: "risk", status: "start" };
        const assessment = assessRisk(ticket);
        yield { stage: "risk", status: "done" };

        // ── decide ──────────────────────────────────────────────────────────────────
        yield { stage: "decide", status: "start" };
        const routing = decide(ticket, classification, assessment, sources);
        yield { stage: "decide", status: "done" };

        // ── respond ─────────────────────────────────────────────────────────────────
        yield { stage: "respond", status: "start" };
        const { response, cited } = await respond(
          { ticket, classification, assessment, routing, sources },
          llm,
        );
        for (const tokenDelta of chunkText(response)) {
          yield { stage: "respond", tokenDelta };
        }
        yield { stage: "respond", status: "done" };

        const decision: Decision = {
          status: routing.status,
          request_type: routing.request_type,
          product_area: classification.product_area,
          response,
          justification: buildJustification(
            routing.reasons,
            assessment.signals,
            cited,
            classification.suggested_product_area,
          ),
          risk: assessment.risk,
          confidence: routing.confidence,
          needs_review: routing.needs_review || undefined,
          suggested_product_area: classification.suggested_product_area,
          sources,
        };
        yield { stage: "final", decision };
      } catch (err) {
        // Fail safe: surface the error and emit a conservative escalation decision so a
        // consumer always gets a terminal `final` event rather than a thrown stream.
        yield { stage: "decide", status: "error", error: errMsg(err) };
        yield { stage: "final", decision: failSafeDecision(errMsg(err)) };
      }
    },
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function failSafeDecision(error: string): Decision {
  return {
    status: "escalated",
    request_type: "invalid",
    product_area: "",
    response:
      "Thanks for reaching out. I hit an unexpected problem triaging this, so I've routed it to a HackerRank specialist to follow up.",
    justification: `Pipeline error — escalated for human handling: ${error}`,
    risk: "HIGH",
    confidence: 0,
    needs_review: true,
    sources: [],
  };
}
