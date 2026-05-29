/**
 * Risk step (005): a deterministic, rule-based risk band for a ticket.
 *
 * Risk is intentionally NOT an LLM call — routing-critical signals (money, PII, account
 * deletion, score manipulation, outages) must be reproducible and auditable, so they are
 * pattern rules over the ticket text. The band gates escalation in `decide.ts`. We return
 * the matched signals too, both for the justification string and the UI safety badges.
 */

import type { Risk, Ticket } from "../types";

export interface RiskAssessment {
  risk: Risk;
  /** Human-readable signal tags that fired (e.g. "refund", "pii", "outage"). */
  signals: string[];
}

interface Rule {
  signal: string;
  band: Risk;
  test: RegExp;
}

/** HIGH-risk rules: money, PII/secrets, irreversible/sensitive actions, integrity, outages. */
const HIGH_RULES: Rule[] = [
  { signal: "refund", band: "HIGH", test: /\brefunds?\b|\bmoney back\b|\bcharge ?back\b/i },
  {
    signal: "billing",
    band: "HIGH",
    test: /\b(billing|invoice|wrong charge|over ?charge|double ?charge|subscription|payment|credit card|debit card)\b/i,
  },
  { signal: "score-dispute", band: "HIGH", test: /\b(increase|raise|change|fix|boost|adjust|dispute)\b[\s\S]{0,30}\b(score|rating|rank|result)\b|\b(score|result)\b[\s\S]{0,20}\bunfair\b/i },
  {
    signal: "account-deletion",
    band: "HIGH",
    test: /\b(delete|close|deactivate|remove|wipe)\b[\s\S]{0,20}\b(my )?(account|profile|data)\b/i,
  },
  {
    signal: "outage",
    band: "HIGH",
    test: /\b(outage|entire (platform|site|system) (is )?down|everything is down|nobody can (access|log ?in)|whole (team|company) (is )?blocked|all (tests|candidates) (are )?(down|failing|blocked))\b/i,
  },
];

/** PII / secret patterns — independently push to HIGH and tag for log redaction. */
const PII_RULES: Rule[] = [
  { signal: "pii-email", band: "HIGH", test: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  { signal: "pii-order-id", band: "HIGH", test: /\border\s*#?\s*\d{4,}\b|#\d{6,}\b/i },
  { signal: "pii-card", band: "HIGH", test: /\b(?:\d[ -]?){13,16}\b|\bcard (ending|no\.?|number)\b/i },
  { signal: "secret-key", band: "HIGH", test: /\b(sk|pk|cs)_(live|test)_[a-z0-9]+\b|\bbearer\s+[a-z0-9._-]{12,}/i },
];

/** MED-risk rules: sensitive-but-not-critical (login/access, privacy, escalated tone). */
const MED_RULES: Rule[] = [
  { signal: "access", band: "MED", test: /\b(locked out|can('|no)?t log ?in|access denied|reset (my )?password|2fa|mfa)\b/i },
  { signal: "privacy", band: "MED", test: /\b(gdpr|privacy|personal data|data request|right to be forgotten)\b/i },
  { signal: "urgent", band: "MED", test: /\b(urgent|asap|immediately|deadline today|interview (today|in an hour|starting))\b/i },
];

export function assessRisk(ticket: Ticket): RiskAssessment {
  const text = `${ticket.subject ?? ""}\n${ticket.issue ?? ""}`;
  const signals: string[] = [];
  let band: Risk = "LOW";

  for (const rule of [...HIGH_RULES, ...PII_RULES, ...MED_RULES]) {
    if (rule.test.test(text)) {
      signals.push(rule.signal);
      if (rule.band === "HIGH") band = "HIGH";
      else if (rule.band === "MED" && band === "LOW") band = "MED";
    }
  }

  return { risk: band, signals };
}
