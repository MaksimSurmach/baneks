import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  outputDir: "live-test-results",
  testDir: "./tests/live",
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:4174",
    proxy: process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" }
      : undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4174",
    url: "http://localhost:4174",
    reuseExistingServer: !process.env.CI,
  },
});
