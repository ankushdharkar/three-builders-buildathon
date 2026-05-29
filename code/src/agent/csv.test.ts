import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OUTPUT_COLUMNS,
  escapeCsvCell,
  parseCsv,
  parseTickets,
  toCsv,
  toCsvRow,
  toOutputRecord,
} from "./csv";
import type { Decision, Ticket } from "./types";

const here = dirname(fileURLToPath(import.meta.url));
const supportCsv = resolve(here, "../../../support_tickets/support_tickets.csv");

describe("escapeCsvCell", () => {
  it("leaves plain values unquoted", () => {
    expect(escapeCsvCell("replied")).toBe("replied");
    expect(escapeCsvCell("Test Active")).toBe("Test Active");
  });

  it("quotes values containing a comma", () => {
    expect(escapeCsvCell("billing, account")).toBe('"billing, account"');
  });

  it("quotes and doubles embedded double quotes", () => {
    expect(escapeCsvCell('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("quotes values containing newlines (CR or LF)", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("serializes null/undefined as an empty cell", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("stringifies numbers", () => {
    expect(escapeCsvCell(0)).toBe("0");
    expect(escapeCsvCell(42)).toBe("42");
  });
});

describe("toCsvRow", () => {
  it("joins escaped cells with commas", () => {
    expect(toCsvRow(["replied", "billing, account", 'q"x'])).toBe(
      'replied,"billing, account","q""x"',
    );
  });
});

describe("toCsv", () => {
  it("emits a header row, data rows, and a trailing newline", () => {
    const csv = toCsv(
      ["status", "response"],
      [
        ["replied", "Tests remain active indefinitely."],
        ["escalated", "Routing to a human, see: a, b, c"],
      ],
    );
    expect(csv).toBe(
      "status,response\n" +
        "replied,Tests remain active indefinitely.\n" +
        'escalated,"Routing to a human, see: a, b, c"\n',
    );
  });

  it("round-trips an embedded-newline response inside one quoted field", () => {
    const csv = toCsv(["response"], [["Hi,\n\nThanks for reaching out."]]);
    expect(csv).toBe('response\n"Hi,\n\nThanks for reaching out."\n');
  });
});

describe("parseCsv (RFC 4180)", () => {
  it("parses plain rows into a 2D array", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas, quotes, and embedded newlines", () => {
    const text = 'name,note\n"Doe, Jane","she said ""hi""\nsecond line"\n';
    expect(parseCsv(text)).toEqual([
      ["name", "note"],
      ["Doe, Jane", 'she said "hi"\nsecond line'],
    ]);
  });

  it("treats CRLF as a row break but preserves CRLF inside quotes", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsv('x\n"line1\r\nline2"\n')).toEqual([["x"], ["line1\r\nline2"]]);
  });

  it("does not emit a trailing empty row for a final newline", () => {
    expect(parseCsv("a\nb\n")).toEqual([["a"], ["b"]]);
  });

  it("keeps the last row when the file has no trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("serialize/parse round-trip", () => {
  it("parse(serialize(rows)) === rows for gnarly content", () => {
    const headers = ["status", "response"];
    const rows = [
      ["replied", "Tests stay active, indefinitely."],
      ["escalated", 'He said "go", then\nleft.'],
      ["replied", ""],
    ];
    const round = parseCsv(toCsv(headers, rows));
    expect(round).toEqual([headers, ...rows]);
  });
});

describe("parseTickets (real support_tickets.csv)", () => {
  it("parses 16 tickets, each with issue/subject/company and a 1-based id", () => {
    const tickets = parseTickets(readFileSync(supportCsv, "utf8"));
    expect(tickets).toHaveLength(16);
    expect(tickets[0].id).toBe(1);
    for (const t of tickets) {
      expect(t).toHaveProperty("issue");
      expect(t).toHaveProperty("subject");
      expect(t).toHaveProperty("company");
    }
  });
});

describe("OUTPUT_COLUMNS + toOutputRecord", () => {
  it("declares the exact graded output column order", () => {
    expect(OUTPUT_COLUMNS).toEqual([
      "issue",
      "subject",
      "company",
      "response",
      "product_area",
      "status",
      "request_type",
      "justification",
    ]);
  });

  it("maps a ticket + decision onto the output columns (camelCase agnostic)", () => {
    const ticket: Ticket = {
      id: 1,
      issue: "editor won't load",
      subject: "Blank screen",
      company: "HackerRank",
    };
    const decision: Decision = {
      status: "replied",
      request_type: "product_issue",
      product_area: "screen",
      response: "Run the System Check.",
      justification: "Corpus documents this workaround.",
      risk: "LOW",
      confidence: 0.86,
      sources: [],
    };
    const rec = toOutputRecord(ticket, decision);
    expect(Object.keys(rec)).toEqual([...OUTPUT_COLUMNS]);
    expect(OUTPUT_COLUMNS.map((c) => rec[c])).toEqual([
      "editor won't load",
      "Blank screen",
      "HackerRank",
      "Run the System Check.",
      "screen",
      "replied",
      "product_issue",
      "Corpus documents this workaround.",
    ]);
  });
});
