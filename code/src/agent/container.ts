/**
 * Composition root (D10): returns fake-or-real per port, driven by feature flags.
 *
 * Default (no flags set) → every port is the fake, so the whole app runs end-to-end
 * today. When a `REAL_*` flag is on, the matching real module is dynamic-imported and
 * its `create*` factory is used; if that module isn't built/merged yet (or throws on
 * construction), we **fall back to the fake** rather than crashing. That makes turning
 * a flag on early completely safe, and lets 002–005 land independently.
 *
 * Only this file (and `flags.ts`) wires modules together — units implement their port
 * and never edit the container. Flags are read per call from `process.env` so the CLI,
 * the API route, and tests all see the current environment.
 *
 * Real factories the container expects (announce to 002–005):
 *   ./corpus/index      → createCorpusIndex(): CorpusIndex
 *   ./llm/client        → createEmbedder(): Embedder
 *   ./llm/client        → createLlm(): LlmClient
 *   ./retrieval/retrieve→ createRetriever({ index, embedder }): Retriever
 *   ./pipeline/run      → createPipeline({ retrieve, llm }): Pipeline
 */

import { parseFlags } from "./flags";
import { fakes } from "./fakes";
import type {
  CorpusIndex,
  Embedder,
  LlmClient,
  Pipeline,
  Retriever,
} from "./ports";

function flagsNow() {
  return parseFlags(process.env as Record<string, string | undefined>);
}

/**
 * Return the fake unless `enabled`, in which case dynamic-import `path`, build the real
 * impl via `make`, and return it — falling back to the fake if the module is missing or
 * construction throws. `path` is a variable so the bundler can't hard-resolve a
 * not-yet-existent module; `@vite-ignore` silences the dynamic-import analysis warning.
 */
async function load<T>(
  enabled: boolean,
  path: string,
  make: (mod: Record<string, unknown>) => T | Promise<T>,
  fake: T,
): Promise<T> {
  if (!enabled) return fake;
  try {
    const mod = (await import(/* @vite-ignore */ /* webpackIgnore: true */ path)) as Record<
      string,
      unknown
    >;
    return await make(mod);
  } catch {
    return fake; // real impl not built yet / failed to construct → fake
  }
}

type Factory<T> = () => T;

export function getEmbedder(): Promise<Embedder> {
  return load(
    flagsNow().realEmbedder,
    "./llm/client",
    (m) => (m.createEmbedder as Factory<Embedder>)(),
    fakes.embedder,
  );
}

export function getLlm(): Promise<LlmClient> {
  return load(
    flagsNow().realLlm,
    "./llm/client",
    (m) => (m.createLlm as Factory<LlmClient>)(),
    fakes.llm,
  );
}

export function getCorpus(): Promise<CorpusIndex> {
  return load(
    flagsNow().realCorpus,
    "./corpus/index",
    (m) => (m.createCorpusIndex as Factory<CorpusIndex>)(),
    fakes.corpus,
  );
}

export function getRetriever(): Promise<Retriever> {
  return load(
    flagsNow().realRetrieval,
    "./retrieval/retrieve",
    async (m) =>
      (
        m.createRetriever as (deps: {
          index: CorpusIndex;
          embedder: Embedder;
        }) => Retriever
      )({ index: await getCorpus(), embedder: await getEmbedder() }),
    fakes.retriever,
  );
}

export function getPipeline(): Promise<Pipeline> {
  return load(
    flagsNow().realPipeline,
    "./pipeline/run",
    async (m) =>
      (
        m.createPipeline as (deps: {
          retrieve: Retriever;
          llm: LlmClient;
        }) => Pipeline
      )({ retrieve: await getRetriever(), llm: await getLlm() }),
    fakes.pipeline,
  );
}
