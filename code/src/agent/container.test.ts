import { afterEach, describe, expect, it } from "vitest";
import {
  getCorpus,
  getEmbedder,
  getLlm,
  getPipeline,
  getRetriever,
} from "./container";
import { fakes } from "./fakes";
import { loadSampleTickets } from "./tickets";
import type { PipelineEvent } from "./types";

const REAL_KEYS = [
  "REAL_CORPUS",
  "REAL_EMBEDDER",
  "REAL_LLM",
  "REAL_RETRIEVAL",
  "REAL_PIPELINE",
];

afterEach(() => {
  for (const k of REAL_KEYS) delete process.env[k];
});

describe("container — default (no flags) returns fakes", () => {
  it("wires every port to its fake", async () => {
    expect(await getEmbedder()).toBe(fakes.embedder);
    expect(await getLlm()).toBe(fakes.llm);
    expect(await getCorpus()).toBe(fakes.corpus);
    expect(await getRetriever()).toBe(fakes.retriever);
    expect(await getPipeline()).toBe(fakes.pipeline);
  });

  it("the fake pipeline produces a complete stream ending in final", async () => {
    const ticket = loadSampleTickets()[0];
    const pipeline = await getPipeline();
    const events: PipelineEvent[] = [];
    for await (const e of pipeline.run(ticket)) events.push(e);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => "sources" in e)).toBe(true);
    expect(events.at(-1)).toMatchObject({ stage: "final" });
  });
});

describe("container — flag on but module unconstructable falls back to fake", () => {
  it("does not throw when a real factory can't construct (llm/embedder missing keys)", async () => {
    process.env.REAL_LLM = "1";
    process.env.REAL_EMBEDDER = "1";
    // ./llm/client exists (004) but its factories throw without API keys set, so the
    // container catches and returns the fakes.
    expect(await getLlm()).toBe(fakes.llm);
    expect(await getEmbedder()).toBe(fakes.embedder);
  });
});

describe("container — real module present is used (REAL_PIPELINE, landed by 005)", () => {
  it("returns the real Pipeline (not the fake) when REAL_PIPELINE is on", async () => {
    process.env.REAL_PIPELINE = "1";
    const pipeline = await getPipeline();
    // ./pipeline/run now exists → real createPipeline (over fake retrieve+llm deps),
    // not the canned fake pipeline.
    expect(pipeline).not.toBe(fakes.pipeline);
    expect(typeof pipeline.run).toBe("function");
  });
});

describe("container — real module present is used (REAL_RETRIEVAL, landed by 003)", () => {
  it("returns the real Retriever (not the fake) when REAL_RETRIEVAL is on", async () => {
    process.env.REAL_RETRIEVAL = "1";
    const retriever = await getRetriever();
    // ./retrieval/retrieve now exists → real createRetriever (over fake corpus+embedder),
    // not the canned fake retriever.
    expect(retriever).not.toBe(fakes.retriever);
    expect(typeof retriever.retrieve).toBe("function");
  });
});

describe("container — real module present is used (REAL_CORPUS, landed by 002)", () => {
  it("returns the real CorpusIndex (not the fake) when REAL_CORPUS is on", async () => {
    process.env.REAL_CORPUS = "1";
    const corpus = await getCorpus();
    // ./corpus/index now exists → real impl, not the fake. (docs() not called here
    // to avoid building the on-disk index during a unit test.)
    expect(corpus).not.toBe(fakes.corpus);
    expect(typeof corpus.docs).toBe("function");
  });
});
