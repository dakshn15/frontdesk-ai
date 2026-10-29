import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const baseURL = "http://localhost:3300";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  // In GitHub Actions, failures also show as annotations on the run page.
  reporter: process.env.GITHUB_ACTIONS
    ? [["list"], ["github"], ["html", { open: "never" }]]
    : process.env.CI
      ? [["list"], ["html", { open: "never" }]]
      : "list",
  use: { baseURL, trace: "on-first-retry" },
  // Locally the dev server compiles each route on its first request, which can take several
  // seconds under parallel load. CI runs against a production build and keeps the defaults.
  timeout: process.env.CI ? 30_000 : 90_000,
  expect: { timeout: process.env.CI ? 5_000 : 20_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /smoke\.spec\.ts/,
    },
  ],
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // The receptionist answers with a scripted model in tests (never on Vercel).
    env: {
      ...(process.env as Record<string, string>),
      AI_FAKE: "1",
      // The platform admin e2e test signs in as this user.
      PLATFORM_ADMIN_EMAILS: "platform-admin@frontdesk.test",
      // Lets the settings e2e test save an AI key (the check with the provider is skipped).
      AI_KEYS_SECRET: "e2e-secret-for-saved-ai-keys-only",
    },
    timeout: 120_000,
  },
});
