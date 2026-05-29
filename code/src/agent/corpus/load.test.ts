import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { categoryOf, loadCorpus } from "./load";
import { isProductArea } from "../types";

/** A tiny on-disk corpus fixture for precise behavior tests. */
function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "corpus-fixture-"));
  mkdirSync(join(root, "screen"), { recursive: true });
  writeFileSync(
    join(root, "screen", "a.md"),
    '---\ntitle: "Article A"\narticle_slug: "1001-article-a"\nsource_url: "https://support.hackerrank.com/articles/1001-a"\nbreadcrumbs:\n  - "Screen"\n  - "Tests"\n---\n\n# Article A\n\nBody of article A.\n',
  );
  // index.md must be excluded.
  writeFileSync(join(root, "screen", "index.md"), '---\ntitle: "Index"\n---\n\nexcluded\n');
  mkdirSync(join(root, "hackerrank_community"), { recursive: true });
  writeFileSync(
    join(root, "hackerrank_community", "b.md"),
    '---\ntitle: "Article B"\narticle_slug: "2002-article-b"\n---\n\nBody of article B.\n',
  );
  return root;
}

const fixture = makeFixture();
afterAll(() => rmSync(fixture, { recursive: true, force: true }));

describe("categoryOf", () => {
  it("maps top-level folders to D8 categories", () => {
    expect(categoryOf("hackerrank_community/x.md")).toBe("community");
    expect(categoryOf("uncategorized/x.md")).toBe("general-help");
    for (const f of [
      "screen",
      "interviews",
      "chakra",
      "library",
      "integrations",
      "settings",
      "engage",
      "skillup",
      "general-help",
    ]) {
      expect(categoryOf(`${f}/x.md`)).toBe(f);
    }
  });

  it("always returns a valid D8 area, even for an unknown folder", () => {
    expect(isProductArea(categoryOf("weird-folder/x.md"))).toBe(true);
  });
});

describe("loadCorpus (fixture)", () => {
  const docs = loadCorpus(fixture);

  it("excludes index.md and loads one CorpusDoc per article", () => {
    expect(docs).toHaveLength(2);
  });

  it("parses frontmatter into the CorpusDoc shape and strips it from the body", () => {
    const a = docs.find((d) => d.articleId === "1001-article-a")!;
    expect(a).toBeDefined();
    expect(a.title).toBe("Article A");
    expect(a.category).toBe("screen");
    expect(a.breadcrumbs).toEqual(["Screen", "Tests"]);
    expect(a.url).toBe("https://support.hackerrank.com/articles/1001-a");
    expect(a.body).not.toContain("article_slug:");
    expect(a.body.startsWith("---")).toBe(false);
    expect(a.body).toContain("Body of article A.");
  });

  it("defaults breadcrumbs to [] when absent and maps community", () => {
    const b = docs.find((d) => d.articleId === "2002-article-b")!;
    expect(b.category).toBe("community");
    expect(b.breadcrumbs).toEqual([]);
    expect(b.url).toBeUndefined();
  });

  it("sorts deterministically by articleId", () => {
    expect(docs.map((d) => d.articleId)).toEqual(["1001-article-a", "2002-article-b"]);
  });
});

describe("loadCorpus (real corpus)", () => {
  const docs = loadCorpus();

  it("loads > 400 articles, all with a valid D8 category", () => {
    expect(docs.length).toBeGreaterThan(400);
    for (const d of docs) {
      expect(d.articleId.length).toBeGreaterThan(0);
      expect(isProductArea(d.category)).toBe(true);
      expect(Array.isArray(d.breadcrumbs)).toBe(true);
    }
  });

  it("returns the same result on a second call (deterministic)", () => {
    expect(loadCorpus().map((d) => d.articleId)).toEqual(docs.map((d) => d.articleId));
  });
});
