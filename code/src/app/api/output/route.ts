/**
 * Output-CSV writer route (build prompt 008 — "regenerate output.csv on every fresh UI
 * start"). The Console's `LiveDashboard` POSTs its completed live run here, and this
 * route serializes the decisions to the graded `support_tickets/output.csv` using the
 * same canonical columns/serializer as the batch CLI (006), so the UI run and the CLI
 * produce an identical file format.
 *
 *   Method:   POST /api/output
 *   Request:  application/json → { results: { ticket: Ticket, decision: Decision }[] }
 *   Response: 200 { ok, written, path }  ·  400 { error } on bad input
 *
 * The file write is behind `__io` so tests can capture the payload without touching disk.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { OUTPUT_COLUMNS, toCsv, toOutputRecord } from "../../../agent/csv";
import type { Decision, Ticket } from "../../../agent/types";

/** Repo-root `support_tickets/output.csv` (Next runs with cwd = `code/`). */
const OUTPUT_PATH = resolve(process.cwd(), "..", "support_tickets", "output.csv");

/** Injection seam: tests override `write`/`path`; production writes the real file. */
export const __io: { write: (path: string, data: string) => void; path: string } = {
  write: (path, data) => writeFileSync(path, data, "utf8"),
  path: OUTPUT_PATH,
};

interface ResultItem {
  ticket: Ticket;
  decision: Decision;
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isResultItem(value: unknown): value is ResultItem {
  if (typeof value !== "object" || value === null) return false;
  const { ticket, decision } = value as { ticket?: unknown; decision?: unknown };
  const issueOk = typeof (ticket as { issue?: unknown })?.issue === "string";
  const decisionOk = typeof (decision as { status?: unknown })?.status === "string";
  return issueOk && decisionOk;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const results = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(results) || results.length === 0) {
    return badRequest("Body must be { results: [{ ticket, decision }, ...] } (non-empty).");
  }
  if (!results.every(isResultItem)) {
    return badRequest("Each result needs a ticket with an `issue` string and a decision with a `status`.");
  }

  const rows = (results as ResultItem[]).map((r) => {
    const rec = toOutputRecord(r.ticket, r.decision);
    return OUTPUT_COLUMNS.map((c) => rec[c]);
  });
  const csv = toCsv(OUTPUT_COLUMNS, rows);
  __io.write(__io.path, csv);

  return Response.json({ ok: true, written: rows.length, path: __io.path });
}
