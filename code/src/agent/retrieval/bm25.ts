/**
 * In-house BM25 ranking over a document set (D5 retrieval, prompt 003).
 *
 * Pure and deterministic — the same docs + query always yield the same ranking, with
 * ties broken by ascending doc id so output is stable across runs. No network, no I/O.
 * Built once from the corpus (002's index) over `title + body`; the result is fused
 * with embedding cosine via RRF in `retrieve.ts`.
 */

/** A document to index. Callers pass `text = title + "\n" + body`. */
export interface Bm25Doc {
  id: string;
  text: string;
}

/** An id with a relevance score. Shared with `rrf.ts` and `embedStore.ts`. */
export interface Scored {
  id: string;
  score: number;
}

export interface Bm25Index {
  /** Ranked best-first; ties broken by ascending id. `k` undefined → all docs. */
  search(query: string, k?: number): Scored[];
}

/** Lowercase, split on runs of non-alphanumerics, drop empties. Deterministic. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

export interface Bm25Opts {
  /** Term-frequency saturation. Okapi default 1.5. */
  k1?: number;
  /** Length-normalization strength in [0,1]. Okapi default 0.75. */
  b?: number;
}

/** Compare by descending score, then ascending id — a stable, deterministic order. */
function byScoreThenId(a: Scored, z: Scored): number {
  if (z.score !== a.score) return z.score - a.score;
  return a.id < z.id ? -1 : a.id > z.id ? 1 : 0;
}

/** Build a BM25 index over `docs` (Okapi BM25; defaults k1=1.5, b=0.75). */
export function buildBm25(docs: Bm25Doc[], opts: Bm25Opts = {}): Bm25Index {
  const k1 = opts.k1 ?? 1.5;
  const b = opts.b ?? 0.75;

  const n = docs.length;
  const tokensByDoc = docs.map((d) => tokenize(d.text));
  const lenByDoc = tokensByDoc.map((t) => t.length);
  const avgdl = n > 0 ? lenByDoc.reduce((s, l) => s + l, 0) / n : 0;

  // term frequency per doc + document frequency per term
  const tfByDoc: Array<Map<string, number>> = tokensByDoc.map((toks) => {
    const m = new Map<string, number>();
    for (const t of toks) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  });
  const df = new Map<string, number>();
  for (const tf of tfByDoc) {
    for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }

  // Robertson/Sparck-Jones IDF, floored at 0 so terms in >half the docs can't
  // contribute negatively.
  function idf(term: string): number {
    const dft = df.get(term) ?? 0;
    return Math.max(0, Math.log(1 + (n - dft + 0.5) / (dft + 0.5)));
  }

  function search(query: string, k?: number): Scored[] {
    const qTerms = tokenize(query);
    const scored: Scored[] = docs.map((d, i) => {
      const len = lenByDoc[i];
      let score = 0;
      for (const term of qTerms) {
        const f = tfByDoc[i].get(term);
        if (!f) continue;
        const denom = f + k1 * (1 - b + (b * len) / (avgdl || 1));
        score += idf(term) * ((f * (k1 + 1)) / denom);
      }
      return { id: d.id, score };
    });
    scored.sort(byScoreThenId);
    return k === undefined ? scored : scored.slice(0, Math.max(0, k));
  }

  return { search };
}
