import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildIndex, createCorpusIndex, loadIndex } from "./index";

function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "corpus-idx-"));
  mkdirSync(join(root, "settings"), { recursive: true });
  writeFileSync(
    join(root, "settings", "a.md"),
    '---\ntitle: "Roles"\narticle_slug: "3003-roles"\n---\n\nRole management.\n',
  );
  return root;
}

const corpusDir = makeFixture();
const tmp = mkdtempSync(join(tmpdir(), "corpus-out-"));
const indexPath = join(tmp, "corpus.json");

afterAll(() => {
  rmSync(corpusDir, { recursive: true, force: true });
  rmSync(tmp, { recursive: true, force: true });
});

describe("buildIndex / loadIndex", () => {
  it("writes the cache and round-trips identical docs", () => {
    const built = buildIndex({ corpusDir, indexPath });
    expect(built.length).toBe(1);
    const loaded = loadIndex({ indexPath });
    expect(loaded).toEqual(built);
  });

  it("is idempotent — building twice yields byte-identical output", () => {
    const first = readFileSync(indexPath, "utf8");
    const second = buildIndex({ corpusDir, indexPath });
    expect(readFileSync(indexPath, "utf8")).toBe(first);
    expect(second).toEqual(loadIndex({ indexPath }));
  });
});

describe("createCorpusIndex (CorpusIndex port)", () => {
  it("docs() returns the cached corpus", async () => {
    buildIndex({ corpusDir, indexPath });
    const index = createCorpusIndex({ indexPath });
    const docs = await index.docs();
    expect(docs).toHaveLength(1);
    expect(docs[0].articleId).toBe("3003-roles");
    expect(docs[0].category).toBe("settings");
  });
});
