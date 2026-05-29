/**
 * Server-side feature-flag parsing (D10).
 *
 * Each agent-core module sits behind a port with a fake; these flags decide, per
 * module, whether the composition root (`container.ts`) returns the real impl or the
 * fake. Default everywhere is OFF, so `main` always runs end-to-end on fakes with no
 * env set. A flag flips ON only once its real impl has landed.
 *
 * The on/off registry lives in `~/Workspaces/output/feature-flags.md` — keep the flag
 * set here in sync with it. The UI flag `NEXT_PUBLIC_TRIAGE_LIVE` is intentionally NOT
 * parsed here: it's a client flag read in the UI's `triageSource.ts` (008).
 */

export interface Flags {
  realCorpus: boolean;
  realEmbedder: boolean;
  realLlm: boolean;
  realRetrieval: boolean;
  realPipeline: boolean;
}

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function truthy(value: string | undefined): boolean {
  return value !== undefined && TRUTHY.has(value.trim().toLowerCase());
}

/** Parse the `REAL_*` server flags from an environment map (truthy → real). */
export function parseFlags(env: Record<string, string | undefined>): Flags {
  return {
    realCorpus: truthy(env.REAL_CORPUS),
    realEmbedder: truthy(env.REAL_EMBEDDER),
    realLlm: truthy(env.REAL_LLM),
    realRetrieval: truthy(env.REAL_RETRIEVAL),
    realPipeline: truthy(env.REAL_PIPELINE),
  };
}
