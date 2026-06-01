import { defineConfig, devices } from '@playwright/test';

// E2E suite for Witch Mountain Bridge. Drives the real Vite build in a
// headless Chromium so we catch render-time crashes a `vite build` can't
// (see CLAUDE.md: "Vite build ≠ runtime safety"). Tests enter combat
// through the in-game Lab Mode, which is deterministic enough to assert on:
// instant wizard pick → custom deck → pick enemy → straight into combat.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Playwright starts the dev server itself and tears it down after the run.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { PLAYWRIGHT: '1' },
  },
});
