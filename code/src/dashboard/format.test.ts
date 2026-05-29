import { describe, expect, it } from "vitest";
import { confidenceBars, statusBadge } from "./format";

describe("statusBadge", () => {
  it("maps each queue state to a symbol, label, and tone", () => {
    expect(statusBadge("replied")).toEqual({ symbol: "✓", label: "replied", tone: "success" });
    expect(statusBadge("escalated")).toEqual({ symbol: "⤴", label: "escalated", tone: "warn" });
    expect(statusBadge("invalid")).toEqual({ symbol: "⊘", label: "invalid", tone: "muted" });
    expect(statusBadge("processing")).toEqual({ symbol: "▶", label: "processing", tone: "active" });
    expect(statusBadge("queued")).toEqual({ symbol: "○", label: "queued", tone: "idle" });
  });
});

describe("confidenceBars", () => {
  it("fills the right number of segments out of a default 6", () => {
    expect(confidenceBars(0.83)).toEqual({ filled: 5, total: 6 });
    expect(confidenceBars(1)).toEqual({ filled: 6, total: 6 });
    expect(confidenceBars(0)).toEqual({ filled: 0, total: 6 });
  });

  it("rounds to the nearest segment", () => {
    expect(confidenceBars(0.5).filled).toBe(3); // 0.5 * 6 = 3
    expect(confidenceBars(0.58).filled).toBe(3); // 3.48 -> 3
    expect(confidenceBars(0.6).filled).toBe(4); // 3.6 -> 4
  });

  it("clamps out-of-range input into [0, total]", () => {
    expect(confidenceBars(1.5)).toEqual({ filled: 6, total: 6 });
    expect(confidenceBars(-0.2)).toEqual({ filled: 0, total: 6 });
  });

  it("supports a custom segment count", () => {
    expect(confidenceBars(0.5, 10)).toEqual({ filled: 5, total: 10 });
  });
});
