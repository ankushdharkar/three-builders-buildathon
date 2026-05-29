/**
 * Sample-set eval harness — scores the agent's predictions against the expected
 * outputs in `support_tickets/sample_support_tickets.csv` (build prompt 006). This is
 * our prompt-iteration loop: a quantitative read on the **Output CSV** rubric
 * dimension before submission.
 *
 * Grading (mirrors the eval-harness scorer's semantics, snake_case-native against the
 * 001 `Decision` contract):
 *  - `status`, `request_type`, `product_area` are closed enums → graded by **exact
 *    match**, normalized (trim + lowercase). An empty `product_area` is a valid value.
 *  - `response`, `justification` are free-form → a deterministic checker can't grade
 *    correctness, so we report **non-empty coverage** only; semantic quality is left to
 *    the AI Judge (CLAUDE.md §5).
 *
 * `evaluate` is a pure function; `main` wires it to the real-or-fake pipeline from the
 * container and the sample loader, so `pnpm agent:eval` runs end-to-end on fakes.
 *
 * Usage: `pnpm agent:eval [--limit N]`
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { getPipeline } from "../agent/container";
import { loadSampleTickets } from "../agent/tickets";
import type { Decision } from "../agent/types";
import { decide } from "./run";

/** Closed-enum columns graded by exact (normalized) match. */
export const EXACT_COLUMNS = ["status", "request_type", "product_area"] as const;
export type ExactColumn = (typeof EXACT_COLUMNS)[number];

/** Free-form columns graded for non-empty coverage only. */
export const FREEFORM_COLUMNS = ["response", "justification"] as const;
export type FreeformColumn = (typeof FREEFORM_COLUMNS)[number];

export interface ColumnScore {
  column: string;
  correct: number;
  total: number;
  /** `correct / total`, or 0 when `total === 0`. */
  accuracy: number;
}

export interface Disagreement {
  index: number;
  column: ExactColumn;
  expected: string;
  predicted: string;
}

export interface EvalReport {
  total: number;
  /** Per-enum-column exact-match accuracy. */
  columns: ColumnScore[];
  /** Per-free-form-column non-empty coverage. */
  coverage: ColumnScore[];
  /** Rows where every enum column matched. */
  exactMatchRows: number;
  exactMatchAccuracy: number;
  disagreements: Disagreement[];
}

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function ratio(correct: number, total: number): number {
  return total === 0 ? 0 : correct / total;
}

/**
 * Compare predicted decisions against expected partials, pairwise by index. Extra
 * predictions or expecteds beyond the shorter list are ignored.
 */
export function evaluate(
  predictions: Decision[],
  expected: Array<Partial<Decision>>,
): EvalReport {
  const total = Math.min(predictions.length, expected.length);

  const columns: ColumnScore[] = EXACT_COLUMNS.map((column) => {
    let correct = 0;
    for (let i = 0; i < total; i++) {
      if (norm(expected[i][column]) === norm(predictions[i][column])) correct++;
    }
    return { column, correct, total, accuracy: ratio(correct, total) };
  });

  const coverage: ColumnScore[] = FREEFORM_COLUMNS.map((column) => {
    let correct = 0;
    for (let i = 0; i < total; i++) {
      if (norm(predictions[i][column]).length > 0) correct++;
    }
    return { column, correct, total, accuracy: ratio(correct, total) };
  });

  const disagreements: Disagreement[] = [];
  let exactMatchRows = 0;
  for (let i = 0; i < total; i++) {
    let allMatch = true;
    for (const column of EXACT_COLUMNS) {
      const exp = norm(expected[i][column]);
      const pred = norm(predictions[i][column]);
      if (exp !== pred) {
        allMatch = false;
        disagreements.push({
          index: i,
          column,
          expected: String(expected[i][column] ?? ""),
          predicted: String(predictions[i][column] ?? ""),
        });
      }
    }
    if (allMatch) exactMatchRows++;
  }

  return {
    total,
    columns,
    coverage,
    exactMatchRows,
    exactMatchAccuracy: ratio(exactMatchRows, total),
    disagreements,
  };
}

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

/** Render an `EvalReport` as a human-readable CLI summary. */
export function formatEvalReport(report: EvalReport): string {
  const lines: string[] = [];
  lines.push(`Sample-set eval — ${report.total} ticket(s)`);
  lines.push("");
  lines.push("Per-column accuracy (exact match):");
  for (const c of report.columns) {
    lines.push(`  ${c.column.padEnd(14)} ${pct(c.accuracy).padStart(6)}  (${c.correct}/${c.total})`);
  }
  lines.push("");
  lines.push("Free-form coverage (non-empty):");
  for (const c of report.coverage) {
    lines.push(`  ${c.column.padEnd(14)} ${pct(c.accuracy).padStart(6)}  (${c.correct}/${c.total})`);
  }
  lines.push("");
  lines.push(
    `Exact-match rows (all enum columns): ${pct(report.exactMatchAccuracy)} (${report.exactMatchRows}/${report.total})`,
  );

  if (report.disagreements.length > 0) {
    lines.push("");
    lines.push(`Disagreements (${report.disagreements.length}):`);
    for (const d of report.disagreements) {
      lines.push(`  row ${d.index} · ${d.column}: expected "${d.expected}" got "${d.predicted}"`);
    }
  }

  return lines.join("\n");
}

/** CLI entry point: run the pipeline on the sample set and print the eval report. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  let limit: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit") limit = Number(argv[++i]);
    else if (argv[i].startsWith("--limit=")) limit = Number(argv[i].slice("--limit=".length));
  }

  const all = loadSampleTickets();
  const tickets = limit && limit > 0 ? all.slice(0, limit) : all;
  const pipeline = await getPipeline();

  const predictions: Decision[] = [];
  const expected: Array<Partial<Decision>> = [];
  for (const ticket of tickets) {
    predictions.push(await decide(pipeline, ticket));
    expected.push(ticket.expected ?? {});
  }

  console.log(formatEvalReport(evaluate(predictions, expected)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
