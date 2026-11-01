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
    baseURL:
      process.env.LIVE_URL ??
      `http://localhost:4174${process.env.LIVE_BASE_PATH ?? "/"}`,
    proxy: process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" }
      : undefined,
    trace: "retain-on-failure",
  },
  webServer: process.env.LIVE_URL
    ? undefined
    : {
        command: `npm run preview -- --port 4174 --base=${process.env.LIVE_BASE_PATH ?? "/"}`,
        url: `http://localhost:4174${process.env.LIVE_BASE_PATH ?? "/"}`,
        reuseExistingServer: !process.env.CI,
      },
});
