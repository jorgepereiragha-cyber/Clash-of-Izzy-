import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL,
    browserName: "chromium",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "Pixel 5",
      use: { ...devices["Pixel 5"] }
    },
    {
      name: "Galaxy S8",
      use: { ...devices["Galaxy S8"] }
    }
  ],
  webServer: process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --ip 127.0.0.1 --port 8787",
        url: baseURL + "/kingdom.html",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { WRANGLER_SEND_METRICS: "false" }
      }
});
