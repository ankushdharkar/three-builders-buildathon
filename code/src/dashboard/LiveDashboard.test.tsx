// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PipelineEvent, Ticket } from "../agent/types";
import { LiveDashboard, type TriageRunner } from "./LiveDashboard";

const ticket: Ticket = {
  id: 1,
  issue: "How long do tests stay active in the system?",
  subject: "Test expiry",
  company: "HackerRank",
};

const scripted: PipelineEvent[] = [
  { stage: "retrieve", status: "start" },
  { stage: "retrieve", sources: [{ articleId: "screen/x", title: "Test settings", category: "screen", score: 0.92 }] },
  { stage: "retrieve", status: "done", ms: 100 },
  { stage: "classify", status: "done", ms: 80 },
  { stage: "risk", status: "done", ms: 20 },
  { stage: "decide", status: "done", ms: 10 },
  { stage: "respond", tokenDelta: "Tests stay active " },
  {
    stage: "final",
    decision: {
      status: "replied",
      request_type: "product_issue",
      product_area: "screen",
      response: "Tests stay active until you set an end date.",
      justification: "Corpus documents test expiry.",
      risk: "LOW",
      confidence: 0.9,
      sources: [{ articleId: "screen/x", title: "Test settings", category: "screen", score: 0.92 }],
    },
  },
];

describe("LiveDashboard", () => {
  it("seeds the queue then streams a ticket to its final replied decision", async () => {
    const runner: TriageRunner = async (_t, onEvent) => {
      for (const e of scripted) onEvent(e);
    };

    render(<LiveDashboard tickets={[ticket]} runner={runner} />);

    // The streamed decision renders through the same Dashboard components.
    await waitFor(() => expect(screen.getByTestId("decision-card")).toBeInTheDocument());
    expect(screen.getByText("Tests stay active until you set an end date.")).toBeInTheDocument();

    // Queue badge reflects the final state.
    const queue = screen.getByTestId("queue");
    expect(within(queue).getByText("replied")).toBeInTheDocument();
  });

  it("renders a queued seed before any events arrive", () => {
    const never: TriageRunner = () => new Promise(() => {});
    render(<LiveDashboard tickets={[ticket]} runner={never} />);
    const queue = screen.getByTestId("queue");
    expect(within(queue).getByText("queued")).toBeInTheDocument();
  });
});
