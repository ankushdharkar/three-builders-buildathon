import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCorpus, getEmbedder, getLlm } from "./container";

// Keys the real factories read. We clear them so these tests are deterministic and
// require no network/credentials: the corpus needs none, while the LLM/embedder
// factories must reject without OPENROUTER_API_KEY.
const ENV_KEYS = ["OPENROUTER_API_KEY", "OPENAI_API_KEY"];

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("container — wires real implementations", () => {
  it("getCorpus() resolves to a real CorpusIndex exposing docs()", async () => {
    const corpus = await getCorpus();
    // Real impl exposes the port's docs function. We do NOT call docs() here — that
    // would build the on-disk index, which is out of scope for this unit test.
    expect(typeof corpus.docs).toBe("function");
  });

  it("getLlm() rejects when OPENROUTER_API_KEY is unset", async () => {
    await expect(getLlm()).rejects.toThrow();
  });

  it("getEmbedder() rejects when OPENROUTER_API_KEY is unset", async () => {
    await expect(getEmbedder()).rejects.toThrow();
  });
});
