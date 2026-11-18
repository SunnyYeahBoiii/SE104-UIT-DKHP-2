import { defineConfig, devices } from '@playwright/test'

/** E2E uses the dedicated dkhp_w39 database (apps/api/.env); seed is deterministic and idempotent. */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'bun run --cwd ../api start',
      env: { DKHP_REGISTRATION_NOW: '2027-01-06T10:00:00+07:00' },
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'bunx next dev --port 3100',
      url: 'http://127.0.0.1:3100/login',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
