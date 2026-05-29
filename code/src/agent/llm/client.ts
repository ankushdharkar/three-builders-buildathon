/**
 * LLM client (004, D6) — the single place all chat/embedding network lives behind.
 *
 * - Chat: OpenRouter via the OpenAI SDK (`baseURL` swapped), with structured-JSON
 *   (`response_format: json_schema`) validated by the caller's zod schema + one retry,
 *   and a token-streaming mode. Always temperature 0 + fixed seed (D6 determinism).
 * - Embeddings: OpenRouter (OpenAI-compatible `/embeddings`), `openai/text-embedding-3-small`.
 *
 * Secrets come from env only and are never logged. Implements the `LlmClient` and
 * `Embedder` ports; the composition root (`container.ts`) wires these up via the
 * `createLlm` / `createEmbedder` factories.
 */

import OpenAI from "openai";
import { z } from "zod";

import type { ChatMessage, ChatOpts, Embedder, LlmClient } from "../ports";
import { CHAT_MODEL, EMBEDDING_MODEL, SEED } from "./models";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Read a required env var or throw a clear error — without ever echoing the value. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name} environment variable. Set it in your environment (.env is gitignored).`,
    );
  }
  return value;
}

/** Construction options (all optional; env supplies the defaults). */
export interface LlmOptions {
  apiKey?: string;
  model?: string;
}

/**
 * Real chat client backed by OpenRouter. `chatJson` constrains generation to the zod
 * schema via `json_schema` response_format and validates the reply (retrying once if
 * the first payload doesn't satisfy the schema). `chatStream` yields content deltas.
 */
export function createLlm(opts?: LlmOptions): LlmClient {
  const apiKey = opts?.apiKey ?? requireEnv("OPENROUTER_API_KEY");
  const client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
  const defaultModel = opts?.model ?? process.env.CHAT_MODEL ?? CHAT_MODEL;

  function baseParams(messages: ChatMessage[], callOpts?: ChatOpts) {
    return {
      model: callOpts?.model ?? defaultModel,
      messages,
      temperature: callOpts?.temperature ?? 0,
      seed: callOpts?.seed ?? SEED,
      ...(callOpts?.maxTokens != null ? { max_tokens: callOpts.maxTokens } : {}),
    };
  }

  return {
    async chatJson<T>(schema: unknown, messages: ChatMessage[], callOpts?: ChatOpts): Promise<T> {
      const zodSchema = schema as z.ZodType<T>;
      const jsonSchema = z.toJSONSchema(zodSchema);
      const request = {
        ...baseParams(messages, callOpts),
        response_format: {
          type: "json_schema" as const,
          json_schema: { name: "structured_output", schema: jsonSchema },
        },
      };

      let lastError: unknown;
      // One retry: a flagship at temp 0 rarely violates the schema, but a single
      // re-ask is a cheap guard against an occasional malformed payload.
      for (let attempt = 0; attempt < 2; attempt++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completion: any = await client.chat.completions.create(request as any);
        const content = completion.choices?.[0]?.message?.content ?? "";
        try {
          return zodSchema.parse(JSON.parse(content));
        } catch (err) {
          lastError = err;
        }
      }
      throw new Error(
        `LLM structured output failed schema validation after retry: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`,
      );
    },

    async *chatStream(messages: ChatMessage[], callOpts?: ChatOpts): AsyncIterable<string> {
      const stream = (await client.chat.completions.create({
        ...baseParams(messages, callOpts),
        stream: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)) as unknown as AsyncIterable<{
        choices?: Array<{ delta?: { content?: string } }>;
      }>;
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
  };
}

/** Per-input character cap (~text-embedding-3-small's 8191-token limit; ample for retrieval). */
export const MAX_INPUT_CHARS = 8_000;
/** Soft char budget per request — keeps a batch well under the provider's per-call limit. */
export const MAX_BATCH_CHARS = 80_000;
/** Hard cap on inputs per request. */
export const MAX_BATCH_COUNT = 96;

/**
 * Real embedder backed by OpenRouter's OpenAI-compatible embeddings endpoint
 * (`openai/text-embedding-3-small`, 1536-dim). Uses the same `OPENROUTER_API_KEY` as
 * chat — no separate OpenAI key. Returns one vector per input, preserving order.
 *
 * Inputs are clipped (per-doc) and **batched** by a char budget: sending the whole
 * 436-article corpus (~3.7M chars) in one request makes OpenRouter return a 200 with no
 * `data` array, which used to crash on `.map`. We also **guard the response shape** so a
 * bad payload throws an actionable error (the retriever then degrades to BM25-only).
 */
export function createEmbedder(opts?: LlmOptions): Embedder {
  const apiKey = opts?.apiKey ?? requireEnv("OPENROUTER_API_KEY");
  const client = new OpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL });
  const model = opts?.model ?? EMBEDDING_MODEL;

  return {
    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const clipped = texts.map((t) => (t.length > MAX_INPUT_CHARS ? t.slice(0, MAX_INPUT_CHARS) : t));

      const out: number[][] = [];
      for (let i = 0; i < clipped.length; ) {
        // Greedily pack a batch up to the count/char budget (always ≥1 input).
        const batch: string[] = [];
        let chars = 0;
        while (
          i < clipped.length &&
          batch.length < MAX_BATCH_COUNT &&
          (batch.length === 0 || chars + clipped[i].length <= MAX_BATCH_CHARS)
        ) {
          chars += clipped[i].length;
          batch.push(clipped[i]);
          i++;
        }

        const res = await client.embeddings.create({ model, input: batch });
        if (!res || !Array.isArray(res.data) || res.data.length !== batch.length) {
          throw new Error(
            `Embeddings response malformed for model "${model}" (expected ${batch.length} ` +
              `vectors, got ${Array.isArray(res?.data) ? res.data.length : "no data array"}).`,
          );
        }
        for (const d of res.data) out.push(d.embedding as number[]);
      }
      return out;
    },
  };
}
