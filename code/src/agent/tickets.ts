/**
 * Ticket loaders for the support-triage agent.
 *
 * `support_tickets/` lives at the repo root (a sibling of `code/`, outside `src/`),
 * so paths are resolved relative to this module's location rather than `process.cwd()`
 * — that keeps loading identical whether invoked from the CLI, a test, or the API.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseCsv, parseTickets } from "./csv";
import type { Decision, ProductArea, RequestType, Status, Ticket } from "./types";

const here = dirname(fileURLToPath(import.meta.url));
/** Repo-root `support_tickets/` dir (../../../ from src/agent/). */
const TICKETS_DIR = resolve(here, "../../../support_tickets");
const SUPPORT_CSV = resolve(TICKETS_DIR, "support_tickets.csv");
const SAMPLE_CSV = resolve(TICKETS_DIR, "sample_support_tickets.csv");

/** Parse tickets from raw CSV text (header-aware). */
export function loadTicketsFromCsv(text: string): Ticket[] {
  return parseTickets(text);
}

/** Load and parse a tickets CSV from disk. */
export function loadTicketsFromFile(path: string): Ticket[] {
  return loadTicketsFromCsv(readFileSync(path, "utf8"));
}

/** Load the 16 graded tickets the agent must triage into `output.csv`. */
export function loadSupportTickets(): Ticket[] {
  return loadTicketsFromFile(SUPPORT_CSV);
}

/**
 * Load the 7 sample tickets, parsing their expected-output columns into
 * `Ticket.expected` (a partial `Decision`) so the eval harness can compare
 * predictions against ground truth.
 */
export function loadSampleTickets(): Ticket[] {
  const rows = parseCsv(readFileSync(SAMPLE_CSV, "utf8"));
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const iIssue = idx("issue");
  const iSubject = idx("subject");
  const iCompany = idx("company");
  const iResponse = idx("response");
  const iArea = idx("product_area");
  const iStatus = idx("status");
  const iType = idx("request_type");
  const iJust = idx("justification");

  return rows.slice(1).map((r, i) => {
    const cell = (j: number) => (j >= 0 ? (r[j] ?? "") : "");
    const expected: Partial<Decision> = {
      status: cell(iStatus) as Status,
      request_type: cell(iType) as RequestType,
      product_area: cell(iArea) as ProductArea,
      response: cell(iResponse),
      justification: cell(iJust),
    };
    return {
      id: i + 1,
      issue: cell(iIssue),
      subject: cell(iSubject),
      company: cell(iCompany),
      expected,
    };
  });
}
