import { defineConfig, devices } from "@playwright/test";

/**
 * QA e2e config for the Limon landing.
 * Assumes a dev server is already running (bun run dev) on PORT (default 3001).
 */
const PORT = process.env.LIMON_PORT ?? "3001";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
