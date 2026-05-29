import { describe, expect, it } from "vitest";
import { evaluate, formatEvalReport } from "./eval";
import type { Decision } from "../agent/types";

function decision(over: Partial<Decision> = {}): Decision {
  return {
    status: "replied",
    request_type: "product_issue",
    product_area: "screen",
    response: "A grounded answer.",
    justification: "Cited from the corpus.",
    risk: "LOW",
    confidence: 0.8,
    sources: [],
    ...over,
  };
}

describe("evaluate", () => {
  it("scores a perfect match at 100% across all columns", async () => {
    const preds = [decision(), decision({ product_area: "interviews" })];
    const expected = [
      { status: "replied", request_type: "product_issue", product_area: "screen" } as Partial<Decision>,
      { status: "replied", request_type: "product_issue", product_area: "interviews" } as Partial<Decision>,
    ];
    const report = evaluate(preds, expected);
    expect(report.total).toBe(2);
    for (const c of report.columns) expect(c.accuracy).toBe(1);
    expect(report.exactMatchAccuracy).toBe(1);
    expect(report.disagreements).toHaveLength(0);
  });

  it("computes per-column accuracy and lists disagreements", () => {
    const preds = [
      decision({ status: "replied", request_type: "bug", product_area: "screen" }),
      decision({ status: "escalated", request_type: "product_issue", product_area: "library" }),
    ];
    const expected = [
      { status: "replied", request_type: "product_issue", product_area: "screen" } as Partial<Decision>,
      { status: "escalated", request_type: "product_issue", product_area: "interviews" } as Partial<Decision>,
    ];
    const report = evaluate(preds, expected);
    const byCol = Object.fromEntries(report.columns.map((c) => [c.column, c.accuracy]));
    expect(byCol.status).toBe(1); // both match
    expect(byCol.request_type).toBe(0.5); // row 0 wrong
    expect(byCol.product_area).toBe(0.5); // row 1 wrong
    expect(report.exactMatchRows).toBe(0);
    expect(report.disagreements).toEqual([
      { index: 0, column: "request_type", expected: "product_issue", predicted: "bug" },
      { index: 1, column: "product_area", expected: "interviews", predicted: "library" },
    ]);
  });

  it("normalizes case and whitespace before comparing enums", () => {
    const preds = [decision({ status: "  Replied " as Decision["status"] })];
    const expected = [{ status: "replied" } as Partial<Decision>];
    const report = evaluate(preds, expected);
    expect(report.columns.find((c) => c.column === "status")?.accuracy).toBe(1);
  });

  it("treats an empty expected product_area as a valid value to match", () => {
    const preds = [decision({ product_area: "" })];
    const expected = [{ status: "replied", request_type: "product_issue", product_area: "" } as Partial<Decision>];
    const report = evaluate(preds, expected);
    expect(report.columns.find((c) => c.column === "product_area")?.accuracy).toBe(1);
  });

  it("grades free-form columns by non-empty coverage only", () => {
    const preds = [decision({ response: "", justification: "ok" })];
    const expected = [{ status: "replied", request_type: "product_issue", product_area: "screen" } as Partial<Decision>];
    const report = evaluate(preds, expected);
    const cov = Object.fromEntries(report.coverage.map((c) => [c.column, c.accuracy]));
    expect(cov.response).toBe(0); // empty
    expect(cov.justification).toBe(1);
  });

  it("is deterministic for the same inputs", () => {
    const preds = [decision()];
    const expected = [{ status: "replied", request_type: "product_issue", product_area: "screen" } as Partial<Decision>];
    expect(JSON.stringify(evaluate(preds, expected))).toBe(
      JSON.stringify(evaluate(preds, expected)),
    );
  });

  it("renders a human-readable report including accuracy and disagreements", () => {
    const preds = [decision({ request_type: "bug" })];
    const expected = [{ status: "replied", request_type: "product_issue", product_area: "screen" } as Partial<Decision>];
    const text = formatEvalReport(evaluate(preds, expected));
    expect(text).toMatch(/per-column accuracy/i);
    expect(text).toMatch(/request_type/);
    expect(text).toMatch(/expected "product_issue" got "bug"/);
  });
});
