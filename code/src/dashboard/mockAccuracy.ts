/**
 * Illustrative accuracy data for the Accuracy screen (D12) until the live pipeline +
 * sample-set eval (`pnpm agent:eval`) run for real. Predictions are the decided mock
 * tickets; the "expected" column is the same labels with a couple of deliberate
 * overrides, so the screen shows real confusion structure (off-diagonal cells, a
 * non-trivial mismatch list) instead of a perfect — and uninformative — diagonal.
 *
 * This is mock data and the screen says so; it swaps to the real scorer's `EvalReport`
 * (built server-side from the pipeline's predictions vs. the sample expected outputs)
 * with no change to `<AccuracyView>`.
 */

import { MOCK_TICKETS } from "../mock/tickets";
import { buildConfusionMatrices, scoreSample, type AccuracyData } from "./confusion";
import type { Decision } from "../agent/types";

const decided = MOCK_TICKETS.filter((t) => t.decision);
const predictions: Decision[] = decided.map((t) => t.decision!);

// Pretend ground truth differs from the agent on two rows (keyed by ticket id).
const overrides: Record<number, Partial<Decision>> = {
  2: { product_area: "general-help" }, // agent chose `settings`; GT = `general-help`
  5: { request_type: "product_issue" }, // agent called the rescore a `bug`; GT = `product_issue`
};

const expected: Array<Partial<Decision>> = decided.map((t) => ({
  status: t.decision!.status,
  request_type: t.decision!.request_type,
  product_area: t.decision!.product_area,
  response: t.decision!.response,
  justification: t.decision!.justification,
  ...overrides[t.id],
}));

const subjects: Record<number, string> = Object.fromEntries(
  decided.map((t, i) => [i, t.subject]),
);

export const MOCK_ACCURACY: AccuracyData = {
  report: scoreSample(predictions, expected),
  matrices: buildConfusionMatrices(predictions, expected),
  subjects,
};
