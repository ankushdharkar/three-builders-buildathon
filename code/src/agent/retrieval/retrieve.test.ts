// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { CorpusIndex, Embedder } from "../ports";
import { createRetriever } from "./retrieve";

const toyIndex: CorpusIndex = {
  async docs() {
    return [
      {
        id: "screen/system-check",
        title: "Run the System Check",
        category: "screen",
        body: "Run the System Check before a test to verify your browser, network, and webcam.",
        url: "https://support.hackerrank.com/screen/system-check",
      },
      {
        id: "interviews/codepair",
        title: "CodePair Overview",
        category: "interviews",
        body: "CodePair is the live collaborative interview environment for technical interviews.",
      },
      {
        id: "general-help/contact",
        title: "Contacting HackerRank Support",
        category: "general-help",
        body: "How to reach HackerRank support and what to include in a ticket.",
      },
    ];
  },
};

/** Keyword embedder whose semantics align with the toy docs (offline, deterministic). */
const toyEmbedder: Embedder = {
  async embed(texts) {
    return texts.map((t) => {
      const s = t.toLowerCase();
      return [
        s.includes("system") || s.includes("webcam") || s.includes("check") ? 1 : 0,
        s.includes("codepair") || s.includes("interview") ? 1 : 0,
        s.includes("support") || s.includes("contact") ? 1 : 0,
      ];
    });
  },
};

function makeRetriever() {
  // cachePath: null keeps the test offline + side-effect-free.
  return createRetriever({
    index: toyIndex,
    embedder: toyEmbedder,
    cachePath: null,
  });
}

describe("createRetriever (hybrid BM25 + embeddings via RRF)", () => {
  it("returns top-k fused Source[] with the relevant article first", async () => {
    const retriever = makeRetriever();
    const sources = await retriever.retrieve("my webcam fails the system check", { k: 2 });

    expect(sources).toHaveLength(2);
    expect(sources[0].articleId).toBe("screen/system-check");
  });

  it("populates every Source field, mapping doc.id → articleId", async () => {
    const retriever = makeRetriever();
    const [top] = await retriever.retrieve("webcam system check", { k: 1 });

    expect(top).toMatchObject({
      articleId: "screen/system-check",
      title: "Run the System Check",
      category: "screen",
      url: "https://support.hackerrank.com/screen/system-check",
    });
    expect(typeof top.score).toBe("number");
    expect(top.score).toBeGreaterThan(0);
    expect(top.snippet && top.snippet.length).toBeGreaterThan(0);
    expect(top.snippet!.toLowerCase()).toContain("system check");
  });

  it("omits url when the source doc has none", async () => {
    const retriever = makeRetriever();
    const sources = await retriever.retrieve("codepair interview environment", { k: 1 });
    expect(sources[0].articleId).toBe("interviews/codepair");
    expect(sources[0].url).toBeUndefined();
  });

  it("defaults k to 5 (capped by corpus size) and is deterministic", async () => {
    const retriever = makeRetriever();
    const a = await retriever.retrieve("system check");
    const b = await retriever.retrieve("system check");
    expect(a).toEqual(b);
    expect(a.length).toBe(3); // only 3 docs in the toy corpus
  });

  it("orders sources by descending fused score", async () => {
    const retriever = makeRetriever();
    const sources = await retriever.retrieve("system check webcam");
    const scores = sources.map((s) => s.score);
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);
  });
});
