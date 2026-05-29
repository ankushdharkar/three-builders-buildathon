// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SourceDrawer } from "./SourceDrawer";
import type { SourceDoc } from "./viewModel";

const doc: SourceDoc = {
  articleId: "screen/system-check",
  title: "Run the HackerRank System Check",
  category: "screen",
  url: "https://support.hackerrank.com/screen/system-check",
  body: "The System Check verifies the candidate's browser and webcam before a test.",
  snippet: "System Check verifies",
};

describe("<SourceDrawer />", () => {
  it("renders nothing when no doc is open", () => {
    const { container } = render(<SourceDrawer doc={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the article title, id, category and body", () => {
    render(<SourceDrawer doc={doc} onClose={() => {}} />);
    expect(screen.getByText(doc.title)).toBeInTheDocument();
    expect(screen.getByText(doc.articleId)).toBeInTheDocument();
    expect(screen.getByText("screen")).toBeInTheDocument();
    expect(screen.getByText(/candidate's browser and webcam/)).toBeInTheDocument();
  });

  it("highlights the cited snippet inside the body", () => {
    render(<SourceDrawer doc={doc} onClose={() => {}} />);
    const marks = document.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("System Check verifies");
  });

  it("links out to the source url when present", () => {
    render(<SourceDrawer doc={doc} onClose={() => {}} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", doc.url);
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<SourceDrawer doc={doc} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<SourceDrawer doc={doc} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows a fallback when the article body is unavailable", () => {
    render(<SourceDrawer doc={{ ...doc, body: "", snippet: undefined }} onClose={() => {}} />);
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });
});
