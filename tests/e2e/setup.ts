import { test as base } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { LookaheadPage } from './pages/LookaheadPage';
import { SchedulePage } from './pages/SchedulePage';
import { DashboardPage } from './pages/DashboardPage';
import { ApprovalPage } from './pages/ApprovalPage';

/**
 * Extended test fixtures with page object models
 */
export const test = base.extend({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  lookaheadPage: async ({ page }, use) => {
    await use(new LookaheadPage(page));
  },
  schedulePage: async ({ page }, use) => {
    await use(new SchedulePage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  approvalPage: async ({ page }, use) => {
    await use(new ApprovalPage(page));
  },
});

export { expect } from '@playwright/test';
