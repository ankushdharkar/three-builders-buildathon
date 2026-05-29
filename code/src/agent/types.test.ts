import { describe, expect, it } from "vitest";
import { PRODUCT_AREAS, isProductArea } from "./types";

describe("PRODUCT_AREAS (D8 closed set)", () => {
  it("contains the corpus-native areas, the meta value, and the empty no-area case", () => {
    expect(PRODUCT_AREAS).toEqual([
      "screen",
      "interviews",
      "chakra",
      "library",
      "integrations",
      "settings",
      "engage",
      "skillup",
      "community",
      "general-help",
      "conversation_management",
      "",
    ]);
  });

  it("includes the empty string (no-area escalation)", () => {
    expect(PRODUCT_AREAS).toContain("");
  });
});

describe("isProductArea", () => {
  it("accepts every value in the closed set", () => {
    for (const area of PRODUCT_AREAS) {
      expect(isProductArea(area)).toBe(true);
    }
  });

  it("rejects values outside the closed set", () => {
    expect(isProductArea("billing")).toBe(false);
    expect(isProductArea("Screen")).toBe(false);
    expect(isProductArea("unknown-area")).toBe(false);
    expect(isProductArea(undefined)).toBe(false);
    expect(isProductArea(null)).toBe(false);
    expect(isProductArea(42)).toBe(false);
  });
});
