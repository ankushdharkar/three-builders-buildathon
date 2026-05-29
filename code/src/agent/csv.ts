/**
 * RFC 4180 CSV serialization for writing `support_tickets/output.csv`.
 *
 * Agent responses routinely contain commas, double quotes, and newlines, so every
 * cell must be quoted/escaped correctly or the output CSV becomes unparseable and
 * unscoreable. This module is part of the headless agent core — it imports nothing
 * UI- or Next-specific, so it runs identically in the batch CLI and in tests.
 */

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
