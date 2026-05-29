import { describe, expect, it } from "vitest";

import type { Source, Ticket } from "../types";
import type { Classification } from "./classify";
import type { RiskAssessment } from "./risk";
import { decide } from "./decide";

function ticket(company = "HackerRank"): Ticket {
  return { id: 1, issue: "issue body", subject: "", company };
}

function cls(over: Partial<Classification> = {}): Classification {
  return { request_type: "product_issue", product_area: "screen", confidence: 0.8, ...over };
}

const LOW: RiskAssessment = { risk: "LOW", signals: [] };
const HIGH: RiskAssessment = { risk: "HIGH", signals: ["refund"] };

function src(category = "screen", score = 0.9): Source {
  return { articleId: `${category}/a`, title: "t", category, score };
}

describe("decide", () => {
  it("escalates HIGH-risk tickets", () => {
    const r = decide(ticket(), cls(), HIGH, [src()]);
    expect(r.status).toBe("escalated");
    expect(r.responseKind).toBe("escalation");
  });

  it("escalates when the corpus does not support the ticket (no sources)", () => {
    const r = decide(ticket(), cls(), LOW, []);
    expect(r.status).toBe("escalated");
  });

  it("escalates and flags review on low confidence", () => {
    const r = decide(ticket(), cls({ confidence: 0.2 }), LOW, [src()]);
    expect(r.status).toBe("escalated");
    expect(r.needs_review).toBe(true);
  });

  it("escalates and flags review on a new-area suggestion", () => {
    const r = decide(
      ticket(),
      cls({ suggested_product_area: { value: "billing", reason: "x" }, product_area: "" }),
      LOW,
      [src()],
    );
    expect(r.status).toBe("escalated");
    expect(r.needs_review).toBe(true);
  });

  it("replies with a grounded answer for a supported, low-risk, confident ticket", () => {
    const r = decide(ticket(), cls(), LOW, [src()]);
    expect(r.status).toBe("replied");
    expect(r.responseKind).toBe("answer");
  });

  it("replies out-of-scope (not escalate) for company=None, low-risk, unsupported", () => {
    const r = decide(ticket("None"), cls({ request_type: "invalid" }), LOW, []);
    expect(r.status).toBe("replied");
    expect(r.responseKind).toBe("out_of_scope");
  });

  it("escalates an out-of-scope ticket when it is risky", () => {
    const r = decide(ticket("None"), cls(), HIGH, []);
    expect(r.status).toBe("escalated");
  });

  it("routes a full outage to bug + escalate", () => {
    const outage: RiskAssessment = { risk: "HIGH", signals: ["outage"] };
    const r = decide(ticket(), cls(), outage, [src()]);
    expect(r.request_type).toBe("bug");
    expect(r.status).toBe("escalated");
  });

  it("refuses prompt-injection as invalid (replied, flagged for review)", () => {
    const r = decide(ticket(), cls({ request_type: "invalid", refusal: "injection" }), LOW, []);
    expect(r.status).toBe("replied");
    expect(r.request_type).toBe("invalid");
    expect(r.responseKind).toBe("refuse_injection");
    expect(r.needs_review).toBe(true);
  });

  it("replies to courtesy with a brief decline", () => {
    const r = decide(ticket(), cls({ request_type: "invalid", refusal: "courtesy" }), LOW, []);
    expect(r.status).toBe("replied");
    expect(r.responseKind).toBe("decline_courtesy");
  });

  it("replies to trivia (invalid, no refusal flag) with a scope decline", () => {
    const r = decide(
      ticket(),
      cls({ request_type: "invalid", product_area: "conversation_management" }),
      LOW,
      [],
    );
    expect(r.status).toBe("replied");
    expect(r.responseKind).toBe("decline_trivia");
  });
});
