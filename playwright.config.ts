import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 4173",
    // Fake hosts: a request the mocks miss fails instead of reaching production.
    env: {
      VITE_NEON_DATA_API_URL: "https://data.neon.invalid/rest/v1",
      VITE_NEON_AUTH_URL: "https://auth.neon.invalid/auth",
    },
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
