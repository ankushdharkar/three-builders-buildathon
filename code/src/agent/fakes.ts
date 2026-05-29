/**
 * Deterministic fakes for every port — a TEST-ONLY utility that tests inject directly.
 *
 * These let tests exercise the whole app end-to-end with no network and no real
 * modules: tests inject them in place of the ports under test, and every parallel unit
 * uses them to stand in for ports it consumes but doesn't own. Everything here is
 * deterministic (no randomness, no `Date.now`) so tests are stable.
 */

import { mockPipelineEvents } from "./mock";
import type {
  CorpusDoc,
  CorpusIndex,
  Embedder,
  LlmClient,
  Pipeline,
  Retriever,
} from "./ports";
import type { Decision, PipelineEvent, Source, Ticket } from "./types";

const EMBED_DIM = 16;

/** Deterministic, normalized pseudo-embedding from a string's char codes. */
function embedOne(text: string): number[] {
  const v = new Array<number>(EMBED_DIM).fill(0);
  for (let i = 0; i < text.length; i++) {
    v[i % EMBED_DIM] += text.charCodeAt(i);
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => Number((x / norm).toFixed(6)));
}

export const fakeEmbedder: Embedder = {
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(embedOne);
  },
};

/** A small canned corpus the fakes draw on, grounded in D8 categories. */
const FAKE_DOCS: CorpusDoc[] = [
  {
    articleId: "screen/system-check",
    title: "Run the HackerRank System Check",
    category: "screen",
    body: "Run the System Check before a test to verify browser, network, and webcam.",
    breadcrumbs: ["Screen"],
  },
  {
    articleId: "interviews/codepair-overview",
    title: "CodePair Overview",
    category: "interviews",
    body: "CodePair is the live collaborative interview environment.",
    breadcrumbs: ["Interviews"],
  },
  {
    articleId: "general-help/contact-support",
    title: "Contacting HackerRank Support",
    category: "general-help",
    body: "How to reach HackerRank support and what to include in a ticket.",
    breadcrumbs: ["General Help"],
  },
];

export const fakeCorpus: CorpusIndex = {
  async docs(): Promise<CorpusDoc[]> {
    return FAKE_DOCS;
  },
};

const FAKE_SOURCES: Source[] = FAKE_DOCS.map((d, i) => ({
  articleId: d.articleId,
  title: d.title,
  category: d.category,
  score: Number((0.9 - i * 0.1).toFixed(2)),
}));

export const fakeRetriever: Retriever = {
  async retrieve(_query: string, opts?: { k?: number }): Promise<Source[]> {
    const k = opts?.k ?? FAKE_SOURCES.length;
    return FAKE_SOURCES.slice(0, Math.max(1, k));
  },
};

/** A canned, Decision-shaped object for the fake LLM's JSON mode. */
const CANNED_DECISION: Omit<Decision, "sources"> = {
  status: "replied",
  request_type: "product_issue",
  product_area: "general-help",
  response: "This is a canned fake-LLM response grounded in the mock corpus.",
  justification: "Fake LLM output — deterministic, no network.",
  risk: "LOW",
  confidence: 0.7,
};

export const fakeLlm: LlmClient = {
  // Params are omitted (a narrower function is assignable to the wider port type) so
  // the canned fake stays lint-clean — it ignores schema/messages/opts by design.
  async chatJson<T>(): Promise<T> {
    return { ...CANNED_DECISION } as unknown as T;
  },
  async *chatStream(): AsyncIterable<string> {
    for (const chunk of ["This ", "is ", "a ", "canned ", "fake ", "stream."]) {
      yield chunk;
    }
  },
};

export const fakePipeline: Pipeline = {
  async *run(ticket: Ticket): AsyncIterable<PipelineEvent> {
    for (const event of mockPipelineEvents(ticket)) {
      yield event;
    }
  },
};

/** Bundle of every fake, injected by tests and used by parallel units. */
export const fakes = {
  embedder: fakeEmbedder,
  llm: fakeLlm,
  corpus: fakeCorpus,
  retriever: fakeRetriever,
  pipeline: fakePipeline,
} as const;
