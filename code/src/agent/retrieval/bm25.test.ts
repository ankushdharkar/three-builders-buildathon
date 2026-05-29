// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildBm25, tokenize } from "./bm25";

describe("tokenize", () => {
  it("lowercases, splits on non-alphanumerics, drops empties", () => {
    expect(tokenize("Reset MY Password!!")).toEqual(["reset", "my", "password"]);
    expect(tokenize("  CodePair: live-environment ")).toEqual([
      "codepair",
      "live",
      "environment",
    ]);
    expect(tokenize("")).toEqual([]);
  });
});

const DOCS = [
  {
    id: "settings/reset-password",
    text: "Reset your password\nUse the forgot password link to reset your account password.",
  },
  {
    id: "billing/invoice",
    text: "Download an invoice\nFind and download billing invoices for your subscription.",
  },
  {
    id: "screen/system-check",
    text: "Run the System Check\nVerify your browser, network, and webcam before a test.",
  },
];

describe("buildBm25", () => {
  it("ranks the obviously-relevant doc first", () => {
    const index = buildBm25(DOCS);
    const ranked = index.search("how do I reset my password");
    expect(ranked[0].id).toBe("settings/reset-password");
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("is deterministic across calls", () => {
    const index = buildBm25(DOCS);
    const a = index.search("webcam system check");
    const b = index.search("webcam system check");
    expect(a).toEqual(b);
    expect(a[0].id).toBe("screen/system-check");
  });

  it("breaks score ties by ascending id", () => {
    const index = buildBm25(DOCS);
    // a query term in no doc → all scores 0 → stable id order
    const ranked = index.search("zzzznotapresentterm");
    expect(ranked.every((r) => r.score === 0)).toBe(true);
    expect(ranked.map((r) => r.id)).toEqual(
      [...DOCS].map((d) => d.id).sort((x, y) => (x < y ? -1 : 1)),
    );
  });

  it("respects the top-k slice", () => {
    const index = buildBm25(DOCS);
    expect(index.search("password", 1)).toHaveLength(1);
    expect(index.search("password", 2)).toHaveLength(2);
  });
});
