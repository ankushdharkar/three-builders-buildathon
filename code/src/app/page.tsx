import { Dashboard } from "../dashboard/Dashboard";
import { MOCK_TICKETS } from "../mock/tickets";

/**
 * Triage Console home. Renders off mock data for now (D1 UI shell); the live agent
 * pipeline will replace `MOCK_TICKETS` with streamed results in a later step.
 */
export default function Home() {
  return <Dashboard tickets={MOCK_TICKETS} />;
}
