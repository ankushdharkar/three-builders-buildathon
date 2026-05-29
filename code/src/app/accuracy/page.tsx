import { AccuracyView } from "../../dashboard/AccuracyView";
import { MOCK_ACCURACY } from "../../dashboard/mockAccuracy";

/**
 * Accuracy route (D12) — predictions vs. expected over the labelled sample set. Renders
 * mock data today (clearly flagged); swaps to the live scorer's `EvalReport`, built
 * server-side from the pipeline output, with no change to `<AccuracyView>`.
 */
export default function AccuracyPage() {
  return (
    <div className="signal-canvas flex h-screen flex-col bg-background font-sans text-foreground">
      <header className="glass flex items-center gap-3 border-b border-hr-border px-6 py-3.5">
        <h1 className="font-display text-[15px] font-semibold tracking-tight">
          HackerRank <span className="font-normal text-hr-muted">Accuracy</span>
        </h1>
        <span className="rounded-full border border-hr-amber/40 px-2.5 py-1 font-mono text-[10px] tracking-[0.15em] text-hr-amber">
          PREVIEW · MOCK DATA
        </span>
        <span className="ml-auto font-mono text-[11px] text-hr-muted-dim">pnpm agent:eval</span>
      </header>
      <AccuracyView data={MOCK_ACCURACY} />
    </div>
  );
}
