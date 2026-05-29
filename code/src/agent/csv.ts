/**
 * RFC 4180 CSV serialization for writing `support_tickets/output.csv`.
 *
 * Agent responses routinely contain commas, double quotes, and newlines, so every
 * cell must be quoted/escaped correctly or the output CSV becomes unparseable and
 * unscoreable. This module is part of the headless agent core — it imports nothing
 * UI- or Next-specific, so it runs identically in the batch CLI and in tests.
 */

import type { Decision, Ticket } from "./types";

/**
 * Escape a single CSV cell per RFC 4180. A field is wrapped in double quotes when it
 * contains a comma, double quote, CR, or LF; embedded double quotes are doubled.
 * `null`/`undefined` serialize to an empty cell.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Serialize one row of cells into a CSV line (no trailing newline). */
export function toCsvRow(cells: ReadonlyArray<string | number | null | undefined>): string {
  return cells.map(escapeCsvCell).join(",");
}

/**
 * Serialize a header row plus data rows into a full CSV document.
 * Lines are joined with `\n` and the document ends with a trailing newline.
 */
export function toCsv(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
): string {
  const lines = [toCsvRow(headers), ...rows.map(toCsvRow)];
  return lines.join("\n") + "\n";
}

/**
 * Parse a CSV document into a 2D array of cells, per RFC 4180. Handles quoted fields
 * containing commas, doubled quotes, and embedded newlines (LF or CRLF). Outside a
 * quoted field, a bare CR is dropped and an LF ends the row, so CRLF row breaks work;
 * inside quotes every character — including CR/LF — is preserved verbatim. A trailing
 * newline does not produce an empty final row.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawField = false; // distinguishes a real (possibly empty) cell from "no data"

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      sawField = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
      sawField = true;
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      sawField = false;
    } else if (c === "\r") {
      // Drop bare CR outside quotes; a following LF will close the row.
    } else {
      field += c;
      sawField = true;
    }
  }
  if (sawField || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Parse a tickets CSV (header + rows) into `Ticket`s. Header-aware, so column order
 * is irrelevant as long as `issue`, `subject`, and `company` are present. `id` is the
 * 1-based row index. Extra columns (e.g. the sample's expected outputs) are ignored
 * here — `loadSampleTickets` in `tickets.ts` reads those into `Ticket.expected`.
 */
export function parseTickets(text: string): Ticket[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const iIssue = header.indexOf("issue");
  const iSubject = header.indexOf("subject");
  const iCompany = header.indexOf("company");
  return rows.slice(1).map((r, i) => ({
    id: i + 1,
    issue: iIssue >= 0 ? (r[iIssue] ?? "") : "",
    subject: iSubject >= 0 ? (r[iSubject] ?? "") : "",
    company: iCompany >= 0 ? (r[iCompany] ?? "") : "",
  }));
}

/**
 * Exact column order of the graded `support_tickets/output.csv` (and the sample CSV).
 * The batch CLI writes columns in this order; do not reorder.
 */
export const OUTPUT_COLUMNS = [
  "issue",
  "subject",
  "company",
  "response",
  "product_area",
  "status",
  "request_type",
  "justification",
] as const;

export type OutputColumn = (typeof OUTPUT_COLUMNS)[number];

/**
 * Project a ticket + its decision onto the graded output columns. Keys are inserted
 * in `OUTPUT_COLUMNS` order so `OUTPUT_COLUMNS.map((c) => rec[c])` yields cells in the
 * correct order for `toCsv`.
 */
export function toOutputRecord(
  ticket: Ticket,
  decision: Decision,
): Record<OutputColumn, string> {
  return {
    issue: ticket.issue,
    subject: ticket.subject,
    company: ticket.company,
    response: decision.response,
    product_area: decision.product_area,
    status: decision.status,
    request_type: decision.request_type,
    justification: decision.justification,
  };
}
