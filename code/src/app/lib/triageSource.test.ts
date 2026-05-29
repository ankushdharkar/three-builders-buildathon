import { describe, expect, it } from "vitest";

import type { Decision, PipelineEvent, Ticket } from "../../agent/types";
import { applyEvent, finalState, seedView } from "./triageSource";

const ticket: Ticket = {
  id: 3,
  issue: "How long do tests stay active?",
  subject: "Test expiry",
  company: "HackerRank",
};

const decision = (over: Partial<Decision> = {}): Decision => ({
  status: "replied",
  request_type: "product_issue",
  product_area: "screen",
  response: "Tests stay active until you set an end date.",
  justification: "Corpus documents test expiry.",
  risk: "LOW",
  confidence: 0.9,
  sources: [{ articleId: "screen/x", title: "Test settings", category: "screen", score: 0.9 }],
  ...over,
});

describe("seedView", () => {
  it("produces a queued view with all five pipeline steps pending and no decision", () => {
    const v = seedView(ticket);
    expect(v).toMatchObject({ id: 3, subject: "Test expiry", state: "queued", sources: [] });
    expect(v.decision).toBeUndefined();
    expect(v.pipeline.map((s) => s.stage)).toEqual(["retrieve", "classify", "risk", "decide", "respond"]);
    expect(v.pipeline.every((s) => s.status === "pending")).toBe(true);
  });
});

describe("finalState", () => {
  it("maps escalated → escalated (even when invalid)", () => {
    expect(finalState(decision({ status: "escalated", request_type: "invalid" }))).toBe("escalated");
  });
  it("maps replied+invalid → invalid", () => {
    expect(finalState(decision({ status: "replied", request_type: "invalid" }))).toBe("invalid");
  });
  it("maps replied+product_issue → replied", () => {
    expect(finalState(decision())).toBe("replied");
  });
});

describe("applyEvent", () => {
  it("marks a stage running on start and sets state processing", () => {
    const v = applyEvent(seedView(ticket), { stage: "retrieve", status: "start" });
    expect(v.state).toBe("processing");
    expect(v.pipeline.find((s) => s.stage === "retrieve")!.status).toBe("running");
  });

  it("fills the sources rail on a retrieve event", () => {
    const v = applyEvent(seedView(ticket), {
      stage: "retrieve",
      sources: [{ articleId: "a", title: "A", category: "screen", score: 0.8 }],
    });
    expect(v.sources).toHaveLength(1);
    expect(v.sources[0].articleId).toBe("a");
  });

  it("marks a stage done with a ms detail", () => {
    const v = applyEvent(seedView(ticket), { stage: "classify", status: "done", ms: 120 });
    const step = v.pipeline.find((s) => s.stage === "classify")!;
    expect(step.status).toBe("done");
    expect(step.detail).toBe("120ms");
  });

  it("sets the decision + queue state + sources on the final event", () => {
    const v = applyEvent(seedView(ticket), { stage: "final", decision: decision() });
    expect(v.decision?.response).toMatch(/Tests stay active/);
    expect(v.state).toBe("replied");
    expect(v.sources[0].articleId).toBe("screen/x");
  });

  it("ignores respond token deltas (final carries the full response)", () => {
    const before = seedView(ticket);
    const after = applyEvent(before, { stage: "respond", tokenDelta: "partial..." } as PipelineEvent);
    expect(after).toEqual(before);
  });
});
