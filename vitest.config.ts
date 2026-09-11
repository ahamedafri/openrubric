import { defineConfig } from "vitest/config";

/**
 * Node-environment unit tests across every workspace package. No live
 * network calls: LLM clients are mocked with recorded fixture
 * responses (see packages/core/test/fixtures) so CI never depends on
 * an API key or a real model's nondeterminism.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/*/src/**/*.test.ts", "packages/*/test/**/*.test.ts"],
  },
});
