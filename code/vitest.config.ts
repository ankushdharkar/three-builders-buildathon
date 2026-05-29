import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Unit tests default to Node (agent core is UI-free). Component tests opt into
    // jsdom per-file via `// @vitest-environment jsdom`.
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
