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

describe("container — flag on but real module absent falls back to fake", () => {
  it("does not throw when REAL_* points at an unbuilt module", async () => {
    process.env.REAL_LLM = "1";
    process.env.REAL_EMBEDDER = "1";
    process.env.REAL_CORPUS = "1";
    process.env.REAL_RETRIEVAL = "1";
    process.env.REAL_PIPELINE = "1";
    // None of ./llm/client, ./corpus/index, ./retrieval/retrieve, ./pipeline/run
    // exist yet — the container must try/catch and return the fakes.
    expect(await getLlm()).toBe(fakes.llm);
    expect(await getEmbedder()).toBe(fakes.embedder);
    expect(await getCorpus()).toBe(fakes.corpus);
    expect(await getRetriever()).toBe(fakes.retriever);
    expect(await getPipeline()).toBe(fakes.pipeline);
  });
});
