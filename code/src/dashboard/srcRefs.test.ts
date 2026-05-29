import { describe, expect, it } from "vitest";
import { parseSrcRefs } from "./srcRefs";

describe("parseSrcRefs", () => {
  it("returns a single text segment when there are no refs", () => {
    expect(parseSrcRefs("just a justification")).toEqual([{ text: "just a justification" }]);
  });

  it("splits a multi-number ref into one src segment per number", () => {
    expect(parseSrcRefs("grounded answer [src: 1, 2]")).toEqual([
      { text: "grounded answer " },
      { src: 1 },
      { src: 2 },
    ]);
  });

  it("parses a single-number ref", () => {
    expect(parseSrcRefs("escalated [src: 4]")).toEqual([{ text: "escalated " }, { src: 4 }]);
  });

  it("tolerates no-space and trailing text", () => {
    expect(parseSrcRefs("a [src:1] b")).toEqual([{ text: "a " }, { src: 1 }, { text: " b" }]);
  });

  it("leaves a no-source marker as plain text", () => {
    expect(parseSrcRefs("spam, declined. [no src]")).toEqual([{ text: "spam, declined. [no src]" }]);
  });

  it("handles multiple ref groups", () => {
    expect(parseSrcRefs("x [src: 1] y [src: 2, 3]")).toEqual([
      { text: "x " },
      { src: 1 },
      { text: " y " },
      { src: 2 },
      { src: 3 },
    ]);
  });
});
