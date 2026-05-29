/**
 * Shared, deterministic mock of the agent pipeline.
 *
 * This is the SINGLE mock that both the UI (008) and the streaming API tests (007)
 * consume, so all three layers exercise one contract and nothing drifts. It is
 * contract-pure: it imports only `./types` — no network, no fs, no React — and is
 * fully deterministic (no `Date.now`/randomness), so the same ticket always yields
 * the same decision and event stream.
 *
 * For the 7 sample tickets (which carry `expected` outputs) `mockDecision` echoes the
 * ground-truth labels, so the mock-driven UI shows realistic, corpus-aligned results
 * before the live pipeline lands.
 */

import { isProductArea } from "./types";
import type {
  Decision,
  PipelineEvent,
  ProductArea,
  Source,
  Stage,
  Ticket,
} from "./types";

const STAGES: Stage[] = ["retrieve", "classify", "risk", "decide", "respond"];

/** A small, plausible source catalog per product area (titles only — mock data). */
const SOURCE_CATALOG: Record<string, Array<{ articleId: string; title: string }>> = {
  screen: [
    { articleId: "screen/test-expiration", title: "When do tests expire?" },
    { articleId: "screen/time-accommodation", title: "Adding extra time for candidates" },
  ],
  interviews: [
    { articleId: "interviews/codepair-overview", title: "CodePair Overview" },
    { articleId: "interviews/repo-import", title: "Importing code in CodePair" },
  ],
  settings: [
    { articleId: "settings/team-roles", title: "Team Roles & Permissions" },
    { articleId: "settings/account-deletion", title: "Deleting your account" },
  ],
  community: [
    { articleId: "community/account-deletion", title: "Delete a Community account" },
    { articleId: "community/google-login", title: "Logging in with Google" },
  ],
  "general-help": [
    { articleId: "general-help/contact-support", title: "Contacting HackerRank Support" },
  ],
};

/** Deterministically synthesize 1–2 grounding sources for a product area. */
function mockSources(area: ProductArea): Source[] {
  const key = area && SOURCE_CATALOG[area] ? area : "general-help";
  const entries = SOURCE_CATALOG[key];
  return entries.map((e, i) => ({
    articleId: e.articleId,
    title: e.title,
    category: key,
    score: Number((0.9 - i * 0.12).toFixed(2)),
  }));
}

/**
 * Produce a deterministic mock `Decision` for a ticket. Where the ticket carries
 * `expected` outputs (the sample set), those graded labels are used verbatim so the
 * mock matches ground truth; missing fields fall back to safe defaults.
 */
export function mockDecision(ticket: Ticket): Decision {
  const e = ticket.expected ?? {};
  const status = e.status ?? "replied";
  const request_type = e.request_type ?? "product_issue";
  const product_area: ProductArea = isProductArea(e.product_area)
    ? e.product_area
    : "";
  const response =
    e.response ??
    `Thanks for reaching out about "${ticket.subject || ticket.issue.slice(0, 48)}". Here's what we found.`;
  const justification = e.justification ?? "Synthesized mock decision (no live agent).";
  const risk = status === "escalated" ? "HIGH" : "LOW";
  const confidence = status === "escalated" ? 0.55 : 0.85;
  return {
    status,
    request_type,
    product_area,
    response,
    justification,
    risk,
    confidence,
    sources: mockSources(product_area),
  };
}

/** Split text into deterministic chunks that concatenate back to the original. */
function chunkText(text: string, size = 24): string[] {
  if (text.length === 0) return [""];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    out.push(text.slice(i, i + size));
  }
  return out;
}

/**
 * Produce the ordered `PipelineEvent` stream the UI/API replay: a `start`/`done` pair
 * per stage, a `retrieve` carrying the sources, `respond` token deltas that
 * concatenate to the response, and a closing `final` event with the full decision.
 */
export function mockPipelineEvents(ticket: Ticket): PipelineEvent[] {
  const decision = mockDecision(ticket);
  const events: PipelineEvent[] = [];
  for (const stage of STAGES) {
    events.push({ stage, status: "start" });
    if (stage === "retrieve") {
      events.push({ stage: "retrieve", sources: decision.sources });
    }
    if (stage === "respond") {
      for (const tokenDelta of chunkText(decision.response)) {
        events.push({ stage: "respond", tokenDelta });
      }
    }
    events.push({ stage, status: "done", ms: 100 });
  }
  events.push({ stage: "final", decision });
  return events;
}
