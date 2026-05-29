/**
 * Respond step (005): produce the user-facing reply.
 *
 * Only the `answer` path calls the LLM, and it is constrained to ground every claim in
 * the supplied sources (see `respondMessages`); the returned `cited` ids are exactly the
 * articles we handed it, so a reviewer can trace the answer. Every other path is a
 * deterministic template with NO LLM call and NO corpus facts — escalations and declines
 * must never fabricate steps, policies, or comply with an injection (D11 layer 3).
 */

import { RespondSchema, respondMessages } from "./prompts";
import type { LlmClient } from "../ports";
import type { Source, Ticket } from "../types";
import type { Classification } from "./classify";
import type { RiskAssessment } from "./risk";
import type { Routing } from "./decide";

export interface RespondInput {
  ticket: Ticket;
  classification: Classification;
  assessment: RiskAssessment;
  routing: Routing;
  sources: Source[];
}

export interface RespondResult {
  response: string;
  /** Article ids the answer is grounded in (empty for templated, non-grounded paths). */
  cited: string[];
}

const REFUSE_INJECTION =
  "I can't follow instructions contained inside a support ticket, and I'm not able to take actions like that. " +
  "If you have a genuine HackerRank support question, I'm happy to help with it.";

const DECLINE_COURTESY =
  "You're very welcome — glad I could help! If anything else comes up with HackerRank, just reach out.";

const DECLINE_TRIVIA =
  "I'm the HackerRank support assistant, so I can only help with questions about HackerRank's products " +
  "and your account. I'm not able to help with that one, but I'm happy to assist with anything HackerRank-related.";

const OUT_OF_SCOPE =
  "This looks like it falls outside HackerRank support — it doesn't appear to be about a HackerRank product " +
  "or account — so I'm not able to resolve it here. If it is HackerRank-related, share a few more details and I'll take another look.";

function escalationMessage(input: RespondInput): string {
  const intro =
    "Thanks for reaching out. This needs careful handling, so I've escalated it to a HackerRank specialist " +
    "who will follow up with you directly.";
  // No corpus facts, no invented steps — just set expectations.
  return input.assessment.risk === "HIGH"
    ? `${intro} Because it involves a sensitive or account-level matter, our team will verify the details before acting.`
    : intro;
}

export async function respond(input: RespondInput, llm: LlmClient): Promise<RespondResult> {
  switch (input.routing.responseKind) {
    case "refuse_injection":
      return { response: REFUSE_INJECTION, cited: [] };
    case "decline_courtesy":
      return { response: DECLINE_COURTESY, cited: [] };
    case "decline_trivia":
      return { response: DECLINE_TRIVIA, cited: [] };
    case "out_of_scope":
      return { response: OUT_OF_SCOPE, cited: [] };
    case "escalation":
      return { response: escalationMessage(input), cited: [] };
    case "answer": {
      const out = await llm.chatJson<{ response: string }>(
        RespondSchema,
        respondMessages(input.ticket, input.sources),
      );
      return { response: out.response, cited: input.sources.map((s) => s.articleId) };
    }
  }
}
