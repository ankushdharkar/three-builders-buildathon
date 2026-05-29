import { describe, expect, it } from "vitest";
import { mockDecision, mockPipelineEvents } from "./mock";
import { isProductArea } from "./types";
import type { Decision, PipelineEvent, Source } from "./types";
import { loadSampleTickets } from "./tickets";

const samples = loadSampleTickets();

function finalOf(events: PipelineEvent[]): Decision {
  const last = events.at(-1);
  if (!last || last.stage !== "final") throw new Error("no final event");
  return last.decision;
}

describe("mockDecision", () => {
  it("returns a valid Decision for every sample ticket", () => {
    for (const t of samples) {
      const d = mockDecision(t);
      expect(d.status).toMatch(/^(replied|escalated)$/);
      expect(d.request_type).toMatch(
        /^(product_issue|feature_request|bug|invalid)$/,
      );
      expect(isProductArea(d.product_area)).toBe(true);
      expect(d.risk).toMatch(/^(LOW|MED|HIGH)$/);
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(d.sources)).toBe(true);
      expect(typeof d.response).toBe("string");
      expect(typeof d.justification).toBe("string");
    }
  });

  it("matches each sample ticket's expected status/request_type/product_area", () => {
    for (const t of samples) {
      const d = mockDecision(t);
      expect(d.status).toBe(t.expected?.status);
      expect(d.request_type).toBe(t.expected?.request_type);
      expect(d.product_area).toBe(t.expected?.product_area);
    }
  });

  it("is deterministic — same ticket yields an identical decision", () => {
    expect(mockDecision(samples[0])).toEqual(mockDecision(samples[0]));
  });
});

describe("mockPipelineEvents", () => {
  it("emits an ordered start/done per stage ending in a final decision", () => {
    const events = mockPipelineEvents(samples[0]);
    const stageStatus = events
      .filter((e): e is Extract<PipelineEvent, { status: string }> => "status" in e)
      .map((e) => `${e.stage}:${e.status}`);
    expect(stageStatus).toEqual([
      "retrieve:start",
      "retrieve:done",
      "classify:start",
      "classify:done",
      "risk:start",
      "risk:done",
      "decide:start",
      "decide:done",
      "respond:start",
      "respond:done",
    ]);
    expect(events.at(-1)).toMatchObject({ stage: "final" });
  });

  it("includes a retrieve event with at least one Source", () => {
    const events = mockPipelineEvents(samples[0]);
    const retrieve = events.find(
      (e): e is Extract<PipelineEvent, { sources: Source[] }> => "sources" in e,
    );
    expect(retrieve).toBeDefined();
    expect(retrieve!.sources.length).toBeGreaterThanOrEqual(1);
  });

  it("streams respond deltas that concatenate to the final response", () => {
    for (const t of samples) {
      const events = mockPipelineEvents(t);
      const streamed = events
        .filter((e): e is Extract<PipelineEvent, { tokenDelta: string }> => "tokenDelta" in e)
        .map((e) => e.tokenDelta)
        .join("");
      expect(streamed).toBe(finalOf(events).response);
    }
  });

  it("ends with a final decision equal to mockDecision(ticket)", () => {
    for (const t of samples) {
      expect(finalOf(mockPipelineEvents(t))).toEqual(mockDecision(t));
    }
  });
});
