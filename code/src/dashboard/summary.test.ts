import { describe, expect, it } from "vitest";
import { summarize } from "./summary";
import type { TicketView } from "./viewModel";

/** Minimal ticket factory — only the fields `summarize` reads. */
function ticket(id: number, state: TicketView["state"]): TicketView {
  return { id, subject: `s${id}`, company: "HackerRank", issue: "", state, sources: [], pipeline: [] };
}

describe("summarize", () => {
  it("counts each queue state and the total", () => {
    const s = summarize([
      ticket(1, "replied"),
      ticket(2, "replied"),
      ticket(3, "escalated"),
      ticket(4, "invalid"),
      ticket(5, "processing"),
      ticket(6, "queued"),
      ticket(7, "queued"),
    ]);
    expect(s.total).toBe(7);
    expect(s.replied).toBe(2);
    expect(s.escalated).toBe(1);
    expect(s.invalid).toBe(1);
    expect(s.processing).toBe(1);
    expect(s.queued).toBe(2);
  });

  it("counts replied/escalated/invalid as done, but not queued/processing", () => {
    const s = summarize([
      ticket(1, "replied"),
      ticket(2, "escalated"),
      ticket(3, "invalid"),
      ticket(4, "processing"),
      ticket(5, "queued"),
    ]);
    expect(s.done).toBe(3);
  });

  it("reports progress as a [0,1] fraction of done over total", () => {
    const s = summarize([
      ticket(1, "replied"),
      ticket(2, "replied"),
      ticket(3, "queued"),
      ticket(4, "queued"),
    ]);
    expect(s.progress).toBeCloseTo(0.5);
  });

  it("derives runState: DONE when all resolved, RUNNING while processing, IDLE when all queued", () => {
    expect(summarize([ticket(1, "replied"), ticket(2, "escalated")]).runState).toBe("DONE");
    expect(summarize([ticket(1, "replied"), ticket(2, "processing")]).runState).toBe("RUNNING");
    expect(summarize([ticket(1, "queued"), ticket(2, "queued")]).runState).toBe("IDLE");
  });

  it("treats a processing-free, partially-done queue as RUNNING (work remains)", () => {
    expect(summarize([ticket(1, "replied"), ticket(2, "queued")]).runState).toBe("RUNNING");
  });

  it("handles an empty queue without dividing by zero", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.done).toBe(0);
    expect(s.progress).toBe(0);
    expect(s.runState).toBe("IDLE");
  });
});
