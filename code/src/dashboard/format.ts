import type { QueueState } from "../agent/types";

/** Visual tone used to pick colors for a badge (mapped to classes in the UI). */
export type BadgeTone = "success" | "warn" | "muted" | "active" | "idle";

export interface StatusBadge {
  symbol: string;
  label: string;
  tone: BadgeTone;
}

const BADGES: Record<QueueState, StatusBadge> = {
  replied: { symbol: "✓", label: "replied", tone: "success" },
  escalated: { symbol: "⤴", label: "escalated", tone: "warn" },
  invalid: { symbol: "⊘", label: "invalid", tone: "muted" },
  processing: { symbol: "▶", label: "processing", tone: "active" },
  queued: { symbol: "○", label: "queued", tone: "idle" },
};

/** Map a queue state to its badge symbol, label, and color tone. */
export function statusBadge(state: QueueState): StatusBadge {
  return BADGES[state];
}

export interface ConfidenceBars {
  filled: number;
  total: number;
}

/**
 * Quantize a confidence value in [0, 1] into `total` discrete segments (default 6),
 * rounding to the nearest segment and clamping out-of-range input. Drives the
 * `▰▰▰▰▰▱` confidence meter in the decision card.
 */
export function confidenceBars(value: number, total = 6): ConfidenceBars {
  const clamped = Math.min(1, Math.max(0, value));
  const filled = Math.min(total, Math.max(0, Math.round(clamped * total)));
  return { filled, total };
}
