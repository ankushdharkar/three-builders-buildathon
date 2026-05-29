/**
 * Unit tests for the LLM client (004). The OpenAI SDK is fully mocked — NO real
 * network. We assert determinism knobs (temperature 0, fixed seed, pinned model),
 * the structured-output request shape, zod validation + retry, streaming order,
 * embeddings shape, and clear errors on missing keys (never leaking the key).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// --- Mock the openai SDK -----------------------------------------------------
// One shared create/embeddings spy each test controls; the constructor records the
// options it was built with so we can assert baseURL + apiKey routing.
const chatCreate = vi.fn();
const embeddingsCreate = vi.fn();
const ctorCalls: Array<{ apiKey?: string; baseURL?: string }> = [];

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: chatCreate } };
    embeddings = { create: embeddingsCreate };
    constructor(opts: { apiKey?: string; baseURL?: string }) {
      ctorCalls.push(opts);
    }
  },
}));

import { createEmbedder, createLlm, MAX_BATCH_COUNT, MAX_INPUT_CHARS } from "./client";
import { CHAT_MODEL, EMBEDDING_MODEL, SEED } from "./models";

/** Build an async-iterable streamed chat response from string deltas. */
async function* streamOf(deltas: string[]) {
  for (const content of deltas) {
    yield { choices: [{ delta: { content } }] };
  }
}

const DecisionLite = z.object({
  status: z.enum(["replied", "escalated"]),
  product_area: z.string(),
});

beforeEach(() => {
  chatCreate.mockReset();
  embeddingsCreate.mockReset();
  ctorCalls.length = 0;
  process.env.OPENROUTER_API_KEY = "sk-or-test-key";
  process.env.OPENAI_API_KEY = "sk-oai-test-key";
  delete process.env.CHAT_MODEL;
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

describe("createLlm — chat (OpenRouter)", () => {
  it("routes through OpenRouter with the env key", () => {
    createLlm();
    expect(ctorCalls).toHaveLength(1);
    expect(ctorCalls[0].baseURL).toBe("https://openrouter.ai/api/v1");
    expect(ctorCalls[0].apiKey).toBe("sk-or-test-key");
  });

  it("chatJson returns a zod-validated object and sends temp 0 + seed + json_schema", async () => {
    chatCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ status: "replied", product_area: "screen" }) } },
      ],
    });

    const llm = createLlm();
    const out = await llm.chatJson(DecisionLite, [{ role: "user", content: "hi" }]);

    expect(out).toEqual({ status: "replied", product_area: "screen" });
    const args = chatCreate.mock.calls[0][0];
    expect(args.temperature).toBe(0);
    expect(args.seed).toBe(SEED);
    expect(args.model).toBe(CHAT_MODEL);
    expect(args.response_format.type).toBe("json_schema");
    expect(args.response_format.json_schema.schema).toBeTruthy();
  });

  it("chatJson retries once on an invalid payload, then succeeds", async () => {
    chatCreate
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ status: "nope" }) } }],
      })
      .mockResolvedValueOnce({
        choices: [
          { message: { content: JSON.stringify({ status: "escalated", product_area: "" }) } },
        ],
      });

    const llm = createLlm();
    const out = await llm.chatJson(DecisionLite, [{ role: "user", content: "hi" }]);
    expect(out).toEqual({ status: "escalated", product_area: "" });
    expect(chatCreate).toHaveBeenCalledTimes(2);
  });

  it("chatJson throws when the payload stays invalid", async () => {
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ status: "bogus" }) } }],
    });
    const llm = createLlm();
    await expect(
      llm.chatJson(DecisionLite, [{ role: "user", content: "hi" }]),
    ).rejects.toThrow();
  });

  it("chatStream yields token deltas in order", async () => {
    chatCreate.mockResolvedValue(streamOf(["Hel", "lo, ", "world"]));
    const llm = createLlm();
    const chunks: string[] = [];
    for await (const d of llm.chatStream([{ role: "user", content: "hi" }])) {
      chunks.push(d);
    }
    expect(chunks).toEqual(["Hel", "lo, ", "world"]);
    expect(chatCreate.mock.calls[0][0].stream).toBe(true);
    expect(chatCreate.mock.calls[0][0].temperature).toBe(0);
  });

  it("throws a clear error (no key leak) when OPENROUTER_API_KEY is missing", () => {
    delete process.env.OPENROUTER_API_KEY;
    try {
      createLlm();
      throw new Error("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/OPENROUTER_API_KEY/);
      expect(msg).not.toContain("sk-or-test-key");
    }
  });
});

describe("createEmbedder — embeddings (OpenRouter)", () => {
  it("uses openai/text-embedding-3-small on the OpenRouter baseURL and returns one vector per input", async () => {
    embeddingsCreate.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
    });
    const embedder = createEmbedder();
    const vecs = await embedder.embed(["a", "b"]);

    expect(vecs).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(ctorCalls[0].apiKey).toBe("sk-or-test-key");
    expect(ctorCalls[0].baseURL).toBe("https://openrouter.ai/api/v1");
    expect(embeddingsCreate.mock.calls[0][0].model).toBe(EMBEDDING_MODEL);
    expect(EMBEDDING_MODEL).toBe("openai/text-embedding-3-small");
  });

  it("returns [] for empty input without calling the API", async () => {
    const embedder = createEmbedder();
    expect(await embedder.embed([])).toEqual([]);
    expect(embeddingsCreate).not.toHaveBeenCalled();
  });

  it("batches large input into multiple requests and concatenates in order", async () => {
    embeddingsCreate.mockImplementation((req: { input: string[] }) =>
      Promise.resolve({ data: req.input.map(() => ({ embedding: [1] })) }),
    );
    const embedder = createEmbedder();
    const n = MAX_BATCH_COUNT * 2 + 5; // forces 3 count-limited requests
    const vecs = await embedder.embed(Array.from({ length: n }, (_, i) => `doc ${i}`));
    expect(vecs).toHaveLength(n);
    expect(embeddingsCreate).toHaveBeenCalledTimes(3);
  });

  it("clips an oversized input to MAX_INPUT_CHARS before sending (avoids the bodyless 200)", async () => {
    embeddingsCreate.mockImplementation((req: { input: string[] }) =>
      Promise.resolve({ data: req.input.map(() => ({ embedding: [0] })) }),
    );
    const embedder = createEmbedder();
    await embedder.embed(["x".repeat(MAX_INPUT_CHARS * 3)]);
    expect(embeddingsCreate.mock.calls[0][0].input[0].length).toBe(MAX_INPUT_CHARS);
  });

  it("throws an actionable error when the response has no data array (so the retriever falls back)", async () => {
    embeddingsCreate.mockResolvedValue({ data: undefined });
    const embedder = createEmbedder();
    await expect(embedder.embed(["a", "b"])).rejects.toThrow(/malformed|no data array/i);
  });

  it("throws a clear error (no key leak) when OPENROUTER_API_KEY is missing", () => {
    delete process.env.OPENROUTER_API_KEY;
    try {
      createEmbedder();
      throw new Error("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/OPENROUTER_API_KEY/);
      expect(msg).not.toContain("sk-or-test-key");
    }
  });
});
