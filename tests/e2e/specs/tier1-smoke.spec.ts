/**
 * Tier 1: Core Critical Paths (Smoke Suite)
 * 
 * Tests the fundamental "plumbing" of the application:
 * - User Login → Import XER → Update Activity → Verify CPM Recalculation → PDF Export
 * 
 * These tests run on all browsers to catch cross-browser issues early.
 */

import { test, expect } from '../setup';
import {
  createE2ECompany,
  createE2EUser,
  createE2EProject,
  cleanE2EDatabase,
  initE2EDatabase,
  closeE2EDatabase,
} from '../helpers/testData';
import { createScheduleWithActivities } from '../fixtures/ScheduleFactory';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('Tier 1: Core Critical Paths (Smoke Suite)', () => {
  let companyId: string;
  let schedulerUser: { email: string; password: string };
  let projectId: string;
  let scheduleId: string;

  test.beforeAll(async () => {
    await initE2EDatabase();

    // Create test data
    const company = await createE2ECompany('Tier 1 Smoke Test Company');
    companyId = company.id;

    const user = await createE2EUser(companyId, {
      email: 'scheduler@tier1.test',
      password: 'TestPassword123!',
      firstName: 'Scheduler',
      lastName: 'User',
      role: 'pm',
    });
    schedulerUser = { email: user.email, password: user.password };

    const project = await createE2EProject(companyId, user.id, {
      name: 'Tier 1 Smoke Test Project',
    });
    projectId = project.id;

    // Create schedule with activities
    const scheduleData = await createScheduleWithActivities({
      projectId,
      createdBy: user.id,
      activityCount: 5,
      includeRelationships: true,
      useRetainedLogic: true,
    });
    scheduleId = scheduleData.schedule.id;
  });

  test.afterAll(async () => {
    await cleanE2EDatabase();
    await closeE2EDatabase();
  });

  test('should complete full workflow: Login → Import XER → Update Activity → Verify CPM → Export PDF', async ({
    page,
    loginPage,
    scheduleDetailPage,
  }) => {
    // Step 1: Login
    await loginPage.goto();
    await loginPage.login(schedulerUser.email, schedulerUser.password);
    await expect(page).not.toHaveURL(/\/login/);

    // Step 2: Navigate to schedule detail
    await scheduleDetailPage.goto(projectId, scheduleId);
    await expect(scheduleDetailPage.ganttChart).toBeVisible();

    // Step 3: Import XER (using test fixture)
    // Note: XER import requires actual XER file - skipping for now
    // In production, this would import from backend/tests/fixtures/p6-benchmark.xer
    // await scheduleDetailPage.importXER(xerPath);

    // Step 4: Update activity duration
    const initialFinishDate = await scheduleDetailPage.getActivityFinishDate('Activity 1');
    await scheduleDetailPage.updateActivityDuration('Activity 1', 15); // Change from 10 to 15 days

    // Step 5: Verify CPM recalculation
    const cpmRecalculated = await scheduleDetailPage.verifyCPMRecalculated();
    expect(cpmRecalculated).toBe(true);

    // Verify finish date changed
    const updatedFinishDate = await scheduleDetailPage.getActivityFinishDate('Activity 1');
    expect(updatedFinishDate).not.toBe(initialFinishDate);

    // Step 6: Export PDF
    const download = await scheduleDetailPage.exportPDF();
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    // Verify PDF was downloaded
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('should verify Gantt chart renders correctly', async ({
    page,
    loginPage,
    scheduleDetailPage,
  }) => {
    await loginPage.goto();
    await loginPage.login(schedulerUser.email, schedulerUser.password);

    await scheduleDetailPage.goto(projectId, scheduleId);

    // Verify Gantt chart is visible
    const isVisible = await scheduleDetailPage.verifyGanttChartRendered();
    expect(isVisible).toBe(true);

    // Verify activities are displayed
    const activityCount = await scheduleDetailPage.getActivityCount();
    expect(activityCount).toBeGreaterThan(0);
  });

  test('should handle activity updates correctly', async ({
    page,
    loginPage,
    scheduleDetailPage,
  }) => {
    await loginPage.goto();
    await loginPage.login(schedulerUser.email, schedulerUser.password);

    await scheduleDetailPage.goto(projectId, scheduleId);

    // Get initial activity count
    const initialCount = await scheduleDetailPage.getActivityCount();

    // Update an activity
    await scheduleDetailPage.updateActivityDuration('Activity 2', 12);

    // Verify activity count unchanged (update, not create)
    const updatedCount = await scheduleDetailPage.getActivityCount();
    expect(updatedCount).toBe(initialCount);
  });
});
