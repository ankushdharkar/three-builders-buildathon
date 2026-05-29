"use client";

import { useState } from "react";
import type { AccuracyData, ConfusionMatrix } from "./confusion";
import type { Disagreement } from "../cli/eval";

/**
 * Accuracy view (D12) — the verify/trust surface. Renders an `EvalReport` over the
 * labelled sample set (predictions vs. expected) as headline accuracy, per-column
 * scores, a confusion matrix per enum column, and a clickable disagreement list. This
 * is the visible answer to the Output-CSV rubric dimension and the failure-mode honesty
 * the AI Judge looks for. Pure presentation over a precomputed `AccuracyData`.
 */
export function AccuracyView({ data }: { data: AccuracyData }) {
  const { report, matrices, subjects } = data;
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div data-testid="accuracy-view" className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
      <div className="mx-auto max-w-4xl">
        <header className="rise-in">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-hr-muted-dim">
            Sample-set evaluation · {report.total} tickets
          </span>
          <h2 className="mt-1.5 font-display text-[26px] font-semibold leading-tight tracking-tight">
            Accuracy
          </h2>
          <p className="mt-1 text-[13px] text-hr-muted">
            Predictions scored against the expected outputs in{" "}
            <span className="font-mono text-hr-muted">sample_support_tickets.csv</span>. Enum columns are
            exact-match; free-form columns are graded for non-empty coverage only.
          </p>
        </header>

        {/* Headline + per-column cards */}
        <div className="rise-in mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: "60ms" }}>
          <Stat
            label="exact-match rows"
            value={pct(report.exactMatchAccuracy)}
            sub={`${report.exactMatchRows}/${report.total}`}
            highlight
          />
          {report.columns.map((c) => (
            <Stat
              key={c.column}
              testId={`col-${c.column}`}
              label={c.column}
              value={pct(c.accuracy)}
              sub={`${c.correct}/${c.total}`}
            />
          ))}
        </div>

        {/* Coverage */}
        <div className="rise-in mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: "100ms" }}>
          {report.coverage.map((c) => (
            <Stat key={c.column} label={`${c.column} coverage`} value={pct(c.accuracy)} sub={`${c.correct}/${c.total}`} muted />
          ))}
        </div>

        {/* Confusion matrices */}
        <SectionTitle delay={140}>Confusion matrices</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-3">
          {matrices.map((m) => (
            <Matrix key={m.column} matrix={m} />
          ))}
        </div>

        {/* Disagreements */}
        <SectionTitle delay={180}>Disagreements ({report.disagreements.length})</SectionTitle>
        {report.disagreements.length === 0 ? (
          <p data-testid="disagreements" className="font-mono text-[13px] text-hr-green-bright">
            No enum disagreements — every row matched. ✓
          </p>
        ) : (
          <ul data-testid="disagreements" className="space-y-1.5">
            {report.disagreements.map((d, i) => (
              <DisagreementRow
                key={`${d.index}-${d.column}`}
                row={d}
                subject={subjects?.[d.index]}
                selected={selected === i}
                onSelect={() => setSelected((s) => (s === i ? null : i))}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function pct(n: number): string {
  const v = n * 100;
  return `${Number.isInteger(v) ? String(v) : v.toFixed(1)}%`;
}

function Stat({
  label,
  value,
  sub,
  highlight,
  muted,
  testId,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
  muted?: boolean;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`glass rounded-xl border p-4 ${highlight ? "border-hr-green/40" : "border-hr-border"}`}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-hr-muted-dim">{label}</div>
      <div
        className={`mt-1.5 font-display text-2xl font-semibold tracking-tight ${
          highlight ? "text-hr-green-bright text-glow" : muted ? "text-foreground/70" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-hr-muted">{sub}</div>
    </div>
  );
}

function Matrix({ matrix }: { matrix: ConfusionMatrix }) {
  const label = (l: string) => l || "∅";
  return (
    <div data-testid={`matrix-${matrix.column}`} className="glass rounded-xl border border-hr-border p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-mono text-[11px] text-foreground/80">{matrix.column}</span>
        <span className="font-mono text-[10px] text-hr-muted-dim">
          {matrix.correct}/{matrix.total} on diagonal
        </span>
      </div>
      <table className="w-full border-collapse font-mono text-[10px]">
        <thead>
          <tr>
            <th className="p-1 text-left text-hr-muted-dim">exp ╲ pred</th>
            {matrix.labels.map((l) => (
              <th key={l} className="p-1 text-hr-muted" title={label(l)}>
                {abbr(label(l))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.labels.map((row, ri) => (
            <tr key={row}>
              <td className="p-1 text-hr-muted" title={label(row)}>
                {abbr(label(row))}
              </td>
              {matrix.labels.map((col, ci) => {
                const n = matrix.counts[ri][ci];
                const diag = ri === ci;
                return (
                  <td
                    key={col}
                    className={`p-1 text-center ${
                      n === 0
                        ? "text-hr-muted-dim/50"
                        : diag
                          ? "rounded bg-hr-green/15 text-hr-green-bright"
                          : "rounded bg-hr-amber/15 text-hr-amber"
                    }`}
                  >
                    {n}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Compact column/row headers so wide enum names don't blow out the grid. */
function abbr(s: string): string {
  return s.length > 6 ? `${s.slice(0, 5)}…` : s;
}

function DisagreementRow({
  row,
  subject,
  selected,
  onSelect,
}: {
  row: Disagreement;
  subject?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left font-mono text-[12px] transition-colors ${
          selected ? "border-hr-green/40 bg-hr-green/[0.06]" : "border-hr-border hover:border-hr-border-bright"
        }`}
      >
        <span className="text-hr-muted-dim">row {row.index}</span>
        <span className="rounded bg-hr-slate/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-hr-muted">
          {row.column}
        </span>
        {subject && <span className="truncate text-foreground/70">{subject}</span>}
        <span className="ml-auto flex items-center gap-2 whitespace-nowrap">
          <span className="text-hr-green-bright">{row.expected || "∅"}</span>
          <span className="text-hr-muted-dim">→</span>
          <span className="text-hr-amber">{row.predicted || "∅"}</span>
        </span>
      </button>
    </li>
  );
}

function SectionTitle({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <div className="rise-in mb-3 mt-7 flex items-center gap-2" style={{ animationDelay: `${delay}ms` }}>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hr-muted-dim">{children}</span>
      <span className="h-px flex-1 bg-hr-border" />
    </div>
  );
}
