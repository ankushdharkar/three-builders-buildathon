/**
 * Layer 1 of the malicious-input / prompt-injection defense (D11).
 *
 * Every ticket field is attacker-controlled, untrusted data. This module runs at the
 * parser boundary (see `tickets.ts`) so no raw field reaches the reasoning pipeline. It
 * does NOT block or mutate the stored ticket — it produces a *cleaned copy* plus a
 * structured `SafetyFlags` verdict that downstream steps (risk/classify, Layer 2/3) and
 * the UI consume. Detection is heuristic and intentionally conservative: false positives
 * here only nudge a ticket toward `needs_review`/escalation, never silent data loss.
 *
 * Defense layers (full plan: ~/Workspaces/output/to-do.md → Security):
 *   L1 (here)  — normalize unicode, cap length, flag injection/secret/PII.
 *   L2 (005)   — wrap untrusted text in an isolation fence (see `fenceUntrusted`).
 *   L3 (005)   — validate LLM output against enums; injection → `invalid` + decline.
 *   L4 (007/8) — redact secrets in logs (`redactSecrets`); UI "injection neutralized" badge.
 */

import type { SafetyFlags, Ticket, TicketSafety } from "./types";

/**
 * Per-field length caps. Bound token cost and resist context-stuffing attacks that try
 * to push our system instructions out of the model's window.
 *
 * TODO(D11): these caps are a first guess — tune against the real `support_tickets.csv`
 * once 002/005 land so we never truncate a legitimate long ticket. Longest sample issue
 * is well under 8k chars today.
 */
export const MAX_ISSUE_LEN = 8000;
export const MAX_SUBJECT_LEN = 500;
export const MAX_COMPANY_LEN = 100;

/** Empty (all-clear) flag set. */
function emptyFlags(): SafetyFlags {
  return {
    injection_suspected: false,
    matched_rules: [],
    contains_secret: false,
    contains_pii: false,
    unicode_obfuscation: false,
    truncated: false,
  };
}

/**
 * Prompt-injection heuristics. Each rule has a stable `id` (surfaced in the UI / logs)
 * and a regex. These are signals, not a guarantee — Layer 2 (prompt isolation) and
 * Layer 3 (output validation) are the structural defenses; this just raises the flag
 * that steers classify→`invalid` and risk→escalate.
 *
 * TODO(D11): heuristics are inherently incomplete (paraphrase, encoding, multilingual
 * attacks evade them). Revisit once we see real adversarial tickets; consider an
 * LLM-based injection classifier as a second opinion when `injection_suspected` is set.
 */
export const INJECTION_RULES: ReadonlyArray<{ id: string; re: RegExp }> = [
  {
    id: "ignore-previous",
    re: /\b(ignore|disregard|forget|override)\b[\s\S]{0,40}?\b(previous|prior|above|earlier|preceding|all|the)\b[\s\S]{0,30}?\b(instruction|instructions|prompt|prompts|message|messages|context|rule|rules)\b/i,
  },
  {
    id: "override-role",
    re: /\b(you\s+are\s+now|act\s+as|pretend\s+(to\s+be|that|you)|from\s+now\s+on\s+you|new\s+(instructions|rules)\s*:)\b/i,
  },
  {
    id: "reveal-prompt",
    re: /\b(reveal|show|print|repeat|reproduce|leak|expose)\b[\s\S]{0,30}?\b(system\s+prompt|your\s+(instructions|prompt|rules)|the\s+prompt|initial\s+prompt)\b/i,
  },
  // A line that begins with a chat-role label is an attempt to forge conversation turns.
  { id: "role-marker", re: /^[\s>*-]*?(system|assistant|developer)\s*[:：]/im },
  // Fake structural delimiters mimicking our own prompt scaffolding.
  { id: "fake-delimiter", re: /<\/?\s*(system|instructions?|prompt|user|assistant|context)\s*>/i },
  {
    id: "destructive-cmd",
    re: /\b(rm\s+-rf|drop\s+table|delete\s+(all|every|the)?\s*\w*\s*files?|del\s+\/[a-z]|format\s+c:|shutdown\b)/i,
  },
  {
    id: "exfiltrate",
    re: /\b(send|post|exfiltrate|upload|email|leak)\b[\s\S]{0,30}?\b(api[_\s-]?key|secret|password|token|credentials?|env\b)/i,
  },
];

