// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) and unmounts
// rendered React trees after each test so jsdom-env component tests don't leak DOM into
// one another. Harmless for Node-environment unit tests, where cleanup() is a no-op.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});
