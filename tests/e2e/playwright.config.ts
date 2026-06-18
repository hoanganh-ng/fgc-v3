import { defineConfig, devices } from "@playwright/test";

/**
 * Sprint 062 baseline E2E configuration.
 *
 * The runner addresses the production-like web gateway through Compose DNS.
 * No host ports are ever published by the E2E stack; the runner must not
 * reference "localhost" or any host port for the API or the gateway.
 *
 * The webServer block is intentionally absent: the gateway readiness is
 * owned by the runner entrypoint (scripts/run-e2e-runner-container.sh),
 * which polls the gateway until it returns the React app HTML.
 */
const baseURL = process.env.E2E_GATEWAY_URL?.trim() || "http://web-gateway";

export default defineConfig({
  testDir: ".",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "off",
    video: "off",
    screenshot: "off",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});