import { afterEach, describe, expect, it, vi } from "vitest";

import type { Decision, Ticket } from "../../../agent/types";
import { __io, POST } from "./route";

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: 1,
  issue: "How long do tests stay active?",
  subject: "Test expiry",
  company: "HackerRank",
  ...over,
});

const decision = (over: Partial<Decision> = {}): Decision => ({
  status: "replied",
  request_type: "product_issue",
  product_area: "screen",
  response: "Tests stay active until you set an end date.",
  justification: "Corpus documents test expiry.",
  risk: "LOW",
  confidence: 0.9,
  sources: [],
  ...over,
});

function post(body: unknown): Request {
  return new Request("http://localhost/api/output", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("POST /api/output", () => {
  it("serializes results to the canonical CSV and writes via __io", async () => {
    const writes: { path: string; data: string }[] = [];
    vi.spyOn(__io, "write").mockImplementation((path, data) => writes.push({ path, data }));

    const res = await POST(
      post({
        results: [
          { ticket: ticket(), decision: decision() },
          { ticket: ticket({ id: 2, issue: "Site is down" }), decision: decision({ status: "escalated", request_type: "bug" }) },
        ],
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, written: 2 });
    expect(writes).toHaveLength(1);
    const lines = writes[0].data.trimEnd().split("\n");
    expect(lines[0]).toBe("issue,subject,company,response,product_area,status,request_type,justification");
    expect(lines).toHaveLength(3); // header + 2 records
    expect(writes[0].data).toContain("escalated");
  });

  it("rejects a non-array / empty results body with 400 (no write)", async () => {
    const spy = vi.spyOn(__io, "write").mockImplementation(() => {});
    expect((await POST(post({ results: [] }))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects results missing ticket.issue or decision.status with 400", async () => {
    const spy = vi.spyOn(__io, "write").mockImplementation(() => {});
    const res = await POST(post({ results: [{ ticket: { id: 1 }, decision: {} }] }));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});
