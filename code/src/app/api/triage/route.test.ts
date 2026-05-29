import { afterEach, describe, expect, it } from "vitest";

import { fakeLlm, fakeRetriever } from "../../../agent/fakes";
import { createPipeline } from "../../../agent/pipeline/run";
import type { Pipeline } from "../../../agent/ports";
import type { PipelineEvent, Ticket } from "../../../agent/types";
import { POST, __pipeline } from "./route";

const original = __pipeline.provider;

afterEach(() => {
  __pipeline.provider = original;
});

const TICKET: Ticket = {
  id: 1,
  issue: "My HackerRank System Check fails on the webcam step.",
  subject: "System Check",
  company: "HackerRank",
};

/** A pipeline that yields a fixed, known event sequence. */
function scriptedPipeline(events: PipelineEvent[]): Pipeline {
  return {
    async *run(): AsyncIterable<PipelineEvent> {
      for (const e of events) yield e;
    },
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readLines(res: Response): Promise<PipelineEvent[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as PipelineEvent);
}

describe("POST /api/triage", () => {
  it("streams serialized PipelineEvents as NDJSON, in order, ending with final", async () => {
    const events: PipelineEvent[] = [
      { stage: "retrieve", status: "start" },
      {
        stage: "retrieve",
        sources: [
          { articleId: "screen/system-check", title: "System Check", category: "screen", score: 0.9 },
        ],
      },
      { stage: "retrieve", status: "done", ms: 10 },
      { stage: "respond", status: "start" },
      { stage: "respond", tokenDelta: "Hello " },
      { stage: "respond", tokenDelta: "there." },
      { stage: "respond", status: "done", ms: 5 },
      {
        stage: "final",
        decision: {
          status: "replied",
          request_type: "product_issue",
          product_area: "screen",
          response: "Hello there.",
          justification: "Grounded in the system-check article.",
          risk: "LOW",
          confidence: 0.8,
          sources: [],
        },
      },
    ];
    __pipeline.provider = async () => scriptedPipeline(events);

    const res = await POST(jsonRequest({ ticket: TICKET }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");

    const received = await readLines(res);
    expect(received).toEqual(events);
    expect(received[received.length - 1].stage).toBe("final");
  });

  it("works on the real pipeline orchestrator, ending with a final event", async () => {
    // The container wires the real pipeline, which needs API keys/network. To exercise
    // the route's default-provider path with no creds, inject the REAL pipeline
    // orchestrator wired with deterministic fakes (test-only injection).
    __pipeline.provider = async () =>
      createPipeline({ retrieve: fakeRetriever, llm: fakeLlm });

    const res = await POST(jsonRequest({ ticket: TICKET }));
    expect(res.status).toBe(200);
    const received = await readLines(res);
    expect(received.length).toBeGreaterThan(0);
    expect(received[received.length - 1].stage).toBe("final");
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await POST(jsonRequest("{not json"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when `ticket` is missing", async () => {
    const res = await POST(jsonRequest({ notTicket: true }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when `ticket` has no issue body", async () => {
    const res = await POST(jsonRequest({ ticket: { id: 2, subject: "x", company: "None" } }));
    expect(res.status).toBe(400);
  });
});
