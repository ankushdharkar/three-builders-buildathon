import { describe, expect, it, vi } from "vitest";

import type { PipelineEvent, Ticket } from "../../agent/types";
import { streamTriage } from "./triageClient";

const TICKET: Ticket = {
  id: 1,
  issue: "CodePair link is not loading for my candidate.",
  subject: "CodePair",
  company: "HackerRank",
};

const EVENTS: PipelineEvent[] = [
  { stage: "retrieve", status: "start" },
  {
    stage: "retrieve",
    sources: [
      { articleId: "interviews/codepair", title: "CodePair", category: "interviews", score: 0.7 },
    ],
  },
  { stage: "respond", tokenDelta: "Try " },
  { stage: "respond", tokenDelta: "this." },
  {
    stage: "final",
    decision: {
      status: "replied",
      request_type: "product_issue",
      product_area: "interviews",
      response: "Try this.",
      justification: "From the CodePair article.",
      risk: "LOW",
      confidence: 0.6,
      sources: [],
    },
  },
];

/** A ReadableStream that emits the given string chunks then closes. */
function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

/** Serialize events to NDJSON, then re-slice into arbitrary chunks (split mid-line). */
function ndjsonChunks(events: PipelineEvent[], chunkSize: number): string[] {
  const text = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function fakeFetch(stream: ReadableStream<Uint8Array>, status = 200) {
  return vi.fn(async () => new Response(stream, { status }));
}

describe("streamTriage", () => {
  it("parses NDJSON split across arbitrary chunk boundaries into typed events", async () => {
    // 7-char chunks guarantee lines are split mid-JSON, exercising buffering.
    const stream = streamFromChunks(ndjsonChunks(EVENTS, 7));
    const received: PipelineEvent[] = [];

    await streamTriage(TICKET, (e) => received.push(e), { fetchImpl: fakeFetch(stream) });

    expect(received).toEqual(EVENTS);
  });

  it("parses a final line that has no trailing newline", async () => {
    const text = EVENTS.map((e) => JSON.stringify(e)).join("\n"); // no trailing \n
    const stream = streamFromChunks([text]);
    const received: PipelineEvent[] = [];

    await streamTriage(TICKET, (e) => received.push(e), { fetchImpl: fakeFetch(stream) });

    expect(received).toEqual(EVENTS);
  });

  it("invokes onEvent incrementally as lines arrive (one event per chunk)", async () => {
    const chunks = EVENTS.map((e) => JSON.stringify(e) + "\n");
    const stream = streamFromChunks(chunks);
    const seen: PipelineEvent[] = [];

    await streamTriage(TICKET, (e) => seen.push(e), { fetchImpl: fakeFetch(stream) });

    expect(seen.map((e) => e.stage)).toEqual([
      "retrieve",
      "retrieve",
      "respond",
      "respond",
      "final",
    ]);
  });

  it("POSTs the ticket as JSON to /api/triage", async () => {
    const stream = streamFromChunks(ndjsonChunks(EVENTS, 64));
    const fetchImpl = fakeFetch(stream);

    await streamTriage(TICKET, () => {}, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/triage");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ ticket: TICKET });
  });

  it("honours a custom endpoint", async () => {
    const stream = streamFromChunks(ndjsonChunks(EVENTS, 64));
    const fetchImpl = fakeFetch(stream);

    await streamTriage(TICKET, () => {}, { fetchImpl, endpoint: "/custom/triage" });

    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("/custom/triage");
  });

  it("throws on a non-OK response", async () => {
    const stream = streamFromChunks([""]);
    await expect(
      streamTriage(TICKET, () => {}, { fetchImpl: fakeFetch(stream, 500) }),
    ).rejects.toThrow(/500/);
  });
});
