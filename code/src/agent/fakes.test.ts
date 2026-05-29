import { describe, expect, it } from "vitest";
import { fakeCorpus, fakeEmbedder, fakeLlm, fakeRetriever, fakePipeline } from "./fakes";
import { loadSampleTickets } from "./tickets";
import type { PipelineEvent } from "./types";

describe("fakeEmbedder", () => {
  it("returns one deterministic vector per input text", async () => {
    const vecs = await fakeEmbedder.embed(["hello", "world"]);
    expect(vecs).toHaveLength(2);
    expect(vecs[0]).toHaveLength(vecs[1].length);
    const again = await fakeEmbedder.embed(["hello"]);
    expect(again[0]).toEqual(vecs[0]); // deterministic
  });
});

describe("fakeRetriever", () => {
  it("returns up to k valid Sources", async () => {
    const sources = await fakeRetriever.retrieve("editor won't load", { k: 2 });
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources.length).toBeLessThanOrEqual(2);
    expect(sources[0]).toHaveProperty("articleId");
    expect(sources[0]).toHaveProperty("score");
  });
});

describe("fakeCorpus", () => {
  it("returns at least one CorpusDoc with articleId/title/body/breadcrumbs", async () => {
    const docs = await fakeCorpus.docs();
    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(docs[0]).toHaveProperty("articleId");
    expect(docs[0]).toHaveProperty("title");
    expect(docs[0]).toHaveProperty("body");
    expect(Array.isArray(docs[0].breadcrumbs)).toBe(true);
  });
});

describe("fakeLlm", () => {
  it("chatJson returns a canned object; chatStream yields non-empty chunks", async () => {
    const out = await fakeLlm.chatJson<{ status: string }>({}, [
      { role: "user", content: "triage this" },
    ]);
    expect(typeof out.status).toBe("string");
    let streamed = "";
    for await (const chunk of fakeLlm.chatStream([{ role: "user", content: "hi" }])) {
      streamed += chunk;
    }
    expect(streamed.length).toBeGreaterThan(0);
  });
});

describe("fakePipeline", () => {
  it("replays a full PipelineEvent stream ending in final", async () => {
    const ticket = loadSampleTickets()[0];
    const events: PipelineEvent[] = [];
    for await (const e of fakePipeline.run(ticket)) events.push(e);
    expect(events.at(-1)).toMatchObject({ stage: "final" });
    expect(events.some((e) => "sources" in e)).toBe(true);
  });
});
