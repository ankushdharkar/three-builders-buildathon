/**
 * Corpus loader: read the markdown knowledge base in `data/hackerrank/`, parse each
 * article's YAML frontmatter, and normalize it to a `CorpusDoc`.
 *
 * Ground truth for the agent is this corpus only (no outside knowledge). One doc per
 * `.md` file, excluding section `index.md` files. Each doc's top-level folder maps to a
 * D8 `product_area` category. Pure filesystem + parsing — no network — and deterministic
 * (sorted by `articleId`), so the index it feeds is reproducible.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import type { CorpusDoc } from "../ports";
import { isProductArea } from "../types";
import type { ProductArea } from "../types";

const here = dirname(fileURLToPath(import.meta.url));
/** Repo-root `data/hackerrank/` (../../../../ from src/agent/corpus/). */
export const DEFAULT_CORPUS_DIR = resolve(here, "../../../../data/hackerrank");

/** Folder names that don't match a D8 value 1:1. */
const CATEGORY_ALIASES: Record<string, ProductArea> = {
  hackerrank_community: "community",
  uncategorized: "general-help",
};

/**
 * Map a path's first segment (the top-level folder under `data/hackerrank/`) to a D8
 * category. Unknown folders fall back to `general-help` so the result is always valid.
 */
export function categoryOf(relPath: string): ProductArea {
  const segment = relPath.split(/[\\/]/).filter(Boolean)[0] ?? "";
  const mapped = CATEGORY_ALIASES[segment] ?? segment;
  return isProductArea(mapped) ? mapped : "general-help";
}

/** Recursively collect article `.md` files, excluding `index.md`. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md") {
      out.push(full);
    }
  }
  return out;
}

/** Load every article under `dir` into a deterministic, sorted `CorpusDoc[]`. */
export function loadCorpus(dir: string = DEFAULT_CORPUS_DIR): CorpusDoc[] {
  const root = resolve(dir);
  const docs = walk(root).map((file): CorpusDoc => {
    const relPath = file.slice(root.length + 1);
    const { data, content } = matter(readFileSync(file, "utf8"));
    const articleId = String(data.article_slug ?? relPath.replace(/\.md$/, ""));
    const breadcrumbs = Array.isArray(data.breadcrumbs)
      ? data.breadcrumbs.map((b) => String(b))
      : [];
    return {
      articleId,
      title: String(data.title ?? "").trim(),
      category: categoryOf(relPath),
      body: content.trim(),
      breadcrumbs,
      url: data.source_url ? String(data.source_url) : undefined,
    };
  });
  docs.sort((a, b) =>
    a.articleId < b.articleId ? -1 : a.articleId > b.articleId ? 1 : 0,
  );
  return docs;
}
