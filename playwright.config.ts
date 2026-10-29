import { defineConfig } from "@playwright/test";

// The e2e server (scripts/e2e-server.ts) runs on its own ports with synthetic Episodes.
const baseURL = "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "e2e",
  outputDir: "artifacts/e2e",
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, screenshot: "on", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/e2e-server.ts",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
