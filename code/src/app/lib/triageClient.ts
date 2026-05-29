/**
 * Typed client for the streaming triage endpoint (build prompt 007).
 *
 * `streamTriage` POSTs a ticket to `POST /api/triage` (see route.ts for the contract),
 * reads the NDJSON response stream, and invokes `onEvent` with each parsed
 * `PipelineEvent` as soon as a full line arrives — buffering partial lines across chunk
 * boundaries. The UI uses this to drive the live pipeline stepper + token streaming.
 */

import type { PipelineEvent, Ticket } from "../../agent/types";

export interface StreamTriageOptions {
  /** Override the endpoint (defaults to `/api/triage`). */
  endpoint?: string;
  /** Abort the in-flight request/stream. */
  signal?: AbortSignal;
  /** Injectable fetch (for tests). Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

export async function streamTriage(
  ticket: Ticket,
  onEvent: (event: PipelineEvent) => void,
  options: StreamTriageOptions = {},
): Promise<void> {
  const doFetch = options.fetchImpl ?? fetch;
  const res = await doFetch(options.endpoint ?? "/api/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
    signal: options.signal,
  });

  if (!res.ok) {
    throw new Error(`Triage request failed: ${res.status} ${res.statusText}`.trim());
  }
  if (!res.body) {
    throw new Error("Triage response has no body to stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = drainCompleteLines(buffer, onEvent);
    }
    // Flush any multi-byte remainder, then emit a trailing line with no newline.
    buffer += decoder.decode();
    const last = buffer.trim();
    if (last) onEvent(parseEvent(last));
  } finally {
    reader.releaseLock();
  }
}

/** Emit every newline-terminated line in `buffer`; return the unfinished remainder. */
function drainCompleteLines(
  buffer: string,
  onEvent: (event: PipelineEvent) => void,
): string {
  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    if (line) onEvent(parseEvent(line));
    buffer = buffer.slice(newlineIndex + 1);
    newlineIndex = buffer.indexOf("\n");
  }
  return buffer;
}

function parseEvent(line: string): PipelineEvent {
  return JSON.parse(line) as PipelineEvent;
}
