import { describe, expect, it } from "vitest";

import type { Source, Ticket } from "../types";
import type { LlmClient } from "../ports";
import type { Classification } from "./classify";
import type { RiskAssessment } from "./risk";
import type { Routing } from "./decide";
import { respond } from "./respond";

function stubLlm(json: unknown): LlmClient {
  return {
    async chatJson<T>(): Promise<T> {
      return json as T;
    },
    async *chatStream(): AsyncIterable<string> {
      return;
    },
  };
}

const exploding: LlmClient = {
  async chatJson<T>(): Promise<T> {
    throw new Error("LLM should not be called for a templated response");
  },
  async *chatStream(): AsyncIterable<string> {
    throw new Error("LLM should not be called for a templated response");
  },
};

const ticket: Ticket = { id: 1, issue: "My system check fails", subject: "", company: "HackerRank" };
const classification: Classification = {
  request_type: "product_issue",
  product_area: "screen",
  confidence: 0.8,
};
const assessment: RiskAssessment = { risk: "LOW", signals: [] };
const SOURCES: Source[] = [
  { articleId: "screen/system-check", title: "Run the System Check", category: "screen", score: 0.9 },
];

function routing(over: Partial<Routing>): Routing {
  return {
    status: "replied",
    request_type: "product_issue",
    responseKind: "answer",
    needs_review: false,
    confidence: 0.8,
    reasons: [],
    ...over,
  };
}

describe("respond", () => {
  it("returns a grounded answer that cites the provided source ids", async () => {
    const out = await respond(
      { ticket, classification, assessment, routing: routing({}), sources: SOURCES },
      stubLlm({ response: "Open the System Check from your dashboard and follow the prompts." }),
    );
    expect(out.response).toMatch(/System Check/);
    expect(out.cited).toEqual(["screen/system-check"]);
    // Every cited id must come from the provided sources — no fabricated citations.
    for (const id of out.cited) {
      expect(SOURCES.map((s) => s.articleId)).toContain(id);
    }
  });

  it("returns an escalation message without calling the LLM and cites nothing", async () => {
    const out = await respond(
      {
        ticket,
        classification,
        assessment: { risk: "HIGH", signals: ["refund"] },
        routing: routing({ status: "escalated", responseKind: "escalation" }),
        sources: SOURCES,
      },
      exploding,
    );
    expect(out.response).toMatch(/escalat|specialist|team/i);
    expect(out.cited).toEqual([]);
    // Templated paths must not smuggle in un-sourced corpus claims.
    expect(out.response).not.toContain(SOURCES[0].title);
  });

  it("returns a brief scope decline for trivia, no LLM call", async () => {
    const out = await respond(
      {
        ticket,
        classification: { ...classification, request_type: "invalid" },
        assessment,
        routing: routing({ request_type: "invalid", responseKind: "decline_trivia" }),
        sources: [],
      },
      exploding,
    );
    expect(out.response).toMatch(/HackerRank/i);
    expect(out.cited).toEqual([]);
  });

  it("refuses prompt-injection without complying or calling the LLM", async () => {
    const out = await respond(
      {
        ticket,
        classification: { ...classification, request_type: "invalid", refusal: "injection" },
        assessment,
        routing: routing({ request_type: "invalid", responseKind: "refuse_injection", needs_review: true }),
        sources: [],
      },
      exploding,
    );
    expect(out.response).toMatch(/can('|no)t|unable|only (help|assist)/i);
    expect(out.cited).toEqual([]);
  });
});
