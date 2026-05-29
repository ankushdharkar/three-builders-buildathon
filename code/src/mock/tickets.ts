import type { Ticket } from "../agent/types";

/**
 * Hand-authored mock queue for the first-impression dashboard. Values are realistic
 * HackerRank support scenarios grounded in the corpus categories (D8), but NOT real
 * agent output — this layer exists only so the UI is fully demoable before the live
 * pipeline lands. Every object is a valid `Ticket`, so replacing this with real agent
 * results later is a drop-in swap. Deterministic: no randomness, fixed ordering.
 */

const fullPipeline = (riskDetail: string): Ticket["pipeline"] => [
  { stage: "retrieve", status: "done", detail: "118ms" },
  { stage: "classify", status: "done", detail: "0.4s" },
  { stage: "risk", status: "done", detail: riskDetail },
  { stage: "decide", status: "done", detail: "0.2s" },
  { stage: "generate", status: "done", detail: "0.9s" },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 1,
    subject: "Candidate cannot start the coding test",
    company: "HackerRank",
    issue:
      "One of our candidates clicks 'Start Test' but the editor never loads. They see a blank screen on Chrome. Other candidates are fine. Deadline is today — please help.",
    state: "replied",
    decision: {
      status: "replied",
      requestType: "product_issue",
      productArea: "screen",
      confidence: 0.86,
      risk: "LOW",
      response:
        "This is usually a browser/extension conflict. Ask the candidate to run the System Check, disable ad-blockers, and retry in an incognito window or a supported browser (latest Chrome/Edge). If the editor still doesn't load, share the failed System Check report and we'll extend the deadline.",
      justification:
        "Corpus documents a System Check + supported-browser workaround for a blank/non-loading editor; low risk, no PII or account changes. [src: 1, 2]",
    },
    sources: [
      { id: "screen/system-check", title: "Run the HackerRank System Check", score: 0.92, category: "screen" },
      { id: "screen/supported-browsers", title: "Supported Browsers & Settings", score: 0.81, category: "screen" },
      { id: "screen/editor-not-loading", title: "Editor Fails to Load — Troubleshooting", score: 0.74, category: "screen" },
    ],
    pipeline: fullPipeline("LOW"),
  },
  {
    id: 2,
    subject: "Refund + delete all our candidate data immediately",
    company: "HackerRank",
    issue:
      "We are cancelling our plan. I want a full refund processed to my card and all candidate PII permanently deleted from your systems by end of day. Confirm in writing.",
    state: "escalated",
    decision: {
      status: "escalated",
      requestType: "product_issue",
      productArea: "settings",
      confidence: 0.79,
      risk: "HIGH",
      response:
        "I've escalated this to our Trust & Billing team. Billing refunds and GDPR/data-deletion requests require identity verification and an account owner's authorization, so a specialist will follow up by email with the formal process.",
      justification:
        "Billing action + bulk PII deletion are high-risk and require human verification per guardrails — not self-serve in the corpus. Escalated rather than guessing. [src: 4]",
    },
    sources: [
      { id: "settings/data-retention", title: "Data Retention & Deletion Requests", score: 0.7, category: "settings" },
      { id: "settings/billing-refunds", title: "Billing, Invoices & Refunds", score: 0.66, category: "settings" },
    ],
    pipeline: fullPipeline("HIGH"),
  },
  {
    id: 3,
    subject: "Add Bitbucket support to CodePair",
    company: "HackerRank",
    issue:
      "We use Bitbucket internally. It would be great if CodePair / Interviews could import a candidate's Bitbucket repo the way it does GitHub today.",
    state: "replied",
    decision: {
      status: "replied",
      requestType: "feature_request",
      productArea: "interviews",
      confidence: 0.74,
      risk: "LOW",
      response:
        "Thanks for the suggestion. Today Interviews supports GitHub import for bringing in candidate code; Bitbucket isn't supported yet. I've logged this as a feature request with our product team. In the meantime you can paste a repo zip or share files directly in the CodePair session.",
      justification:
        "Corpus confirms GitHub-only repo import for Interviews; Bitbucket absent. Logged as feature_request, offered the documented workaround. [src: 1]",
    },
    sources: [
      { id: "interviews/codepair-github", title: "Importing Code from GitHub in CodePair", score: 0.69, category: "interviews" },
      { id: "interviews/codepair-overview", title: "CodePair Overview", score: 0.58, category: "interviews" },
    ],
    pipeline: fullPipeline("LOW"),
  },
  {
    id: 4,
    subject: "FREE CRYPTO!!! claim your reward now",
    company: "None",
    issue:
      "Congratulations!!! You have been selected. Click http://not-a-real-link.example to claim 5 BTC. Reply STOP to opt out.",
    state: "invalid",
    decision: {
      status: "replied",
      requestType: "invalid",
      productArea: "conversation_management",
      confidence: 0.95,
      risk: "LOW",
      response:
        "This message doesn't appear to be a HackerRank support request, so there's nothing for us to action here. If you do have a HackerRank question, reply with details and we'll be glad to help.",
      justification:
        "Unsolicited spam, no HackerRank product context and company=None. Marked invalid; declined politely without engaging the link. [no src]",
    },
    sources: [],
    pipeline: fullPipeline("LOW"),
  },
  {
    id: 5,
    subject: "Scores look wrong after we changed the cutoff",
    company: "HackerRank",
    issue:
      "We edited the qualifying score on a live test and now the leaderboard shows different pass/fail flags than before. Did changing the cutoff retroactively rescore everyone? This affects an offer decision.",
    state: "escalated",
    decision: {
      status: "escalated",
      requestType: "bug",
      productArea: "screen",
      confidence: 0.62,
      risk: "MED",
      response:
        "Changing a qualifying score does update pass/fail flags, but a retroactive change on a live test affecting an offer decision needs a specialist to audit the score history for your specific test. I've escalated this with the test details so our team can confirm exactly what changed.",
      justification:
        "Corpus explains cutoff editing but not the retroactive-rescore edge case on a live test; medium risk (hiring decision). Low confidence → escalated for audit. [src: 1]",
    },
    sources: [
      { id: "screen/qualifying-score", title: "Setting & Editing the Qualifying Score", score: 0.77, category: "screen" },
      { id: "screen/leaderboard", title: "Reading the Test Leaderboard", score: 0.6, category: "screen" },
    ],
    pipeline: fullPipeline("MED"),
  },
  {
    id: 6,
    subject: "How do I invite teammates to review candidates?",
    company: "HackerRank",
    issue:
      "I'm an admin and want a couple of colleagues to review candidate reports without being able to change test settings. How do I add them with the right permissions?",
    state: "replied",
    decision: {
      status: "replied",
      requestType: "product_issue",
      productArea: "settings",
      confidence: 0.88,
      risk: "LOW",
      response:
        "From Team Settings, invite each colleague by email and assign them a Reviewer (read-only) role — Reviewers can open candidate reports but can't edit tests or settings. They'll get an email to set a password and join your team.",
      justification:
        "Corpus documents role-based team invites with a read-only Reviewer role matching the request exactly. High confidence, low risk. [src: 1, 2]",
    },
    sources: [
      { id: "settings/team-roles", title: "Team Roles & Permissions", score: 0.9, category: "settings" },
      { id: "settings/invite-users", title: "Inviting Users to Your Team", score: 0.83, category: "settings" },
    ],
    pipeline: fullPipeline("LOW"),
  },
  {
    id: 7,
    subject: "Facing a blocker — zoom connectivity during proctored test",
    company: "HackerRank",
    issue:
      "All system check criteria pass other than zoom/webcam connectivity. The candidate's camera keeps dropping during the proctored test. What should they do?",
    state: "processing",
    sources: [
      { id: "screen/system-check", title: "Run the HackerRank System Check", score: 0.91, category: "screen" },
      { id: "screen/proctoring-setup", title: "Proctoring Setup & Webcam Requirements", score: 0.85, category: "screen" },
      { id: "screen/camera-troubleshooting", title: "Webcam Drops — Troubleshooting", score: 0.72, category: "screen" },
    ],
    pipeline: [
      { stage: "retrieve", status: "done", detail: "120ms" },
      { stage: "classify", status: "done", detail: "0.4s" },
      { stage: "risk", status: "done", detail: "LOW" },
      { stage: "decide", status: "running" },
      { stage: "generate", status: "pending" },
    ],
  },
  {
    id: 8,
    subject: "Can candidates use their own IDE / VS Code?",
    company: "HackerRank",
    issue:
      "Some candidates ask if they can solve in their local VS Code instead of the in-browser editor. Is that supported, and does it affect plagiarism detection?",
    state: "queued",
    sources: [],
    pipeline: [],
  },
  {
    id: 9,
    subject: "Integrate HackerRank results with Greenhouse",
    company: "HackerRank",
    issue:
      "We want test results to flow into Greenhouse automatically against each candidate. Is there a native integration or do we need the API?",
    state: "queued",
    sources: [],
    pipeline: [],
  },
  {
    id: 10,
    subject: "(no subject)",
    company: "None",
    issue:
      "hi, is this where I ask about the python course certificate on SkillUp? I finished it but don't see the certificate in my profile.",
    state: "queued",
    sources: [],
    pipeline: [],
  },
  {
    id: 11,
    subject: "Bulk-invite 400 candidates from a CSV",
    company: "HackerRank",
    issue:
      "We're running a campus drive and need to invite ~400 candidates at once from a spreadsheet. Is there a bulk-invite, and are there sending limits we should know about?",
    state: "queued",
    sources: [],
    pipeline: [],
  },
  {
    id: 12,
    subject: "Question got leaked — need it removed from our test",
    company: "HackerRank",
    issue:
      "We think one of the questions in our active test was leaked online. We need it pulled and replaced, and to know if candidates who already attempted it are affected.",
    state: "queued",
    sources: [],
    pipeline: [],
  },
];
