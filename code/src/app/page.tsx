import { loadSupportTickets } from "../agent/tickets";
import { LiveDashboard } from "../dashboard/LiveDashboard";

/**
 * Triage Console home — driven by the live agent (build prompt 008).
 *
 * Loads the support tickets server-side, then the client streams each through
 * `POST /api/triage` (007), folding results into the same Dashboard the mock used.
 * No env toggle: this always uses the live API, which returns the fake pipeline until
 * the server's `REAL_*` flags are on — so the page renders in every configuration.
 *
 * `?ticket=N` deep-links a specific ticket into focus — used by the Accuracy and Review
 * screens to jump back here for inspection.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const tickets = loadSupportTickets();
  const { ticket } = await searchParams;
  const parsed = ticket ? Number(ticket) : NaN;
  return (
    <LiveDashboard
      tickets={tickets}
      initialTicketId={Number.isFinite(parsed) ? parsed : undefined}
    />
  );
}
