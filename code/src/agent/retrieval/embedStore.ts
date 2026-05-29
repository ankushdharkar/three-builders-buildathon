/**
 * Embedding store — brute-force cosine retrieval over cached document vectors (D5).
 *
 * Vectors come from an INJECTED `embed(texts) => number[][]` so tests run fully offline
 * with a deterministic fake embedder (no OpenAI); at integration the container wires in
 * 004's real `Embedder`. Built vectors are cached to disk as JSON keyed by
 * `${modelId}:${id}`, so re-runs skip re-embedding unchanged docs — idempotent, and a
 * model swap re-embeds (different key). No vector DB; cosine is computed in JS over all
 * docs (the corpus is ~438 articles — brute force is plenty fast).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import type { Scored } from "./bm25";

/** A document to embed. Callers pass `text = title + "\n" + body`. */
export interface EmbedDoc {
  id: string;
  text: string;
}

export type EmbedFn = (texts: string[]) => Promise<number[][]>;

export interface EmbedStoreOpts {
  docs: EmbedDoc[];
  embed: EmbedFn;
  /** Embedding-model id — part of the cache key, so swapping models re-embeds. */
  modelId: string;
  /**
   * Cache file path. `undefined` → default `data/index/embeddings.json` (gitignored);
   * `null` → in-memory only (no disk I/O), used by tests.
   */
  cachePath?: string | null;
}

export interface EmbedStore {
  /** Ensure every doc vector exists (load cache → embed misses → persist). Idempotent. */
  ready(): Promise<void>;
  /** Cosine top-k against the query embedding; ties broken by ascending id. */
  search(query: string, k?: number): Promise<Scored[]>;
}

/** On-disk shape: `${modelId}:${id}` → vector. */
type CacheShape = Record<string, number[]>;

const DEFAULT_CACHE_REL = "data/index/embeddings.json";

/**
 * Cosine similarity of two equal-length vectors. An empty vector (the "missing doc
 * vector" sentinel) scores 0. A genuine length mismatch between two non-empty vectors
 * means the cached vectors are stale (e.g. the embedding model/dimension changed) — we
 * throw an actionable error rather than silently truncating to the shorter length and
 * returning a meaningless score.
 */
export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a.length !== b.length) {
    throw new Error(
      `Embedding dimension mismatch (${a.length} vs ${b.length}). The cached vectors ` +
        `look stale — delete data/index/embeddings.json and retry.`,
    );
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function createEmbedStore(opts: EmbedStoreOpts): EmbedStore {
  const { docs, embed, modelId } = opts;
  const cachePath =
    opts.cachePath === undefined
      ? path.resolve(process.cwd(), DEFAULT_CACHE_REL)
      : opts.cachePath;
  const key = (id: string) => `${modelId}:${id}`;

  let vectors: Map<string, number[]> | null = null;
  let readyPromise: Promise<void> | null = null;

  async function loadCache(): Promise<CacheShape> {
    if (!cachePath) return {};
    try {
      return JSON.parse(await fs.readFile(cachePath, "utf8")) as CacheShape;
    } catch {
      return {}; // missing/corrupt cache → rebuild from scratch
    }
  }

  async function build(): Promise<void> {
    const cache = await loadCache();
    const have = new Map<string, number[]>();
    for (const d of docs) {
      const cached = cache[key(d.id)];
      if (cached) have.set(d.id, cached);
    }

    const missing = docs.filter((d) => !have.has(d.id));
    if (missing.length > 0) {
      const embedded = await embed(missing.map((d) => d.text));
      missing.forEach((d, i) => have.set(d.id, embedded[i]));

      if (cachePath) {
        // merge into the existing cache (other models' keys preserved) and persist
        const next: CacheShape = { ...cache };
        for (const d of missing) next[key(d.id)] = have.get(d.id)!;
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.writeFile(cachePath, JSON.stringify(next, null, 2), "utf8");
      }
    }

    vectors = have;
  }

  function ready(): Promise<void> {
    if (!readyPromise) readyPromise = build();
    return readyPromise;
  }

  async function search(query: string, k?: number): Promise<Scored[]> {
    await ready();
    const [qv] = await embed([query]);
    const scored: Scored[] = docs.map((d) => ({
      id: d.id,
      score: cosine(qv, vectors!.get(d.id) ?? []),
    }));
    scored.sort((a, z) => {
      if (z.score !== a.score) return z.score - a.score;
      return a.id < z.id ? -1 : a.id > z.id ? 1 : 0;
    });
    return k === undefined ? scored : scored.slice(0, Math.max(0, k));
  }

  return { ready, search };
}
