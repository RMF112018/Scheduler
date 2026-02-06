import { test as base } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { LookaheadPage } from './pages/LookaheadPage';
import { SchedulePage } from './pages/SchedulePage';
import { ScheduleDetailPage } from './pages/ScheduleDetailPage';
import { LookaheadViewPage } from './pages/LookaheadViewPage';
import { PendingAssignmentPage } from './pages/PendingAssignmentPage';
import { DashboardPage } from './pages/DashboardPage';
import { ApprovalPage } from './pages/ApprovalPage';

/**
 * Extended test fixtures with page object models
 * Phase 13: Production-grade E2E test suite
 */
export const test = base.extend({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  lookaheadPage: async ({ page }, use) => {
    await use(new LookaheadPage(page));
  },
  lookaheadViewPage: async ({ page }, use) => {
    await use(new LookaheadViewPage(page));
  },
  schedulePage: async ({ page }, use) => {
    await use(new SchedulePage(page));
  },
  scheduleDetailPage: async ({ page }, use) => {
    await use(new ScheduleDetailPage(page));
  },
  pendingAssignmentPage: async ({ page }, use) => {
    await use(new PendingAssignmentPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  approvalPage: async ({ page }, use) => {
    await use(new ApprovalPage(page));
  },
});

export { expect } from '@playwright/test';
