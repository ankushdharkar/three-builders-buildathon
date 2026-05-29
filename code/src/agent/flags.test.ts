import { describe, expect, it } from "vitest";
import { parseFlags } from "./flags";

describe("parseFlags", () => {
  it("returns all-false for an empty environment", () => {
    expect(parseFlags({})).toEqual({
      realCorpus: false,
      realEmbedder: false,
      realLlm: false,
      realRetrieval: false,
      realPipeline: false,
    });
  });

  it("reads each REAL_* flag and accepts common truthy spellings", () => {
    expect(
      parseFlags({
        REAL_CORPUS: "1",
        REAL_EMBEDDER: "TRUE",
        REAL_LLM: "true",
        REAL_RETRIEVAL: "yes",
        REAL_PIPELINE: "on",
      }),
    ).toEqual({
      realCorpus: true,
      realEmbedder: true,
      realLlm: true,
      realRetrieval: true,
      realPipeline: true,
    });
  });

  it("treats 0 / false / no / empty / undefined as off", () => {
    const f = parseFlags({
      REAL_CORPUS: "0",
      REAL_EMBEDDER: "false",
      REAL_LLM: "no",
      REAL_RETRIEVAL: "",
      REAL_PIPELINE: undefined,
    });
    expect(f).toEqual({
      realCorpus: false,
      realEmbedder: false,
      realLlm: false,
      realRetrieval: false,
      realPipeline: false,
    });
  });

  it("does not parse the UI flag (NEXT_PUBLIC_TRIAGE_LIVE is owned by the UI)", () => {
    const f = parseFlags({ NEXT_PUBLIC_TRIAGE_LIVE: "1" } as Record<string, string>);
    expect(Object.values(f).every((v) => v === false)).toBe(true);
  });
});
