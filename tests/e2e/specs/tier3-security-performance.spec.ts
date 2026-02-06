/**
 * Tier 3: Security & Performance (Vulnerability Suite)
 * 
 * Tests:
 * - RBAC Enforcement: New User redirect to PendingAssignmentLanding
 * - Load Performance: Gantt chart and API responses with 1000+ activities
 * 
 * These tests run on Chromium only for faster execution.
 */

import { test, expect } from '../setup';
import {
  createE2ECompany,
  createE2EProject,
  cleanE2EDatabase,
  initE2EDatabase,
  closeE2EDatabase,
} from '../helpers/testData';
import { createLargeSchedule } from '../fixtures/ScheduleFactory';
import { createNewUser, createSchedulerUser } from '../fixtures/UserFactory';

test.describe('Tier 3: Security & Performance', () => {
  let companyId: string;
  let newUser: { email: string; password: string };
  let schedulerUser: { email: string; password: string; id: string };
  let projectId: string;
  let largeScheduleId: string;

  test.beforeAll(async () => {
    await initE2EDatabase();

    // Create test data
    const company = await createE2ECompany('Tier 3 Security Test Company');
    companyId = company.id;

    const newUserData = await createNewUser(companyId);
    newUser = {
      email: newUserData.email,
      password: newUserData.password,
    };

    const schedulerData = await createSchedulerUser(companyId);
    schedulerUser = {
      email: schedulerData.email,
      password: schedulerData.password,
      id: schedulerData.id,
    };

    const project = await createE2EProject(companyId, schedulerData.id, {
      name: 'Tier 3 Performance Test Project',
    });
    projectId = project.id;

    // Create large schedule for performance testing
    const largeSchedule = await createLargeSchedule(projectId, schedulerData.id, 1000);
    largeScheduleId = largeSchedule.schedule.id;
  });

  test.afterAll(async () => {
    await cleanE2EDatabase();
    await closeE2EDatabase();
  });

  test.describe('RBAC Enforcement', () => {
    test('should redirect new_user to PendingAssignmentLanding screen', async ({
      page,
      loginPage,
      pendingAssignmentPage,
    }) => {
      // Step 1: Login as new_user
      await loginPage.goto();
      await loginPage.login(newUser.email, newUser.password);

      // Step 2: Verify redirect to pending assignment page
      await expect(page).toHaveURL(/\/pending-assignment/);
      
      const isOnPendingPage = await pendingAssignmentPage.verifyOnPendingAssignmentPage();
      expect(isOnPendingPage).toBe(true);
    });

    test('should block new_user from accessing project data', async ({
      page,
      loginPage,
      pendingAssignmentPage,
    }) => {
      await loginPage.goto();
      await loginPage.login(newUser.email, newUser.password);

      // Verify blocked from projects
      const isBlocked = await pendingAssignmentPage.verifyBlockedFromProjects();
      expect(isBlocked).toBe(true);

      // Try to access schedules directly
      await page.goto(`/projects/${projectId}/schedules`);
      await page.waitForLoadState('networkidle');

      // Should be redirected back to pending assignment
      await expect(page).toHaveURL(/\/pending-assignment/);
    });

    test('should allow scheduler to access project data', async ({
      page,
      loginPage,
      scheduleDetailPage,
    }) => {
      await loginPage.goto();
      await loginPage.login(schedulerUser.email, schedulerUser.password);

      // Should NOT be redirected to pending assignment
      await expect(page).not.toHaveURL(/\/pending-assignment/);

      // Should be able to access schedules
      await scheduleDetailPage.goto(projectId, largeScheduleId);
      await expect(scheduleDetailPage.ganttChart).toBeVisible();
    });
  });

  test.describe('Performance Tests', () => {
    test('should render Gantt chart smoothly with 1000+ activities', async ({
      page,
      loginPage,
      scheduleDetailPage,
    }) => {
      await loginPage.goto();
      await loginPage.login(schedulerUser.email, schedulerUser.password);

      // Measure render time
      const renderTime = await scheduleDetailPage.measureGanttRenderTime();
      
      // Should render within reasonable time (10 seconds for 1000 activities)
      expect(renderTime).toBeLessThan(10000);

      // Verify Gantt chart is visible
      const isVisible = await scheduleDetailPage.verifyGanttChartRendered();
      expect(isVisible).toBe(true);
    });

    test('should maintain API response time under 500ms for schedule data', async ({
      page,
      loginPage,
      scheduleDetailPage,
    }) => {
      await loginPage.goto();
      await loginPage.login(schedulerUser.email, schedulerUser.password);

      // Measure API load time
      const apiTime = await scheduleDetailPage.measureAPILoadTime();

      // API should respond within 500ms
      expect(apiTime).toBeLessThan(500);
    });

    test('should handle large schedule navigation smoothly', async ({
      page,
      loginPage,
      scheduleDetailPage,
    }) => {
      await loginPage.goto();
      await loginPage.login(schedulerUser.email, schedulerUser.password);

      await scheduleDetailPage.goto(projectId, largeScheduleId);

      // Verify activities are loaded
      const activityCount = await scheduleDetailPage.getActivityCount();
      expect(activityCount).toBeGreaterThanOrEqual(1000);

      // Verify page is interactive (not frozen)
      const startTime = Date.now();
      await scheduleDetailPage.ganttChart.click();
      const interactionTime = Date.now() - startTime;

      // Should respond to interaction quickly
      expect(interactionTime).toBeLessThan(1000);
    });
  });
});
