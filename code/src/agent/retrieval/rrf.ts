/**
 * Reciprocal Rank Fusion (RRF) — combine several rankings of the same items into one
 * (Cormack, Clarke & Buettcher, 2009). Used to fuse the BM25 (lexical) and embedding
 * (semantic) rankings in `retrieve.ts`.
 *
 * Each input ranking is an ordered list of ids (best first). An id's fused score is
 * `Σ 1/(k + rank)` over the rankings it appears in (rank is 1-based). Higher is more
 * relevant. Deterministic: ties broken by ascending id. `k=60` is the canonical default.
 */

import type { Scored } from "./bm25";

export type { Scored };

/** Fuse rankings (each a best-first list of ids) into one scored, sorted list. */
export function rrf(rankings: string[][], k = 60): Scored[] {
  const acc = new Map<string, number>();
  for (const ranking of rankings) {
    for (let i = 0; i < ranking.length; i++) {
      const id = ranking[i];
      const rank = i + 1; // 1-based
      acc.set(id, (acc.get(id) ?? 0) + 1 / (k + rank));
    }
  }
  const fused: Scored[] = [...acc.entries()].map(([id, score]) => ({ id, score }));
  fused.sort((a, z) => {
    if (z.score !== a.score) return z.score - a.score;
    return a.id < z.id ? -1 : a.id > z.id ? 1 : 0;
  });
  return fused;
}
