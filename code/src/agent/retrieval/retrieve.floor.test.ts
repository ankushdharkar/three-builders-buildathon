// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { Embedder } from "../ports";
import { createCorpusIndex } from "../corpus/index";
import { fakeEmbedder } from "../fakes";
import { createRetriever } from "./retrieve";

/**
 * Retrieval-floor guard (regression #10). The over-escalation regression was retrieval
 * returning ZERO sources for ordinary FAQ tickets, which `decide.ts` then escalated as
 * "no supporting corpus articles" — a silent accuracy drop no fake-based unit test caught.
 *
 * These tests run against the REAL corpus (`data/hackerrank/`), fully offline (a
 * deterministic stub embedder; in-memory vector cache), and assert the invariant the
 * pipeline relies on: a non-trivial query must retrieve at least one source. The second
 * test reproduces the actual failure mode — an embedder error must degrade to BM25, not
 * wipe out retrieval — so a provider hiccup can never again masquerade as "out of corpus".
 */

// Real corpus index, shared; embeddings kept in-memory (cachePath: null) — no disk, no
// stale-cache hazard.
const index = createCorpusIndex();

/** FAQ phrasings that clearly have lexical support in the HackerRank corpus. */
const FAQ_QUERIES = [
  "how long do tests stay active in the system",
  "how do I remove a user from my account",
  "update the name on my certificate",
  "add extra time accommodation for a candidate",
  "reschedule a candidate assessment",
];

describe("retrieval floor — real corpus", () => {
  it("returns ≥1 source for every known FAQ query (corpus + BM25 + fusion healthy)", async () => {
    const retriever = createRetriever({ index, embedder: fakeEmbedder, cachePath: null });
    for (const q of FAQ_QUERIES) {
      const sources = await retriever.retrieve(q);
      expect(sources.length, `no sources retrieved for: "${q}"`).toBeGreaterThan(0);
    }
  });

  it("degrades to BM25 (still ≥1 source) when the embedder fails — never total retrieval loss", async () => {
    const brokenEmbedder: Embedder = {
      async embed() {
        throw new Error("embeddings provider unavailable (e.g. 429 / network)");
      },
    };
    const retriever = createRetriever({ index, embedder: brokenEmbedder, cachePath: null });

    // Must NOT reject and must NOT return [] — otherwise decide.ts escalates as
    // "unsupported by the corpus" (the regression).
    const sources = await retriever.retrieve("how long do tests stay active in the system");
    expect(
      sources.length,
      "retrieve() must fall back to BM25 on embedder failure, not go empty",
    ).toBeGreaterThan(0);
  });
});
