import { describe, expect, it } from "vitest";

import { fakeRetriever } from "../fakes";
import type { LlmClient, Retriever } from "../ports";
import type { PipelineEvent, Source, Stage, Ticket } from "../types";
import { createPipeline } from "./run";

/** Stub LLM returning a single canned object that satisfies both classify + respond reads. */
function stubLlm(json: Record<string, unknown>): LlmClient {
  return {
    async chatJson<T>(): Promise<T> {
      return json as T;
    },
    async *chatStream(): AsyncIterable<string> {
      return;
    },
  };
}

async function collect(it: AsyncIterable<PipelineEvent>): Promise<PipelineEvent[]> {
  const out: PipelineEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

const ticket: Ticket = {
  id: 1,
  issue: "My HackerRank test won't load when I run the system check.",
  subject: "Test won't load",
  company: "HackerRank",
};

describe("createPipeline.run", () => {
  it("emits ordered stage events, retrieve sources, respond deltas, and a final decision", async () => {
    const llm = stubLlm({
      request_type: "product_issue",
      product_area: "screen",
      confidence: 0.8,
      response: "Run the System Check from your dashboard before starting the test.",
    });
    const pipeline = createPipeline({ retrieve: fakeRetriever, llm });
    const events = await collect(pipeline.run(ticket));

    // Lifecycle: start precedes done for every stage, in canonical order.
    const order: Stage[] = ["retrieve", "classify", "risk", "decide", "respond"];
    for (const stage of order) {
      const startIdx = events.findIndex((e) => "status" in e && e.stage === stage && e.status === "start");
      const doneIdx = events.findIndex((e) => "status" in e && e.stage === stage && e.status === "done");
      expect(startIdx, `${stage} start`).toBeGreaterThanOrEqual(0);
      expect(doneIdx, `${stage} done`).toBeGreaterThan(startIdx);
    }

    // retrieve event carries sources.
    const retrieveEvent = events.find((e) => e.stage === "retrieve" && "sources" in e) as
      | { sources: Source[] }
      | undefined;
    expect(retrieveEvent?.sources.length).toBeGreaterThan(0);

    // final decision present and well-formed.
    const final = events.at(-1);
    expect(final && final.stage).toBe("final");
    if (!final || final.stage !== "final") throw new Error("no final event");
    expect(final.decision.status).toBe("replied");
    expect(typeof final.decision.confidence).toBe("number");

    // respond deltas concatenate to the decision response.
    const deltas = events
      .filter((e) => e.stage === "respond" && "tokenDelta" in e)
      .map((e) => (e as { tokenDelta: string }).tokenDelta)
      .join("");
    expect(deltas).toBe(final.decision.response);
  });

  it("sets needs_review when the LLM picks an out-of-set area (new-area suggestion)", async () => {
    const llm = stubLlm({
      request_type: "product_issue",
      product_area: "billing",
      confidence: 0.8,
      response: "Here is some guidance.",
    });
    const pipeline = createPipeline({ retrieve: fakeRetriever, llm });
    const events = await collect(pipeline.run(ticket));
    const final = events.at(-1);
    if (!final || final.stage !== "final") throw new Error("no final event");
    expect(final.decision.needs_review).toBe(true);
    expect(final.decision.suggested_product_area?.value).toBe("billing");
  });

  it("sets needs_review on low confidence", async () => {
    const llm = stubLlm({
      request_type: "product_issue",
      product_area: "screen",
      confidence: 0.2,
      response: "Here is some guidance.",
    });
    const retrieve: Retriever = fakeRetriever;
    const pipeline = createPipeline({ retrieve, llm });
    const events = await collect(pipeline.run(ticket));
    const final = events.at(-1);
    if (!final || final.stage !== "final") throw new Error("no final event");
    expect(final.decision.needs_review).toBe(true);
  });
});
