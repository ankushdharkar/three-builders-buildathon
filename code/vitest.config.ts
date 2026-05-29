import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests run in Node (agent core is UI-free). Component tests can add a
    // jsdom environment later via per-file `// @vitest-environment jsdom`.
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
