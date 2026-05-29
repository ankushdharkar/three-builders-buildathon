import { describe, expect, it } from "vitest";
import {
  loadSampleTickets,
  loadSupportTickets,
  loadTicketsFromCsv,
} from "./tickets";

describe("loadTicketsFromCsv", () => {
  it("maps header columns to Ticket fields and assigns 1-based ids", () => {
    const csv =
      "issue,subject,company\n" +
      "editor won't load,Blank screen,HackerRank\n" +
      '"multi, line",,None\n';
    const tickets = loadTicketsFromCsv(csv);
    expect(tickets).toEqual([
      { id: 1, issue: "editor won't load", subject: "Blank screen", company: "HackerRank" },
      { id: 2, issue: "multi, line", subject: "", company: "None" },
    ]);
  });

  it("tolerates column reordering via the header", () => {
    const csv = "company,issue,subject\nHackerRank,it broke,oops\n";
    expect(loadTicketsFromCsv(csv)).toEqual([
      { id: 1, issue: "it broke", subject: "oops", company: "HackerRank" },
    ]);
  });
});

describe("loadSupportTickets (real CSV)", () => {
  it("parses the 16 graded tickets, each with issue/subject/company", () => {
    const tickets = loadSupportTickets();
    expect(tickets).toHaveLength(16);
    for (const t of tickets) {
      expect(typeof t.issue).toBe("string");
      expect(typeof t.subject).toBe("string");
      expect(typeof t.company).toBe("string");
      expect(t.issue.length).toBeGreaterThan(0);
    }
    expect(tickets[0].id).toBe(1);
    expect(tickets[15].id).toBe(16);
  });
});

describe("loadSampleTickets (real CSV with expected outputs)", () => {
  it("parses 7 sample rows, each carrying an expected partial Decision", () => {
    const samples = loadSampleTickets();
    expect(samples).toHaveLength(7);
    for (const s of samples) {
      expect(s.expected).toBeDefined();
      expect(s.expected?.status).toMatch(/^(replied|escalated)$/);
      expect(s.expected?.request_type).toMatch(
        /^(product_issue|feature_request|bug|invalid)$/,
      );
      expect(typeof s.expected?.product_area).toBe("string");
    }
  });

  it("reads the expected status/request_type/product_area for known rows", () => {
    const s = loadSampleTickets();
    expect(s[0].expected).toMatchObject({
      status: "replied",
      request_type: "product_issue",
      product_area: "screen",
    });
    // Site-down outage: escalated bug with no product area.
    expect(s[1].expected).toMatchObject({
      status: "escalated",
      request_type: "bug",
      product_area: "",
    });
    // Out-of-scope trivia: replied + invalid + conversation_management.
    expect(s[5].expected).toMatchObject({
      status: "replied",
      request_type: "invalid",
      product_area: "conversation_management",
    });
  });
});
