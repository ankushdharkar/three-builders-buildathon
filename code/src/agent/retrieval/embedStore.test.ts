// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEmbedStore, type EmbedDoc } from "./embedStore";

const DOCS: EmbedDoc[] = [
  { id: "a", text: "fresh apple pie recipe" },
  { id: "b", text: "warm banana bread loaf" },
  { id: "c", text: "tart cherry pastry" },
];

/** A deterministic keyword embedder: [apple, banana, cherry] presence. */
function vec(text: string): number[] {
  const s = text.toLowerCase();
  return [
    s.includes("apple") ? 1 : 0,
    s.includes("banana") ? 1 : 0,
    s.includes("cherry") ? 1 : 0,
  ];
}
const fakeEmbed = (texts: string[]) => Promise.resolve(texts.map(vec));

let cacheDir: string;
let cachePath: string;

beforeEach(async () => {
  cacheDir = path.join(os.tmpdir(), `embedstore-test-${process.pid}`);
  await fs.rm(cacheDir, { recursive: true, force: true });
  cachePath = path.join(cacheDir, "embeddings.json");
});

afterEach(async () => {
  await fs.rm(cacheDir, { recursive: true, force: true });
});

describe("createEmbedStore", () => {
  it("returns the correct cosine top-k for a query", async () => {
    const store = createEmbedStore({
      docs: DOCS,
      embed: fakeEmbed,
      modelId: "test-model",
      cachePath,
    });
    const top = await store.search("a fresh apple", 1);
    expect(top).toHaveLength(1);
    expect(top[0].id).toBe("a");
    expect(top[0].score).toBeCloseTo(1, 10);
  });

  it("caches vectors keyed by modelId + id and persists them", async () => {
    const store = createEmbedStore({
      docs: DOCS,
      embed: fakeEmbed,
      modelId: "test-model",
      cachePath,
    });
    await store.ready();
    const raw = JSON.parse(await fs.readFile(cachePath, "utf8"));
    expect(Object.keys(raw).sort()).toEqual([
      "test-model:a",
      "test-model:b",
      "test-model:c",
    ]);
    expect(raw["test-model:a"]).toEqual([1, 0, 0]);
  });

  it("is idempotent: a second store re-uses the cache without re-embedding docs", async () => {
    await createEmbedStore({
      docs: DOCS,
      embed: fakeEmbed,
      modelId: "test-model",
      cachePath,
    }).ready();

    const spy = vi.fn(fakeEmbed);
    const store2 = createEmbedStore({
      docs: DOCS,
      embed: spy,
      modelId: "test-model",
      cachePath,
    });
    await store2.ready();
    // every doc vector came from cache → embed never called during ready()
    expect(spy).not.toHaveBeenCalled();

    // ranking still correct from the cached vectors
    const top = await store2.search("banana", 1);
    expect(top[0].id).toBe("b");
  });

  it("re-embeds when the modelId changes (cache key includes the model)", async () => {
    await createEmbedStore({
      docs: DOCS,
      embed: fakeEmbed,
      modelId: "model-one",
      cachePath,
    }).ready();

    const spy = vi.fn(fakeEmbed);
    await createEmbedStore({
      docs: DOCS,
      embed: spy,
      modelId: "model-two",
      cachePath,
    }).ready();
    expect(spy).toHaveBeenCalledTimes(1); // cache miss for the new model key

    const raw = JSON.parse(await fs.readFile(cachePath, "utf8"));
    expect(Object.keys(raw)).toContain("model-one:a");
    expect(Object.keys(raw)).toContain("model-two:a");
  });

  it("only embeds the missing docs, not the whole set", async () => {
    await createEmbedStore({
      docs: [DOCS[0]],
      embed: fakeEmbed,
      modelId: "test-model",
      cachePath,
    }).ready();

    const spy = vi.fn(fakeEmbed);
    await createEmbedStore({
      docs: DOCS,
      embed: spy,
      modelId: "test-model",
      cachePath,
    }).ready();
    // only b and c were missing
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].sort()).toEqual([
      "tart cherry pastry",
      "warm banana bread loaf",
    ]);
  });

  it("works in-memory when cachePath is null (no disk writes)", async () => {
    const store = createEmbedStore({
      docs: DOCS,
      embed: fakeEmbed,
      modelId: "test-model",
      cachePath: null,
    });
    const top = await store.search("cherry", 1);
    expect(top[0].id).toBe("c");
    await expect(fs.access(cachePath)).rejects.toThrow();
  });
});
