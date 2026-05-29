import { describe, expect, it } from "vitest";
import { decide, runBatch } from "./run";
import { OUTPUT_COLUMNS, parseCsv } from "../agent/csv";
import { fakes } from "../agent/fakes";
import type { Pipeline } from "../agent/ports";
import type { Decision, PipelineEvent, Ticket } from "../agent/types";

function decision(over: Partial<Decision> = {}): Decision {
  return {
    status: "replied",
    request_type: "product_issue",
    product_area: "screen",
    response: "Grounded answer.",
    justification: "Because the corpus says so.",
    risk: "LOW",
    confidence: 0.8,
    sources: [],
    ...over,
  };
}

function ticket(id: number, over: Partial<Ticket> = {}): Ticket {
  return { id, issue: `issue ${id}`, subject: `subj ${id}`, company: "HackerRank", ...over };
}

/** A pipeline that emits a retrieve event then a final event keyed by ticket id. */
function pipelineFrom(byId: Record<number, Decision>): Pipeline {
  return {
    async *run(t: Ticket): AsyncIterable<PipelineEvent> {
      yield { stage: "retrieve", sources: [] };
      yield { stage: "final", decision: byId[t.id] };
    },
  };
}

describe("decide", () => {
  it("returns the Decision carried by the final event", async () => {
    const d = decision({ response: "captured" });
    const got = await decide(pipelineFrom({ 1: d }), ticket(1));
    expect(got.response).toBe("captured");
  });

  it("throws when the pipeline emits no final event", async () => {
    const noFinal: Pipeline = {
      async *run(): AsyncIterable<PipelineEvent> {
        // emits nothing — no final event
      },
    };
    await expect(decide(noFinal, ticket(1))).rejects.toThrow(/no final decision/i);
  });
});

describe("runBatch", () => {
  const tickets = [ticket(1), ticket(2), ticket(3)];
  const pipeline = pipelineFrom({
    1: decision({ product_area: "screen", status: "replied" }),
    2: decision({ product_area: "interviews", status: "escalated" }),
    3: decision({ product_area: "library", status: "replied" }),
  });

  it("produces exactly one output record per ticket, order-preserved", async () => {
    const { records } = await runBatch({ tickets, pipeline });
    expect(records).toHaveLength(3);
    expect(records.map((r) => r.product_area)).toEqual(["screen", "interviews", "library"]);
  });

  it("each record carries the input fields and decision columns", async () => {
    const { records } = await runBatch({ tickets, pipeline });
    expect(records[1]).toMatchObject({
      issue: "issue 2",
      subject: "subj 2",
      company: "HackerRank",
      product_area: "interviews",
      status: "escalated",
    });
  });

  it("writes CSV in the exact OUTPUT_COLUMNS order that round-trips via the 001 parser", async () => {
    const { csv } = await runBatch({ tickets, pipeline });
    const grid = parseCsv(csv);
    expect(grid[0]).toEqual([...OUTPUT_COLUMNS]);
    expect(grid).toHaveLength(4); // header + 3 rows
    // round-trip a representative row by column name
    const header = grid[0];
    const row2 = grid[2];
    const col = (name: string) => row2[header.indexOf(name)];
    expect(col("issue")).toBe("issue 2");
    expect(col("status")).toBe("escalated");
    expect(col("product_area")).toBe("interviews");
  });

  it("supports --limit by capping the number of processed tickets", async () => {
    const { records } = await runBatch({ tickets, pipeline, limit: 2 });
    expect(records.map((r) => r.product_area)).toEqual(["screen", "interviews"]);
  });

  it("treats a non-positive limit as no limit", async () => {
    const { records } = await runBatch({ tickets, pipeline, limit: 0 });
    expect(records).toHaveLength(3);
  });

  it("is deterministic — same input yields byte-identical CSV", async () => {
    const a = await runBatch({ tickets, pipeline });
    const b = await runBatch({ tickets, pipeline });
    expect(a.csv).toBe(b.csv);
  });

  it("reports progress per ticket", async () => {
    const seen: Array<[number, number]> = [];
    await runBatch({
      tickets,
      pipeline,
      onResult: (done, total) => seen.push([done, total]),
    });
    expect(seen).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("runs end-to-end against the shared fake pipeline", async () => {
    const { records, csv } = await runBatch({ tickets: [ticket(1)], pipeline: fakes.pipeline });
    expect(records).toHaveLength(1);
    expect(records[0].response.length).toBeGreaterThan(0);
    expect(parseCsv(csv)[0]).toEqual([...OUTPUT_COLUMNS]);
  });
});
