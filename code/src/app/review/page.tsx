import { MOCK_TICKETS } from "../../mock/tickets";

/**
 * Review route (D12 / B1) — the human-in-the-loop queue. Planned, not yet built: this
 * page previews the lane of tickets the agent routed for human review (low confidence,
 * high risk, a suggested new product area, or a fired safety flag) and what a reviewer
 * will be able to do. The contract hooks already exist (`Decision.needs_review`,
 * `urgency`, `confidence`, `suggested_product_area`), so this is a UI-only follow-up.
 */
export default function ReviewPage() {
  // Until `needs_review` is populated by the live pipeline, preview the gate on the mock
  // queue: escalated or low-confidence decisions are what would land here.
  const candidates = MOCK_TICKETS.filter(
    (t) => t.decision && (t.decision.status === "escalated" || t.decision.confidence < 0.7),
  );

  return (
    <div className="signal-canvas flex h-screen flex-col bg-background font-sans text-foreground">
      <header className="glass flex items-center gap-3 border-b border-hr-border px-6 py-3.5">
        <h1 className="font-display text-[15px] font-semibold tracking-tight">
          HackerRank <span className="font-normal text-hr-muted">Review Queue</span>
        </h1>
        <span className="rounded-full border border-hr-slate px-2.5 py-1 font-mono text-[10px] tracking-[0.15em] text-hr-muted">
          PLANNED · B1
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-[14px] leading-relaxed text-hr-muted">
            Uncertain decisions route here for a human instead of auto-finalizing — gated on low
            confidence, high risk, a detected new product area, or a fired safety flag. A reviewer
            will be able to confirm or override <span className="font-mono text-foreground/80">status</span>,{" "}
            <span className="font-mono text-foreground/80">request_type</span>, and{" "}
            <span className="font-mono text-foreground/80">product_area</span>, edit the response, mark
            it escalated-to-human, and leave a note. Rows sort by urgency, then confidence.
          </p>

          <div className="mt-6 flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hr-muted-dim">
              Would-be queue · {candidates.length}
            </span>
            <span className="h-px flex-1 bg-hr-border" />
          </div>

          <ul className="mt-3 space-y-2">
            {candidates.map((t) => (
              <li
                key={t.id}
                className="glass flex items-center gap-3 rounded-lg border border-hr-border px-4 py-3"
              >
                <span className="font-mono text-[11px] text-hr-muted-dim">
                  #{String(t.id).padStart(2, "0")}
                </span>
                <span className="flex-1 truncate text-[13px] text-foreground/85">{t.subject}</span>
                {t.decision?.urgency && (
                  <span className="rounded bg-hr-amber/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-hr-amber">
                    {t.decision.urgency}
                  </span>
                )}
                <span className="font-mono text-[11px] text-hr-muted">
                  conf {t.decision?.confidence.toFixed(2)}
                </span>
                <span className="cursor-not-allowed rounded border border-hr-border px-2 py-1 font-mono text-[10px] text-hr-muted-dim">
                  review →
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
