"use client";

import { useEffect } from "react";
import { splitHighlight } from "./highlight";
import type { SourceDoc } from "./viewModel";

/**
 * Source detail drawer (D12) — the grounding-proof surface. Slides in from the right
 * over the console when a retrieved source (or a `[src:n]` chip) is clicked, showing the
 * corpus article with the cited snippet highlighted. Closes on the ✕ button, the
 * backdrop, or Escape. Renders nothing when no doc is open, so it's safe to keep mounted.
 */
export function SourceDrawer({ doc, onClose }: { doc: SourceDoc | null; onClose: () => void }) {
  useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doc, onClose]);

  if (!doc) return null;

  const segments = splitHighlight(doc.body, doc.snippet);

  return (
    <div data-testid="source-drawer" className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Dismiss source overlay"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        className="signal-canvas glass relative flex h-full w-full max-w-md flex-col border-l border-hr-border-bright shadow-2xl"
        style={{ animation: "rise-in 0.32s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {/* Header */}
        <header className="flex items-start gap-3 border-b border-hr-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-hr-slate/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-hr-muted">
                {doc.category}
              </span>
              <span className="font-mono text-[11px] text-hr-muted-dim">{doc.articleId}</span>
            </div>
            <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug tracking-tight">
              {doc.title}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close source"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-hr-border text-hr-muted transition-colors hover:border-hr-border-bright hover:text-foreground"
          >
            ✕
          </button>
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {doc.body ? (
            <p className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-foreground/85">
              {segments.map((s, i) =>
                s.mark ? (
                  <mark
                    key={i}
                    className="rounded bg-hr-green/25 px-0.5 text-hr-green-bright ring-1 ring-inset ring-hr-green/40"
                  >
                    {s.text}
                  </mark>
                ) : (
                  <span key={i}>{s.text}</span>
                ),
              )}
            </p>
          ) : (
            <p className="font-mono text-[13px] text-hr-muted">Article body unavailable in the corpus.</p>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 border-t border-hr-border px-5 py-3">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-hr-muted-dim">
            <span className="dot dot-glow" style={{ "--dot": "var(--hr-green-bright)", fontSize: 7 } as React.CSSProperties} />
            Grounding source
          </span>
          {doc.url && (
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-hr-green-bright underline-offset-2 hover:underline"
            >
              Open in support center ↗
            </a>
          )}
        </footer>
      </section>
    </div>
  );
}
