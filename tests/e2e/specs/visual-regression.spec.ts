/**
 * Visual Regression Tests
 * 
 * Uses Playwright's screenshot comparison to catch UI shifts automatically.
 * Tests critical UI components: Gantt Chart, Flow Editor, Activity Cards.
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

test.describe('Visual Regression Tests', () => {
  let companyId: string;
  let user: { email: string; password: string; id: string };
  let projectId: string;
  let scheduleId: string;

  test.beforeAll(async () => {
    await initE2EDatabase();

    const company = await createE2ECompany('Visual Regression Test Company');
    companyId = company.id;

    const userData = await createE2EUser(companyId, {
      email: 'visual@test.com',
      password: 'TestPassword123!',
      role: 'pm',
    });
    user = {
      email: userData.email,
      password: userData.password,
      id: userData.id,
    };

    const project = await createE2EProject(companyId, userData.id, {
      name: 'Visual Regression Test Project',
    });
    projectId = project.id;

    const scheduleData = await createScheduleWithActivities({
      projectId,
      createdBy: userData.id,
      activityCount: 10,
      includeRelationships: true,
    });
    scheduleId = scheduleData.schedule.id;
  });

  test.afterAll(async () => {
    await cleanE2EDatabase();
    await closeE2EDatabase();
  });

  test('should match Gantt chart screenshot', async ({
    page,
    loginPage,
    scheduleDetailPage,
  }) => {
    await loginPage.goto();
    await loginPage.login(user.email, user.password);

    await scheduleDetailPage.goto(projectId, scheduleId);

    // Wait for Gantt chart to fully render
    await scheduleDetailPage.ganttChart.waitFor({ state: 'visible' });
    await page.waitForTimeout(2000); // Allow animations to complete

    // Take screenshot of Gantt chart
    await expect(scheduleDetailPage.ganttChart).toHaveScreenshot('gantt-chart.png', {
      maxDiffPixels: 100,
    });
  });

  test('should match activity card screenshot', async ({
    page,
    loginPage,
    lookaheadViewPage,
  }) => {
    await loginPage.goto();
    await loginPage.login(user.email, user.password);

    await lookaheadViewPage.goto(projectId);

    // Wait for activity cards to load
    await lookaheadViewPage.activityCard.first().waitFor({ state: 'visible' });
    await page.waitForTimeout(1000);

    // Take screenshot of first activity card
    const firstCard = lookaheadViewPage.activityCard.first();
    await expect(firstCard).toHaveScreenshot('activity-card.png', {
      maxDiffPixels: 50,
    });
  });

  test('should match pending assignment landing page', async ({
    page,
    loginPage,
    pendingAssignmentPage,
  }) => {
    // Create new user for this test
    const { createNewUser } = await import('../fixtures/UserFactory');
    const newUserData = await createNewUser(companyId);

    await loginPage.goto();
    await loginPage.login(newUserData.email, 'TestPassword123!');

    // Should be on pending assignment page
    await expect(page).toHaveURL(/\/pending-assignment/);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take screenshot of entire page
    await expect(page).toHaveScreenshot('pending-assignment-landing.png', {
      fullPage: true,
      maxDiffPixels: 200,
    });
  });
});
