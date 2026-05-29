// @vitest-environment node
import { describe, expect, it } from "vitest";

import { rrf } from "./rrf";

describe("rrf", () => {
  it("fuses rankings by Σ 1/(k+rank) and reorders accordingly", () => {
    // A ranks x>y>z, B ranks z>x>y (1-based ranks, k=60):
    //   x = 1/61 + 1/62, z = 1/63 + 1/61, y = 1/62 + 1/63
    //   → x > z > y  (z jumps above y despite being last in A)
    const fused = rrf(
      [
        ["x", "y", "z"],
        ["z", "x", "y"],
      ],
      60,
    );
    expect(fused.map((f) => f.id)).toEqual(["x", "z", "y"]);
    expect(fused[0].score).toBeCloseTo(1 / 61 + 1 / 62, 10);
  });

  it("defaults k to 60", () => {
    const withDefault = rrf([["a", "b"]]);
    const explicit = rrf([["a", "b"]], 60);
    expect(withDefault).toEqual(explicit);
  });

  it("breaks ties deterministically by ascending id", () => {
    // a and b have identical fused scores → ascending id wins.
    const fused = rrf([
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(fused.map((f) => f.id)).toEqual(["a", "b"]);
    expect(fused[0].score).toBeCloseTo(fused[1].score, 12);
  });

  it("sums scores for ids appearing in multiple rankings", () => {
    const fused = rrf([["a"], ["a"]], 60);
    expect(fused[0].id).toBe("a");
    expect(fused[0].score).toBeCloseTo(2 * (1 / 61), 12);
  });
});