/**
 * Secret / PII shaped patterns. `kind` decides which flag they raise. Used both for the
 * flags and for {@link redactSecrets}. Conservative by design — see TODOs.
 *
 * TODO(D11): coverage is partial (no Luhn check on card-likes, no AWS/GCP key shapes,
 * no phone numbers). Add as needed; weigh false-positive cost since these drive
 * escalation + log redaction.
 */
export const SECRET_PATTERNS: ReadonlyArray<{ id: string; re: RegExp; kind: "secret" | "pii" }> = [
  // Stripe-style keys, e.g. cs_live_… / sk_live_… / pk_test_… / whsec_…
  { id: "stripe-key", re: /\b(?:sk|pk|rk|cs|whsec)_(?:live|test)_[A-Za-z0-9]{6,}\b/g, kind: "secret" },
  // OpenAI-style keys.
  { id: "openai-key", re: /\bsk-[A-Za-z0-9]{20,}\b/g, kind: "secret" },
  // Inline credential assignment: api_key=… / token: … / password=…
  { id: "credential-assign", re: /\b(?:api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*\S{6,}/gi, kind: "secret" },
  // Email addresses.
  { id: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, kind: "pii" },
  // Long digit runs (cards / account / order ids), allowing spaces and dashes as separators.
  { id: "long-digits", re: /\b\d(?:[\d -]{10,})\d\b/g, kind: "pii" },
];

// --- Hidden-character classes (escapes, so the source stays reviewable) ---
// Zero-width chars + directional marks (LRM/RLM) + general/word-joiner format chars + BOM.
const ZERO_WIDTH_AND_BIDI = /[\u200B-\u200F\u2060-\u2064\u2066-\u206F\uFEFF]/g;
// Bidi embeddings / overrides (LRE/RLE/PDF/LRO/RLO) - used to spoof rendered text order.
const BIDI_OVERRIDES = /[\u202A-\u202E]/g;
// C0 controls except tab (\u0009) and newline (\u000A), plus DEL + C1 controls.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// The union, used only to DETECT (not strip) so we can set the obfuscation flag.
const SUSPICIOUS_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/;

/** Run the injection heuristics over `text`; returns the ids of all rules that matched. */
export function detectInjection(text: string): string[] {
  const hits: string[] = [];
  for (const rule of INJECTION_RULES) {
    if (rule.re.test(text)) hits.push(rule.id);
  }
  return hits;
}

/** Detect secret/PII-shaped tokens; returns which flag(s) to raise. */
export function detectSecrets(text: string): { contains_secret: boolean; contains_pii: boolean } {
  let secret = false;
  let pii = false;
  for (const p of SECRET_PATTERNS) {
    p.re.lastIndex = 0; // global regexes are stateful — reset before reuse
    if (p.re.test(text)) {
      if (p.kind === "secret") secret = true;
      else pii = true;
    }
  }
  return { contains_secret: secret, contains_pii: pii };
}

/**
 * Mask secret/PII-shaped tokens with `[REDACTED]` for safe logging (AGENTS.md §2 forbids
 * logging secrets). Use on any ticket text before it goes to the prompt log.
 */
export function redactSecrets(text: string): string {
  let out = text;
  for (const p of SECRET_PATTERNS) {
    out = out.replace(new RegExp(p.re.source, p.re.flags), "[REDACTED]");
  }
  return out;
}

/**
 * Normalize + clean a single untrusted field and return the cleaned text plus its flags.
 * Order matters: normalize line endings → detect obfuscation → NFKC fold → strip hidden
 * chars → cap length → run heuristic detectors on the cleaned text.
 */
export function sanitizeText(raw: string, maxLen: number): { clean: string; flags: SafetyFlags } {
  const flags = emptyFlags();
  if (!raw) return { clean: "", flags };

  // 1. Normalize CRLF/CR to LF (not obfuscation — just line-ending hygiene).
  let text = raw.replace(/\r\n?/g, "\n");

  // 2. Flag hidden/control chars BEFORE we strip them (the signal is their presence).
  flags.unicode_obfuscation = SUSPICIOUS_CHARS.test(text);

  // 3. NFKC fold so compatibility/full-width homoglyphs can't smuggle past keyword rules.
  //    TODO(D11): NFKC is aggressive (e.g. ligatures, full-width punctuation collapse).
  //    Accepted for detection robustness; revisit if it ever corrupts a legit response.
  text = text.normalize("NFKC");

  // 4. Strip zero-width, bidi, and control characters.
  text = text.replace(ZERO_WIDTH_AND_BIDI, "").replace(BIDI_OVERRIDES, "").replace(CONTROL_CHARS, "");

  // 5. Length cap (anti context-stuffing).
  if (text.length > maxLen) {
    text = text.slice(0, maxLen);
    flags.truncated = true;
  }

  // 6. Heuristic detectors on the cleaned text.
  const matched = detectInjection(text);
  flags.matched_rules = matched;
  flags.injection_suspected = matched.length > 0;
  const secrets = detectSecrets(text);
  flags.contains_secret = secrets.contains_secret;
  flags.contains_pii = secrets.contains_pii;

  return { clean: text, flags };
}

/** OR the booleans and union the matched-rule lists across several field-level flag sets. */
function mergeFlags(...sets: SafetyFlags[]): SafetyFlags {
  const merged = emptyFlags();
  const rules = new Set<string>();
  for (const f of sets) {
    merged.injection_suspected ||= f.injection_suspected;
    merged.contains_secret ||= f.contains_secret;
    merged.contains_pii ||= f.contains_pii;
    merged.unicode_obfuscation ||= f.unicode_obfuscation;
    merged.truncated ||= f.truncated;
    for (const r of f.matched_rules) rules.add(r);
  }
  merged.matched_rules = [...rules];
  return merged;
}

/**
 * Sanitize a parsed ticket. Leaves the original `issue`/`subject`/`company` untouched
 * (so the output CSV echoes the input verbatim) and attaches `clean` (the text the
 * pipeline must use) + `safety` (the verdict). Pure and deterministic.
 */
export function sanitizeTicket(ticket: Ticket): Ticket {
  const issue = sanitizeText(ticket.issue, MAX_ISSUE_LEN);
  const subject = sanitizeText(ticket.subject, MAX_SUBJECT_LEN);
  const company = sanitizeText(ticket.company, MAX_COMPANY_LEN);
  const safety: TicketSafety = {
    flags: mergeFlags(issue.flags, subject.flags, company.flags),
    fields: { issue: issue.flags, subject: subject.flags, company: company.flags },
  };
  return {
    ...ticket,
    clean: { issue: issue.clean, subject: subject.clean, company: company.clean },
    safety,
  };
}

/** Convenience: sanitize a batch of tickets. */
export function sanitizeTickets(tickets: Ticket[]): Ticket[] {
  return tickets.map(sanitizeTicket);
}

// ---------------------------------------------------------------------------
// Layer 2 primitive — prompt isolation fence.
// ---------------------------------------------------------------------------

/**
 * Sentinel marker delimiting untrusted ticket data inside a prompt. The model is told
 * (in 005's system prompt) that everything between the fences is data to triage and must
 * never be followed as instructions.
 *
 * TODO(D11, Layer 2): this is a FIXED sentinel. 005 should randomize it per run (a nonce
 * the attacker can't predict) so a payload can't pre-close the fence even if this
 * constant leaks. The strip below already removes any literal occurrence as defense.
 */
export const UNTRUSTED_MARKER = "UNTRUSTED_TICKET_DATA_7Q2X";

/**
 * Wrap untrusted text in the isolation fence, first stripping any forged marker tokens
 * from the payload so an attacker can't inject a closing fence to "escape" into the
 * instruction context.
 */
export function fenceUntrusted(text: string): string {
  const stripped = text.split(UNTRUSTED_MARKER).join("");
  return `<<${UNTRUSTED_MARKER}>>\n${stripped}\n<<END_${UNTRUSTED_MARKER}>>`;
}
