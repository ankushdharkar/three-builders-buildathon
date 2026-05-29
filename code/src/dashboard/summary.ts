import type { QueueState, RunState, TicketView } from "./viewModel";

/** Header-bar tallies derived from the current queue. */
export interface QueueSummary {
  total: number;
  done: number;
  replied: number;
  escalated: number;
  invalid: number;
  processing: number;
  queued: number;
  /** Fraction of tickets resolved, in [0, 1]. */
  progress: number;
  runState: RunState;
}

const RESOLVED: ReadonlySet<QueueState> = new Set(["replied", "escalated", "invalid"]);

/**
 * Compute the header tallies and overall run state from the queue. Pure: the same
 * tickets always yield the same summary, so it's trivially testable and the UI can
 * recompute it on every render without side effects.
 */
export function summarize(tickets: ReadonlyArray<TicketView>): QueueSummary {
  const count = (state: QueueState) => tickets.filter((t) => t.state === state).length;

  const replied = count("replied");
  const escalated = count("escalated");
  const invalid = count("invalid");
  const processing = count("processing");
  const queued = count("queued");

  const total = tickets.length;
  const done = tickets.filter((t) => RESOLVED.has(t.state)).length;
  const progress = total === 0 ? 0 : done / total;

  let runState: RunState;
  if (total === 0 || done + processing === 0) {
    runState = "IDLE";
  } else if (done === total) {
    runState = "DONE";
  } else {
    runState = "RUNNING";
  }

  return { total, done, replied, escalated, invalid, processing, queued, progress, runState };
}
