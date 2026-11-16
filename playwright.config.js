import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;
const baseURL = externalBaseUrl || "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    serviceWorkers: "block",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium-pixel-5",
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
      },
    },
    {
      name: "chromium-galaxy-s8",
      use: {
        ...devices["Galaxy S8"],
        viewport: { width: 360, height: 740 },
        browserName: "chromium",
      },
    },
  ],
  webServer: externalBaseUrl ? undefined : {
    command: [
      "npx wrangler --config wrangler.jsonc dev --local",
      "--ip 127.0.0.1 --port 8787",
      "--var SESSION_SECRET:playwright-e2e-local-secret",
      "--log-level error",
    ].join(" "),
    url: baseURL + "/kingdom.html",
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
