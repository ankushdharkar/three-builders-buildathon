import { describe, expect, it } from "vitest";
import { escapeCsvCell, toCsv, toCsvRow } from "./csv";

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
