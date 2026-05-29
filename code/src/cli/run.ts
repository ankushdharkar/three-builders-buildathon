/**
 * Batch runner — triages every ticket in `support_tickets/support_tickets.csv` and
 * writes the graded `support_tickets/output.csv` (build prompt 006).
 *
 * This is the headless path that produces the evaluated artifact: it loads the input
 * tickets (001 loaders), drives the agent pipeline once per ticket, captures the final
 * `Decision`, and serializes the five graded columns in the canonical `OUTPUT_COLUMNS`
 * order (001 CSV layer). The pipeline is **injected** so tests run on a deterministic
 * fake with no API keys; `main()` resolves the real-or-fake pipeline from the
 * feature-flagged container.
 *
 * Determinism: tickets are processed sequentially in input order and the output
 * preserves that order, so the same input + pipeline yields byte-identical CSV.
 *
 * Usage: `pnpm agent:run [--limit N] [--out PATH] [--dry]`
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  OUTPUT_COLUMNS,
  toCsv,
  toOutputRecord,
  type OutputColumn,
} from "../agent/csv";
import { getPipeline } from "../agent/container";
import { loadSupportTickets } from "../agent/tickets";
import type { Pipeline } from "../agent/ports";
import type { Decision, Ticket } from "../agent/types";

const here = dirname(fileURLToPath(import.meta.url));
/** Repo-root `support_tickets/output.csv` (../../../ from src/cli/). */
export const DEFAULT_OUT = resolve(here, "../../../support_tickets/output.csv");

/**
 * Drain a single pipeline run and return the `Decision` carried by its `final` event.
 * Throws if the pipeline completes without emitting one — that's a contract violation
 * we want to fail loudly rather than write a blank row.
 */
export async function decide(pipeline: Pipeline, ticket: Ticket): Promise<Decision> {
  let final: Decision | undefined;
  for await (const event of pipeline.run(ticket)) {
    if (event.stage === "final") final = event.decision;
  }
  if (!final) {
    throw new Error(`pipeline produced no final decision for ticket ${ticket.id}`);
  }
  return final;
}

export interface RunBatchOptions {
  /** Input tickets, processed in order. */
  tickets: Ticket[];
  /** Injected pipeline (fake in tests, container-resolved in `main`). */
  pipeline: Pipeline;
  /** Cap the number of tickets processed; non-positive / undefined = all. */
  limit?: number;
  /** Per-ticket progress callback. */
  onResult?: (done: number, total: number, ticket: Ticket, decision: Decision) => void;
}

export interface BatchRun {
  /** One graded record per processed ticket, keys in `OUTPUT_COLUMNS` order. */
  records: Record<OutputColumn, string>[];
  /** The full CSV document (header + rows, trailing newline). */
  csv: string;
}

/**
 * Triage `tickets` through `pipeline`, returning the graded records and the serialized
 * CSV. Pure with respect to the filesystem — writing is the caller's job — so it is
 * trivially testable and reusable by the eval harness.
 */
export async function runBatch(opts: RunBatchOptions): Promise<BatchRun> {
  const limit = opts.limit && opts.limit > 0 ? opts.limit : opts.tickets.length;
  const selected = opts.tickets.slice(0, limit);

  const records: Record<OutputColumn, string>[] = [];
  for (let i = 0; i < selected.length; i++) {
    const ticket = selected[i];
    const decision = await decide(opts.pipeline, ticket);
    records.push(toOutputRecord(ticket, decision));
    opts.onResult?.(i + 1, selected.length, ticket, decision);
  }

  const rows = records.map((rec) => OUTPUT_COLUMNS.map((c) => rec[c]));
  const csv = toCsv(OUTPUT_COLUMNS, rows);
  return { records, csv };
}

interface CliArgs {
  limit?: number;
  out: string;
  dry: boolean;
}

/** Minimal flag parser: `--limit N`, `--out PATH`, `--dry`. */
export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { out: DEFAULT_OUT, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry") {
      args.dry = true;
    } else if (a === "--limit") {
      args.limit = Number(argv[++i]);
    } else if (a.startsWith("--limit=")) {
      args.limit = Number(a.slice("--limit=".length));
    } else if (a === "--out") {
      args.out = resolve(argv[++i]);
    } else if (a.startsWith("--out=")) {
      args.out = resolve(a.slice("--out=".length));
    }
  }
  if (args.limit !== undefined && Number.isNaN(args.limit)) {
    throw new Error("--limit expects a number");
  }
  return args;
}

/** CLI entry point: load tickets → run the container pipeline → write `output.csv`. */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const tickets = loadSupportTickets();
  const pipeline = await getPipeline();

  const { csv, records } = await runBatch({
    tickets,
    pipeline,
    limit: args.limit,
    onResult: (done, total, ticket, d) => {
      console.error(`[${done}/${total}] ticket ${ticket.id} → ${d.status}/${d.request_type}/${d.product_area || "∅"}`);
    },
  });

  if (args.dry) {
    console.error(`[dry] ${records.length} record(s); not writing. Target was ${args.out}`);
    process.stdout.write(csv);
    return;
  }

  writeFileSync(args.out, csv, "utf8");
  console.error(`Wrote ${records.length} record(s) to ${args.out}`);
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
