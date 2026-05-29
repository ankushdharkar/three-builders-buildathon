import { describe, expect, it } from "vitest";

import type { Ticket } from "../types";
import { assessRisk } from "./risk";

function ticket(issue: string, subject = ""): Ticket {
  return { id: 1, issue, subject, company: "HackerRank" };
}

describe("assessRisk", () => {
  it("flags refunds as elevated risk", () => {
    expect(assessRisk(ticket("I want a refund for my subscription")).risk).not.toBe("LOW");
  });

  it("flags billing / wrong-charge tickets as elevated risk", () => {
    expect(assessRisk(ticket("There is a wrong charge on my invoice this month")).risk).not.toBe("LOW");
  });

  it("flags payment tickets carrying PII (order id, card, email) as HIGH", () => {
    const a = assessRisk(
      ticket("Payment failed for order #123456789, card ending 4242, email me at a@example.com"),
    );
    expect(a.risk).toBe("HIGH");
    expect(a.signals.join(" ")).toMatch(/pii|secret|payment|billing/i);
  });

  it("flags account deletion as elevated risk", () => {
    expect(assessRisk(ticket("Please delete my account permanently")).risk).not.toBe("LOW");
  });

  it("flags score-dispute tickets as HIGH", () => {
    expect(assessRisk(ticket("Please increase my score on the last test, it is unfair")).risk).toBe("HIGH");
  });

  it("flags a grade dispute via 'graded ... unfairly' even when wrapping corrupts a trigger word (009)", () => {
    // Real ticket data had a literal newline inside "increase" ("i\\nncrease"), which
    // defeats a \\b word-boundary match. The 'graded ... unfairly' phrasing is a robust,
    // general grade-dispute signal that must still escalate this.
    const a = assessRisk(
      ticket("Please review my answers, i\nncrease my score; the platform graded me unfairly."),
    );
    expect(a.risk).toBe("HIGH");
    expect(a.signals).toContain("score-dispute");
  });

  it("flags a full platform outage as HIGH", () => {
    expect(
      assessRisk(ticket("The entire platform is down, nobody on my team can access anything")).risk,
    ).toBe("HIGH");
  });

  it("flags a plain site-down / pages-inaccessible report as a HIGH outage (009)", () => {
    // Sample row 1: "site is down & none of the pages are accessible" — a site-wide
    // outage that must escalate. The narrower 'entire site is down' phrasing missed it.
    const a = assessRisk(ticket("site is down & none of the pages are accessible"));
    expect(a.risk).toBe("HIGH");
    expect(a.signals).toContain("outage");
  });

  it("does NOT treat a single-page load problem as an outage (no over-escalation)", () => {
    // Guard: one page/test not loading is an ordinary product issue, not a site outage.
    const a = assessRisk(ticket("My coding test page won't load when I click start"));
    expect(a.signals).not.toContain("outage");
  });

  it("treats a plain FAQ as LOW risk", () => {
    expect(assessRisk(ticket("How do I run the system check before my test?")).risk).toBe("LOW");
  });
});
