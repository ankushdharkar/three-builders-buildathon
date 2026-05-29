// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Dashboard } from "./Dashboard";
import { MOCK_TICKETS } from "../mock/tickets";

describe("<Dashboard />", () => {
  it("renders the header with the done/total tally", () => {
    render(<Dashboard tickets={MOCK_TICKETS} />);
    // 3 replied + 2 escalated + 1 invalid = 6 done, of 12 total.
    expect(screen.getByTestId("progress-tally")).toHaveTextContent("6 / 12");
  });

  it("lists every ticket in the queue", () => {
    render(<Dashboard tickets={MOCK_TICKETS} />);
    const queue = screen.getByTestId("queue");
    const rows = within(queue).getAllByRole("button");
    expect(rows).toHaveLength(MOCK_TICKETS.length);
  });

  it("selects the in-progress ticket by default and shows it in the center", () => {
    render(<Dashboard tickets={MOCK_TICKETS} />);
    const current = screen.getByTestId("current-ticket");
    expect(current).toHaveTextContent("zoom connectivity");
    expect(current).toHaveTextContent("HackerRank");
  });

  it("shows the retrieved sources for the selected ticket", () => {
    render(<Dashboard tickets={MOCK_TICKETS} />);
    const sources = screen.getByTestId("sources");
    expect(within(sources).getByText(/Proctoring Setup & Webcam Requirements/)).toBeInTheDocument();
  });

  it("loads a different ticket into the center when its queue row is clicked", () => {
    render(<Dashboard tickets={MOCK_TICKETS} />);
    fireEvent.click(screen.getByRole("button", { name: /Ticket #6/ }));

    const current = screen.getByTestId("current-ticket");
    expect(current).toHaveTextContent("invite teammates");
    // Decision card + response for the picked ticket.
    expect(current).toHaveTextContent("Reviewer");

    // Justification footer reflects the newly selected ticket.
    expect(screen.getByTestId("justification")).toHaveTextContent("read-only Reviewer role");
  });

  it("shows a processing state (no decision card) for an in-progress ticket", () => {
    render(<Dashboard tickets={MOCK_TICKETS} />);
    // #7 is selected by default and has no decision yet.
    const current = screen.getByTestId("current-ticket");
    expect(within(current).queryByTestId("decision-card")).toBeNull();
  });

  it("shows urgency alongside risk in the decision card (D12)", () => {
    render(<Dashboard tickets={MOCK_TICKETS} />);
    fireEvent.click(screen.getByRole("button", { name: /Ticket #1:/ }));
    const card = screen.getByTestId("decision-card");
    expect(card).toHaveTextContent("urgency");
    expect(card).toHaveTextContent("risk");
  });

  it("surfaces detected sub-requests for a bundled ticket (D12)", () => {
    render(<Dashboard tickets={MOCK_TICKETS} />);
    fireEvent.click(screen.getByRole("button", { name: /Ticket #2/ }));
    const decomposition = screen.getByTestId("decomposition");
    // The refund + data-deletion ticket decomposes into two requests.
    expect(within(decomposition).getAllByRole("listitem")).toHaveLength(2);
  });

  it("opens the source drawer with the article body when a source is clicked (D12)", () => {
    render(<Dashboard tickets={MOCK_TICKETS} />);
    fireEvent.click(screen.getByRole("button", { name: /Ticket #1:/ }));
    const sources = screen.getByTestId("sources");
    fireEvent.click(within(sources).getByRole("button", { name: /System Check/ }));

    const drawer = screen.getByTestId("source-drawer");
    expect(within(drawer).getByText(/System Check verifies the candidate's browser/)).toBeInTheDocument();
  });
});
