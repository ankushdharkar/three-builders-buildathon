// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { AccuracyView } from "./AccuracyView";
import { buildConfusionMatrices, scoreSample } from "./confusion";
import type { AccuracyData } from "./confusion";
import type { Decision } from "../agent/types";

function d(p: Partial<Decision>): Decision {
  return {
    status: "replied",
    request_type: "product_issue",
    product_area: "",
    response: "r",
    justification: "j",
    risk: "LOW",
    confidence: 0.8,
    sources: [],
    ...p,
  };
}

const predictions: Decision[] = [
  d({ status: "replied", request_type: "bug", product_area: "screen" }),
  d({ status: "escalated", request_type: "product_issue", product_area: "settings" }),
  d({ status: "replied", request_type: "product_issue", product_area: "" }),
];
const expected: Array<Partial<Decision>> = [
  { status: "replied", request_type: "bug", product_area: "screen" },
  { status: "replied", request_type: "product_issue", product_area: "settings" },
  { status: "replied", request_type: "feature_request", product_area: "" },
];

const data: AccuracyData = {
  report: scoreSample(predictions, expected),
  matrices: buildConfusionMatrices(predictions, expected),
  subjects: { 1: "Refund please", 2: "Add feature" },
};

describe("<AccuracyView />", () => {
  it("renders the overall exact-match headline", () => {
    render(<AccuracyView data={data} />);
    const view = screen.getByTestId("accuracy-view");
    // 1 of 3 rows fully matched → 33.3%
    expect(within(view).getByText(/33\.3%/)).toBeInTheDocument();
  });

  it("renders per-column accuracy", () => {
    render(<AccuracyView data={data} />);
    expect(screen.getByTestId("col-status")).toHaveTextContent("status");
    expect(screen.getByTestId("col-product_area")).toHaveTextContent("100%");
  });

  it("renders a confusion matrix for each enum column", () => {
    render(<AccuracyView data={data} />);
    expect(screen.getByTestId("matrix-status")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-request_type")).toBeInTheDocument();
    expect(screen.getByTestId("matrix-product_area")).toBeInTheDocument();
  });

  it("lists each disagreement with expected vs predicted", () => {
    render(<AccuracyView data={data} />);
    const list = screen.getByTestId("disagreements");
    expect(within(list).getAllByRole("button").length).toBe(2);
    expect(list).toHaveTextContent("escalated");
    expect(list).toHaveTextContent("feature_request");
  });

  it("selects a disagreement row on click", () => {
    render(<AccuracyView data={data} />);
    const rows = within(screen.getByTestId("disagreements")).getAllByRole("button");
    expect(rows[0]).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(rows[0]);
    expect(rows[0]).toHaveAttribute("aria-pressed", "true");
  });
});
