/**
 * LLM client (004, D6) — the single place all chat/embedding network lives behind.
 *
 * - Chat: OpenRouter via the OpenAI SDK (`baseURL` swapped), with structured-JSON
 *   (`response_format: json_schema`) validated by the caller's zod schema + one retry,
 *   and a token-streaming mode. Always temperature 0 + fixed seed (D6 determinism).
 * - Embeddings: OpenAI (default baseURL), `text-embedding-3-small`.
 *
 * Secrets come from env only and are never logged. Implements the `LlmClient` and
 * `Embedder` ports; the composition root (`container.ts`) picks these up via the
 * `createLlm` / `createEmbedder` factories behind the `REAL_LLM` / `REAL_EMBEDDER` flags.
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

/**
 * Real embedder backed by OpenAI (`text-embedding-3-small`). Returns one vector per
 * input, preserving order.
 *
 * TODO(post-sprint): real OpenAI embeddings (D5 hybrid) — this factory is implemented
 * but `REAL_EMBEDDER` stays OFF this sprint (retrieval ships BM25-only). Validate the
 * cached-index integration, then flip the flag in feature-flags.md.
 */
export function createEmbedder(opts?: LlmOptions): Embedder {
  const apiKey = opts?.apiKey ?? requireEnv("OPENAI_API_KEY");
  const client = new OpenAI({ apiKey });
  const model = opts?.model ?? EMBEDDING_MODEL;

  return {
    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const res = await client.embeddings.create({ model, input: texts });
      return res.data.map((d) => d.embedding as number[]);
    },
  };
}
