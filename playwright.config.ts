import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration - Phase 13 Production-Grade Suite
 * 
 * Tiered test structure:
 * - Tier 1: Core Critical Paths (Smoke Suite) - Run on all browsers
 * - Tier 2: GUID Persistence & Offline Integrity - Run on Chromium + Mobile
 * - Tier 3: Security & Performance - Run on Chromium only
 * 
 * Tests run against the full-stack application (frontend + backend)
 * Frontend runs on port 3000 (Vite config), backend runs on port 4000 (default)
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results', // Explicitly set test results directory
  fullyParallel: false, // Run tests sequentially to avoid database conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for database consistency
  timeout: 60000, // 60s timeout for E2E tests
  expect: {
    // Visual regression threshold
    toHaveScreenshot: { threshold: 0.2, maxDiffPixels: 100 },
    // Snapshot threshold
    toMatchSnapshot: { threshold: 0.2 },
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report' }], // Separate folder to avoid clash with test-results
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:3000', // Match Vite config port
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Visual regression settings
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    // Desktop browsers for Tier 1 (Smoke Suite)
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Verify 44x44px touch targets work on desktop too
      },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile emulation for touch target verification (Tier 2)
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        // Verify 44x44px touch targets on mobile
        viewport: { width: 393, height: 851 },
      },
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],

  webServer: [
    {
      command: 'cd backend && pnpm dev',
      port: 4000, // Match backend default port
      reuseExistingServer: !process.env.CI, // Use existing server locally, start fresh in CI
      timeout: 180000, // 3 minutes for CI cold starts
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://user:password@localhost:5432/scheduler_test',
        REDIS_URL: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
        JWT_SECRET: 'test-jwt-secret-key',
      },
    },
    {
      command: 'cd frontend && pnpm dev',
      port: 3000, // Match Vite config port
      reuseExistingServer: !process.env.CI, // Use existing server locally, start fresh in CI
      timeout: 180000, // 3 minutes for CI cold starts
      env: {
        VITE_API_URL: 'http://localhost:4000/api/v1', // Match backend port
      },
    },
  ],
});
