import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;

export default defineConfig({
  testDir: 'tests/e2e',
  // Runs inside `firebase emulators:exec` (npm run test:e2e): auth + firestore emulators.
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-375',
      testIgnore: /admin-global\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-360',
      testIgnore: /admin-global\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      // Settings and « Nettoyage » change shared data: run once, after every other test.
      name: 'admin-global',
      testMatch: /admin-global\.spec\.ts/,
      dependencies: ['mobile-375', 'mobile-360'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run dev:web',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
