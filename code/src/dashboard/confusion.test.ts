import { describe, expect, it } from "vitest";
import { buildConfusionMatrices, scoreSample, EXACT_COLUMNS } from "./confusion";
import type { Decision } from "../agent/types";

/** Minimal full `Decision` with overridable graded columns. */
function d(p: Partial<Decision>): Decision {
  return {
    status: "replied",
    request_type: "product_issue",
    product_area: "",
    response: "r",
    justification: "j",
    risk: "LOW",
    confidence: 0.8,
    sources: [],
    ...p,
  };
}

const predictions: Decision[] = [
  d({ status: "replied", request_type: "bug", product_area: "screen" }),
  d({ status: "escalated", request_type: "product_issue", product_area: "settings" }),
  d({ status: "replied", request_type: "product_issue", product_area: "" }),
];
const expected: Array<Partial<Decision>> = [
  { status: "replied", request_type: "bug", product_area: "screen" }, // all match
  { status: "replied", request_type: "product_issue", product_area: "settings" }, // status mismatch
  { status: "replied", request_type: "feature_request", product_area: "" }, // request_type mismatch
];

describe("scoreSample", () => {
  it("scores per-column exact-match accuracy", () => {
    const r = scoreSample(predictions, expected);
    expect(r.total).toBe(3);
    const byCol = Object.fromEntries(r.columns.map((c) => [c.column, c]));
    expect(byCol.status.correct).toBe(2);
    expect(byCol.request_type.correct).toBe(2);
    expect(byCol.product_area.correct).toBe(3);
  });

  it("counts all-enum exact-match rows and lists disagreements", () => {
    const r = scoreSample(predictions, expected);
    expect(r.exactMatchRows).toBe(1);
    expect(r.disagreements).toHaveLength(2);
    expect(r.disagreements.map((x) => x.column).sort()).toEqual(["request_type", "status"]);
  });

  it("reports non-empty coverage for free-form columns", () => {
    const r = scoreSample(predictions, expected);
    const cov = Object.fromEntries(r.coverage.map((c) => [c.column, c]));
    expect(cov.response.correct).toBe(3);
    expect(cov.justification.correct).toBe(3);
  });

  it("only compares paired rows (min length)", () => {
    const r = scoreSample(predictions, expected.slice(0, 2));
    expect(r.total).toBe(2);
  });
});

describe("buildConfusionMatrices", () => {
  it("produces one matrix per exact column", () => {
    const ms = buildConfusionMatrices(predictions, expected);
    expect(ms.map((m) => m.column)).toEqual([...EXACT_COLUMNS]);
  });

  it("tallies expected×predicted counts with a correct diagonal", () => {
    const ms = buildConfusionMatrices(predictions, expected);
    const status = ms.find((m) => m.column === "status")!;
    expect(status.labels).toEqual(expect.arrayContaining(["replied", "escalated"]));
    expect(status.total).toBe(3);
    // two rows expected+predicted replied (diagonal); one expected replied / predicted escalated
    expect(status.correct).toBe(2);
    const ei = status.labels.indexOf("replied");
    const pj = status.labels.indexOf("escalated");
    expect(status.counts[ei][pj]).toBe(1);
  });
});
