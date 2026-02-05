import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * 
 * Tests run against the full-stack application (frontend + backend)
 * Assumes backend runs on port 3001 and frontend on port 5173 (Vite default)
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run tests sequentially to avoid database conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for database consistency
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: [
    {
      command: 'cd backend && pnpm dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://user:password@localhost:5432/scheduler_test',
        REDIS_URL: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
        JWT_SECRET: 'test-jwt-secret-key',
      },
    },
    {
      command: 'cd frontend && pnpm dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        VITE_API_URL: 'http://localhost:3001/api/v1',
      },
    },
  ],
});
