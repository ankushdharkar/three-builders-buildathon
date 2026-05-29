/**
 * Accuracy view-model (D12): turns predicted vs. expected decisions into the numbers
 * the Accuracy screen renders — per-column accuracy, all-enum exact-match rate,
 * free-form coverage, and a confusion matrix per enum column.
 *
 * The scored `EvalReport` shape is **imported from the CLI eval harness** (`cli/eval`)
 * rather than re-declared, so the screen and the `pnpm agent:eval` report speak one
 * vocabulary. The scoring/matrix logic here is a small, dependency-free mirror of that
 * harness's semantics (trim + lowercase exact match on `status`/`request_type`/
 * `product_area`; non-empty coverage on `response`/`justification`) so this module —
 * and the UI that imports it — never pulls the agent/container graph into the browser
 * bundle. Pure functions only.
 */

import type { Decision } from "../agent/types";
import type { ColumnScore, Disagreement, EvalReport } from "../cli/eval";

/** Closed-enum columns graded by exact (normalized) match. */
export const EXACT_COLUMNS = ["status", "request_type", "product_area"] as const;
export type ExactColumn = (typeof EXACT_COLUMNS)[number];

/** Free-form columns graded for non-empty coverage only. */
export const FREEFORM_COLUMNS = ["response", "justification"] as const;
export type FreeformColumn = (typeof FREEFORM_COLUMNS)[number];

/** A confusion matrix for one enum column: `counts[expectedIdx][predictedIdx]`. */
export interface ConfusionMatrix {
  column: ExactColumn;
  /** Sorted union of every expected/predicted value seen for this column. */
  labels: string[];
  counts: number[][];
  /** Diagonal sum — rows where expected === predicted. */
  correct: number;
  total: number;
}

/** Everything the Accuracy screen renders, assembled from prediction/expected pairs. */
export interface AccuracyData {
  report: EvalReport;
  matrices: ConfusionMatrix[];
  /** Optional row-index → ticket subject, to label disagreements. */
  subjects?: Record<number, string>;
  /** Optional row-index → ticket id, so a disagreement can deep-link into the console. */
  ticketIds?: Record<number, number>;
}

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function ratio(correct: number, total: number): number {
  return total === 0 ? 0 : correct / total;
}

/**
 * Score predictions against expected partials, pairwise by index (extra rows beyond
 * the shorter list are ignored). Mirrors the `cli/eval` harness so the UI and CLI agree.
 */
export function scoreSample(
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
      if (norm(expected[i][column]) !== norm(predictions[i][column])) {
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

/** Build an expected×predicted confusion matrix for each enum column. */
export function buildConfusionMatrices(
  predictions: Decision[],
  expected: Array<Partial<Decision>>,
): ConfusionMatrix[] {
  const total = Math.min(predictions.length, expected.length);

  return EXACT_COLUMNS.map((column) => {
    const labelSet = new Set<string>();
    for (let i = 0; i < total; i++) {
      labelSet.add(norm(expected[i][column]));
      labelSet.add(norm(predictions[i][column]));
    }
    const labels = [...labelSet].sort();
    const index = new Map(labels.map((l, i) => [l, i]));
    const counts = labels.map(() => labels.map(() => 0));

    let correct = 0;
    for (let i = 0; i < total; i++) {
      const e = index.get(norm(expected[i][column]))!;
      const p = index.get(norm(predictions[i][column]))!;
      counts[e][p]++;
      if (e === p) correct++;
    }

    return { column, labels, counts, correct, total };
  });
}
