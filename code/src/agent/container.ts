/**
 * Composition root: wires the real agent modules together behind their ports.
 *
 * Each `get*` factory constructs the real implementation for its port and returns it.
 * This is the single place modules are composed — units implement their port and
 * never edit the container. The deterministic fakes in `fakes.ts` are a test-only
 * utility that tests inject directly; they are not used here.
 */

import { createCorpusIndex } from "./corpus/index";
import { createEmbedder, createLlm } from "./llm/client";
import { createRetriever } from "./retrieval/retrieve";
import { createPipeline } from "./pipeline/run";
import type {
  CorpusIndex,
  Embedder,
  LlmClient,
  Pipeline,
  Retriever,
} from "./ports";

export async function getEmbedder(): Promise<Embedder> {
  return createEmbedder();
}

export async function getLlm(): Promise<LlmClient> {
  return createLlm();
}

export async function getCorpus(): Promise<CorpusIndex> {
  return createCorpusIndex();
}

export async function getRetriever(): Promise<Retriever> {
  return createRetriever({ index: await getCorpus(), embedder: await getEmbedder() });
}

export async function getPipeline(): Promise<Pipeline> {
  return createPipeline({ retrieve: await getRetriever(), llm: await getLlm() });
}
