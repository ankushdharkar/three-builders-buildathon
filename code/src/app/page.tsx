import { loadSupportTickets } from "../agent/tickets";
import { LiveDashboard } from "../dashboard/LiveDashboard";

/**
 * Triage Console home — driven by the live agent (build prompt 008).
 *
 * Loads the support tickets server-side, then the client streams each through
 * `POST /api/triage` (007), folding results into the same Dashboard the mock used.
 * No env toggle: this always uses the live API, which returns the fake pipeline until
 * the server's `REAL_*` flags are on — so the page renders in every configuration.
 */
export default function Home() {
  const tickets = loadSupportTickets();
  return <LiveDashboard tickets={tickets} />;
}
