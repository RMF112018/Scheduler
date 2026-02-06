import { test, expect } from '../setup';
import {
  createE2ECompany,
  createE2EUser,
  createE2EProject,
  cleanE2EDatabase,
  initE2EDatabase,
  closeE2EDatabase,
} from '../helpers/testData';

/**
 * E2E Test: Role-Based Landing Pages
 * 
 * Smoke tests to verify all role-based landing pages load correctly:
 * - Field crew → Lookahead view
 * - Scheduler → Gantt chart / Schedule view
 * - Executive → Dashboard
 * - Superintendent → Approval queue
 */
test.describe('Role-Based Landing Pages', () => {
  let companyId: string;

  test.beforeAll(async () => {
    await initE2EDatabase();
    
    const company = await createE2ECompany('Role Landing Test Company');
    companyId = company.id;
  });

  test.afterAll(async () => {
    await cleanE2EDatabase();
    await closeE2EDatabase();
  });

  test('field crew should land on lookahead view', async ({ page, loginPage }) => {
    const user = await createE2EUser(companyId, {
      email: 'field@e2e.test',
      password: 'TestPassword123!',
      role: 'user',
    });

    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    
    // Field crew should be redirected to lookahead view
    await expect(page).toHaveURL(/\/lookahead|\/projects\/.*\/lookahead/, { timeout: 10000 });
  });

  test('scheduler should land on schedule view', async ({ page, loginPage }) => {
    const user = await createE2EUser(companyId, {
      email: 'scheduler@e2e.test',
      password: 'TestPassword123!',
      role: 'scheduler',
    });

    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    
    // Scheduler should be redirected to schedule/Gantt view
    await expect(page).toHaveURL(/\/schedules|\/projects\/.*\/schedules/, { timeout: 10000 });
  });

  test('executive should land on dashboard', async ({ page, loginPage }) => {
    const user = await createE2EUser(companyId, {
      email: 'exec@e2e.test',
      password: 'TestPassword123!',
      role: 'exec',
    });

    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    
    // Executive should be redirected to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('superintendent should land on approval queue', async ({ page, loginPage }) => {
    const user = await createE2EUser(companyId, {
      email: 'super@e2e.test',
      password: 'TestPassword123!',
      role: 'superintendent',
    });

    await loginPage.goto();
    await loginPage.login(user.email, user.password);
    
    // Superintendent should be redirected to approval queue
    await expect(page).toHaveURL(/\/approvals/, { timeout: 10000 });
  });
});
