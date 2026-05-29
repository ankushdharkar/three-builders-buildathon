/**
 * Streaming triage API route (build prompt 007) — the bridge between the agent core
 * and the Triage Console UI.
 *
 * ── ENDPOINT CONTRACT (UI sessions integrate against this; no need to read the impl) ──
 *   Method:   POST /api/triage
 *   Request:  application/json  →  { "ticket": Ticket }
 *             `Ticket` is the shared contract type (src/agent/types.ts); at minimum it
 *             needs a non-empty `issue` string. Anything else → 400 JSON `{ error }`.
 *   Response: 200, Content-Type: application/x-ndjson  (NDJSON — one JSON object/line)
 *             Each line is a serialized `PipelineEvent` (src/agent/types.ts), streamed
 *             in pipeline order. The stream always ends with a `{ stage: "final",
 *             decision }` event. Consume it with `streamTriage` (src/app/lib/triageClient.ts).
 *   Headers:  Cache-Control: no-cache, no-transform  (+ X-Accel-Buffering: no) so
 *             proxies don't buffer the token stream.
 *
 * The pipeline comes from the composition root (`getPipeline`), which always wires the
 * real pipeline. It's exposed via `__pipeline.provider` so tests can inject a scripted
 * pipeline without touching the container.
 */

import { getPipeline } from "../../../agent/container";
import type { Pipeline } from "../../../agent/ports";
import type { PipelineEvent, Ticket } from "../../../agent/types";

/** Injection seam: tests override `provider`; production uses the container. */
export const __pipeline: { provider: () => Promise<Pipeline> } = {
  provider: getPipeline,
};

/** A ticket is usable iff it carries a non-empty `issue` body to triage. */
function isValidTicket(value: unknown): value is Ticket {
  if (typeof value !== "object" || value === null) return false;
  const issue = (value as { issue?: unknown }).issue;
  return typeof issue === "string" && issue.trim().length > 0;
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const ticket = (body as { ticket?: unknown } | null)?.ticket;
  if (!isValidTicket(ticket)) {
    return badRequest("Body must be { ticket } with a non-empty `issue` string.");
  }

  const pipeline = await __pipeline.provider();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of pipeline.run(ticket)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch (err) {
        // Surface a failure in-band so the client still gets a typed event, then close.
        const errorEvent: PipelineEvent = {
          stage: "decide",
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        };
        controller.enqueue(encoder.encode(JSON.stringify(errorEvent) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
