/**
 * Model ids + determinism constants for the LLM client (004, D6).
 *
 * Single place to swap providers/models. The chat model is pinned to a flagship that
 * supports structured `json_schema` response_format through OpenRouter; override per
 * environment with `CHAT_MODEL`. Determinism (D6): temperature 0 + this fixed `SEED`.
 */

/** Fixed sampling seed — pairs with temperature 0 for reproducible chat output. */
export const SEED = 7;

/**
 * Default chat model (OpenRouter id). `openai/gpt-4o` is a flagship that supports
 * `response_format: json_schema` (and tool-calling) through OpenRouter, so structured
 * output is reliable. Swap via `CHAT_MODEL` without touching call sites.
 */
export const CHAT_MODEL = "openai/gpt-4o";

/** Embedding model — OpenRouter OpenAI-compatible id (1536-dim). Pinned per D5. */
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
