import { describe, expect, it } from "vitest";
import { splitHighlight } from "./highlight";

describe("splitHighlight", () => {
  it("returns the whole body as one unmarked segment when no snippet", () => {
    const segs = splitHighlight("hello world");
    expect(segs).toEqual([{ text: "hello world", mark: false }]);
  });

  it("returns one unmarked segment when the snippet is empty", () => {
    expect(splitHighlight("hello", "")).toEqual([{ text: "hello", mark: false }]);
  });

  it("marks the matched snippet, preserving the body's original casing", () => {
    const segs = splitHighlight("The System Check verifies setup.", "system check");
    expect(segs).toEqual([
      { text: "The ", mark: false },
      { text: "System Check", mark: true },
      { text: " verifies setup.", mark: false },
    ]);
    // round-trips back to the original body
    expect(segs.map((s) => s.text).join("")).toBe("The System Check verifies setup.");
  });

  it("returns one unmarked segment when the snippet is not found", () => {
    const segs = splitHighlight("nothing to see", "absent");
    expect(segs).toEqual([{ text: "nothing to see", mark: false }]);
  });

  it("marks only the first occurrence", () => {
    const segs = splitHighlight("ab ab ab", "ab");
    expect(segs.filter((s) => s.mark)).toHaveLength(1);
    expect(segs[0]).toEqual({ text: "ab", mark: true });
  });
});
