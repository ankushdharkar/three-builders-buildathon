/**
 * Hybrid retriever (D5, prompt 003): BM25 (lexical) + embedding cosine (semantic),
 * fused with Reciprocal Rank Fusion, returning top-k grounded `Source[]`.
 *
 * Implements the `Retriever` port. The composition root dynamic-imports this and calls
 * `createRetriever({ index, embedder })`. The corpus (002) and embedder (004) arrive as
 * PORTS, so this module never imports those units directly and is unit-tested fully
 * offline with the test-only fakes in `src/agent/fakes.ts`.
 *
 * Pipeline: load docs once → build BM25 + an embedding store (vectors cached to
 * `data/index/embeddings.json`) → per query, rank by each and fuse with RRF → map the
 * top-k to `Source` with a short query-relevant snippet.
 */

import type { CorpusIndex, Embedder, Retriever } from "../ports";
import type { Source } from "../types";

import { EMBEDDING_MODEL } from "../llm/models";
import { buildBm25, tokenize, type Bm25Index } from "./bm25";
import { createEmbedStore, type EmbedStore } from "./embedStore";
import { rrf } from "./rrf";

/**
 * Embedding model id used in the on-disk vector cache key. Single-sourced from
 * `llm/models` so the key always tracks the real model — a genuine model swap changes
 * the key and re-embeds, never silently reusing stale vectors of the wrong model/dim.
 */
export const DEFAULT_EMBED_MODEL = EMBEDDING_MODEL;

/** RRF constant (Cormack et al.). */
const RRF_K = 60;
/** Default number of sources returned. */
const DEFAULT_K = 5;
/** Max snippet length before ellipsis. */
const SNIPPET_MAX = 200;

export interface CreateRetrieverDeps {
  index: CorpusIndex;
  embedder: Embedder;
  /** Override the embedding-model cache key (defaults to text-embedding-3-small). */
  embeddingModelId?: string;
  /**
   * Override / disable the on-disk vector cache. `undefined` → default gitignored path;
   * `null` → in-memory only (tests). Not part of the port — the container omits it.
   */
  cachePath?: string | null;
}

interface DocMeta {
  id: string;
  title: string;
  category: string;
  body: string;
  url?: string;
}

interface Built {
  metas: Map<string, DocMeta>;
  bm25: Bm25Index;
  /** `null` when the semantic half is unavailable — retrieval degrades to BM25-only. */
  embeds: EmbedStore | null;
}

/** Build the `Retriever` port over the given corpus + embedder. */
export function createRetriever(deps: CreateRetrieverDeps): Retriever {
  const { index, embedder } = deps;
  const modelId = deps.embeddingModelId ?? DEFAULT_EMBED_MODEL;

  // Built lazily on first retrieve, then memoized for the life of the retriever.
  let built: Promise<Built> | null = null;

  function build(): Promise<Built> {
    if (!built) {
      built = (async () => {
        const docs = await index.docs();
        const metas = new Map<string, DocMeta>();
        const indexDocs = docs.map((d) => {
          // 002's CorpusDoc keys articles by `articleId`; we carry it as the internal
          // doc id so BM25/embeddings and the final Source all line up.
          const meta: DocMeta = {
            id: d.articleId,
            title: d.title,
            category: d.category,
            body: d.body,
            url: d.url,
          };
          metas.set(d.articleId, meta);
          // BM25 + embeddings both index `title + body` for full lexical/semantic signal.
          return { id: d.articleId, text: `${d.title}\n${d.body}` };
        });

        const bm25 = buildBm25(indexDocs);
        const store = createEmbedStore({
          docs: indexDocs,
          embed: (texts) => embedder.embed(texts),
          modelId,
          cachePath: deps.cachePath,
        });
        // Embeddings are the SEMANTIC half of the hybrid. If they fail (provider down,
        // 429, dimension mismatch), degrade to BM25-only rather than losing ALL
        // retrieval — empty sources make decide.ts escalate as "out of corpus"
        // (regression #10). Fail loud (warn), never silent.
        let embeds: EmbedStore | null = store;
        try {
          await store.ready();
        } catch (err) {
          console.warn(
            `[retrieval] embeddings unavailable — falling back to BM25-only: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          embeds = null;
        }
        return { metas, bm25, embeds };
      })();
    }
    return built;
  }

  /** A short, query-relevant excerpt: first sentence/line hitting a query term, else the head. */
  function snippetFor(body: string, query: string): string {
    const qTerms = new Set(tokenize(query));
    const segments = body
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const hit = segments.find((seg) => tokenize(seg).some((t) => qTerms.has(t)));
    const chosen = hit ?? segments[0] ?? body.trim();
    return chosen.length > SNIPPET_MAX
      ? `${chosen.slice(0, SNIPPET_MAX - 1).trimEnd()}…`
      : chosen;
  }

  async function retrieve(query: string, opts?: { k?: number }): Promise<Source[]> {
    const k = opts?.k ?? DEFAULT_K;
    const { metas, bm25, embeds } = await build();

    // Rank by each signal, then fuse with RRF. Embeddings are best-effort: if the
    // semantic half is unavailable or errors for this query, fall back to BM25-only so
    // retrieval never goes empty on a healthy corpus (regression #10).
    const bm25Ranking = bm25.search(query).map((s) => s.id);
    let embedRanking: string[] = [];
    if (embeds) {
      try {
        embedRanking = (await embeds.search(query)).map((s) => s.id);
      } catch (err) {
        console.warn(
          `[retrieval] embedding search failed — BM25-only for this query: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    const rankings = embedRanking.length > 0 ? [bm25Ranking, embedRanking] : [bm25Ranking];
    const fused = rrf(rankings, RRF_K);

    return fused.slice(0, Math.max(1, k)).map((f) => {
      const m = metas.get(f.id)!;
      const source: Source = {
        articleId: m.id,
        title: m.title,
        category: m.category,
        score: Number(f.score.toFixed(6)),
        snippet: snippetFor(m.body, query),
      };
      if (m.url) source.url = m.url;
      return source;
    });
  }

  return { retrieve };
}
