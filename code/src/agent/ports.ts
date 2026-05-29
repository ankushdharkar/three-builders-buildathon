/**
 * Module interfaces ("ports") for the agent core.
 *
 * Every capability the pipeline needs — corpus, embeddings, LLM, retrieval, and the
 * pipeline itself — is expressed here as an interface only. Implementations live in
 * their own units (002 corpus, 003 retrieval, 004 llm/embedder, 005 pipeline) and are
 * wired in by the composition root (`container.ts`), which always provides the real
 * implementations. Building against these ports — and the test-only fakes in
 * `fakes.ts` — is what lets 002–008 develop in parallel without importing each
 * other's real modules.
 *
 * Each real unit exposes a `create*` factory the container dynamic-imports:
 *   002 → createCorpusIndex()                  : CorpusIndex
 *   004 → createEmbedder()                     : Embedder
 *   004 → createLlm()                          : LlmClient
 *   003 → createRetriever({ index, embedder }) : Retriever
 *   005 → createPipeline({ retrieve, llm })    : Pipeline
 */

import type { Decision, PipelineEvent, ProductArea, Source, Ticket } from "./types";

/** A chat message in the provider-neutral shape the LLM client accepts. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Tuning knobs for a chat call. Determinism: temperature 0 + fixed seed (D6). */
export interface ChatOpts {
  temperature?: number;
  seed?: number;
  model?: string;
  maxTokens?: number;
}

/**
 * One corpus article loaded from `data/hackerrank/` (002 produces these). `articleId`
 * matches `Source.articleId` so retrieval (003) can map a doc straight to a `Source`.
 */
export interface CorpusDoc {
  articleId: string;
  title: string;
  category: ProductArea | string;
  body: string;
  breadcrumbs: string[];
  url?: string;
}

/** Turns text into embedding vectors (004 — OpenAI `text-embedding-3-small`). */
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

/** Chat LLM with structured-JSON and streaming modes (004 — OpenRouter chat). */
export interface LlmClient {
  /** Constrained generation: returns a value validated against `schema`. */
  chatJson<T>(schema: unknown, messages: ChatMessage[], opts?: ChatOpts): Promise<T>;
  /** Token-streaming generation for the user-facing response. */
  chatStream(messages: ChatMessage[], opts?: ChatOpts): AsyncIterable<string>;
}

/** Article-level retrieval over the corpus (003 — BM25 + embeddings, RRF). */
export interface Retriever {
  retrieve(query: string, opts?: { k?: number }): Promise<Source[]>;
}

/** The indexed corpus (002). */
export interface CorpusIndex {
  docs(): Promise<CorpusDoc[]>;
}

/** The full triage pipeline as a stream of events (005). */
export interface Pipeline {
  run(ticket: Ticket): AsyncIterable<PipelineEvent>;
}

/**
 * UI-side data source (consumed by 008). The mock implementation replays the shared
 * mock; the live implementation (007) streams from `/api/triage`. Lives in the port
 * set so both sides share one shape.
 */
export interface TriageSource {
  stream(ticket: Ticket, onEvent: (e: PipelineEvent) => void): Promise<void>;
}

/** Re-export the decision shape the LLM JSON mode is expected to produce. */
export type { Decision };
