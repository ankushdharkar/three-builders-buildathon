/**
 * Corpus index: build a cached, deterministic article-level index from the loaded
 * corpus, and expose it through the `CorpusIndex` port.
 *
 * The cache (`data/index/corpus.json`, gitignored) lets retrieval (003) and the CLI
 * read the corpus without re-walking the filesystem each run. Building is idempotent —
 * `loadCorpus` is deterministic and the JSON is written stably — so the cache is
 * reproducible. Wired into the app by the composition root (001b's container); this
 * module never edits the container.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CorpusDoc, CorpusIndex } from "../ports";
import { DEFAULT_CORPUS_DIR, loadCorpus } from "./load";

const here = dirname(fileURLToPath(import.meta.url));
/** Repo-root `data/index/corpus.json` (gitignored). */
export const INDEX_PATH = resolve(here, "../../../../data/index/corpus.json");

interface IndexOpts {
  corpusDir?: string;
  indexPath?: string;
}

/** Load the corpus, write the cache (creating its dir), and return the docs. */
export function buildIndex(opts: IndexOpts = {}): CorpusDoc[] {
  const indexPath = opts.indexPath ?? INDEX_PATH;
  const docs = loadCorpus(opts.corpusDir ?? DEFAULT_CORPUS_DIR);
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, JSON.stringify(docs, null, 2) + "\n", "utf8");
  return docs;
}

/** Read the cached index; build it on demand if the cache is missing. */
export function loadIndex(opts: IndexOpts = {}): CorpusDoc[] {
  const indexPath = opts.indexPath ?? INDEX_PATH;
  try {
    return JSON.parse(readFileSync(indexPath, "utf8")) as CorpusDoc[];
  } catch {
    return buildIndex(opts);
  }
}

/**
 * The `CorpusIndex` port implementation. `docs()` is memoized per instance so repeated
 * reads (e.g. across many tickets) hit the cache once.
 */
export function createCorpusIndex(opts: IndexOpts = {}): CorpusIndex {
  let cache: CorpusDoc[] | null = null;
  return {
    async docs(): Promise<CorpusDoc[]> {
      if (cache === null) cache = loadIndex(opts);
      return cache;
    },
  };
}
