/**
 * Mock corpus article bodies for the Source detail drawer (D12).
 *
 * The drawer proves grounding by showing the corpus article behind a retrieved
 * `Source`. Until live retrieval is wired, `resolveMockSourceDoc` maps a `Source` to a
 * `SourceDoc` with a plausible, corpus-flavoured body + the snippet to highlight. Any
 * article not in the small catalog gets a synthesized body, so every source in the demo
 * opens to *something* (the data is "pristine"). Swaps to the real `CorpusDoc` loader
 * later — same `SourceDoc` shape, drop-in.
 */

import type { Source } from "../agent/types";
import type { SourceDoc } from "./viewModel";

interface CatalogEntry {
  body: string;
  /** Phrase to highlight in the body; falls back to the source's own snippet. */
  snippet: string;
}

const CATALOG: Record<string, CatalogEntry> = {
  "screen/system-check": {
    body: "Before starting a test, ask the candidate to run the HackerRank System Check. The System Check verifies the candidate's browser, internet connection, and (for proctored tests) webcam and microphone. If any check fails, the page lists the exact requirement that was not met and how to fix it. A blank or non-loading editor is most often caused by a failed browser check or a blocking extension.",
    snippet: "The System Check verifies the candidate's browser",
  },
  "screen/supported-browsers": {
    body: "HackerRank tests are supported on the latest two versions of Chrome and Edge. Safari and Firefox are not fully supported for the coding editor. Ad-blockers, script blockers, and corporate proxies can prevent the editor from loading; ask candidates to disable extensions or retry in an incognito window on a supported browser.",
    snippet: "disable extensions or retry in an incognito window",
  },
  "screen/editor-not-loading": {
    body: "If the code editor shows a blank screen and never loads, the cause is usually client-side. Steps: 1) run the System Check, 2) switch to the latest Chrome/Edge, 3) disable ad-blockers and extensions, 4) clear cache and retry in incognito. If the editor still fails after a passing System Check, capture the report and contact support to extend the deadline.",
    snippet: "the cause is usually client-side",
  },
  "settings/data-retention": {
    body: "Candidate data is retained per your plan's retention policy. Permanent deletion of candidate PII is handled as a formal data-deletion request and requires identity verification plus authorization from an account owner. These requests are processed by the Trust team and cannot be self-served from the dashboard.",
    snippet: "requires identity verification plus authorization from an account owner",
  },
  "settings/billing-refunds": {
    body: "Invoices and plan changes are managed under Billing in account settings. Refunds are not automatic: they are reviewed case-by-case by the Billing team and require the account owner to confirm the request. Submit refund requests through support so they can be verified before any charge is reversed.",
    snippet: "reviewed case-by-case by the Billing team",
  },
  "interviews/codepair-github": {
    body: "In a CodePair interview you can import a candidate's code directly from GitHub. Connect the GitHub account, choose the repository and branch, and the files load into the shared editor. GitHub is currently the only supported source-control provider for repo import in Interviews.",
    snippet: "GitHub is currently the only supported source-control provider",
  },
  "interviews/codepair-overview": {
    body: "CodePair is HackerRank's real-time collaborative interview environment. Interviewer and candidate share a code editor, run code together, and can use a whiteboard. Sessions can start from a question library, a blank pad, or imported code.",
    snippet: "real-time collaborative interview environment",
  },
  "screen/qualifying-score": {
    body: "The qualifying (cutoff) score determines the pass/fail flag shown on the leaderboard. Editing the qualifying score updates pass/fail flags for existing submissions to reflect the new threshold. For audits of how a specific test's scores changed over time, contact support with the test link.",
    snippet: "Editing the qualifying score updates pass/fail flags for existing submissions",
  },
  "screen/leaderboard": {
    body: "The test leaderboard ranks candidates by score and shows each candidate's pass/fail status against the current qualifying score. Columns can be sorted and the view exported. Pass/fail reflects the qualifying score at view time, not at submission time.",
    snippet: "pass/fail status against the current qualifying score",
  },
  "settings/team-roles": {
    body: "Team roles control what each member can do. Administrators manage tests and settings; Reviewers have read-only access to candidate reports and cannot edit tests or settings. Assign the Reviewer role to colleagues who should evaluate candidates without changing test configuration.",
    snippet: "Reviewers have read-only access to candidate reports and cannot edit tests",
  },
  "settings/invite-users": {
    body: "Invite teammates from Team Settings by entering their email and selecting a role. They receive an email to set a password and join your team. You can change or revoke a member's role at any time.",
    snippet: "entering their email and selecting a role",
  },
  "screen/proctoring-setup": {
    body: "Proctored tests require a working webcam and microphone, verified by the System Check. If the webcam connection drops mid-test, ask the candidate to check camera permissions, close other apps using the camera, and ensure a stable connection. Repeated drops should be reported so the session can be reviewed.",
    snippet: "check camera permissions, close other apps using the camera",
  },
  "screen/camera-troubleshooting": {
    body: "Webcam drops during a proctored test are usually caused by another application holding the camera, denied browser permissions, or an unstable network. Grant camera access to the browser, quit conferencing apps, and reconnect. The System Check can re-verify the camera before resuming.",
    snippet: "another application holding the camera, denied browser permissions",
  },
};

/** Resolve a retrieved `Source` to the article shown in the drawer (mock corpus). */
export function resolveMockSourceDoc(source: Source): SourceDoc {
  const entry = CATALOG[source.articleId];
  const base: SourceDoc = {
    articleId: source.articleId,
    title: source.title,
    category: source.category,
    url: source.url ?? `https://support.hackerrank.com/${source.articleId}`,
    snippet: source.snippet ?? entry?.snippet,
    body:
      entry?.body ??
      `This ${source.category} support article ("${source.title}") covers the steps and policies relevant to this request. The agent retrieved it as grounding for the response; the full text would load here from the corpus.`,
  };
  return base;
}
