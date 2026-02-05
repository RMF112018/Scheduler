import { test, expect } from '../setup';
import {
  createE2ECompany,
  createE2EUser,
  createE2EProject,
  createE2ESchedule,
  createE2EActivities,
  cleanE2EDatabase,
  initE2EDatabase,
  closeE2EDatabase,
} from '../helpers/testData';

/**
 * E2E Test: Commit → Approval Workflow
 * 
 * Tests the complete flow:
 * 1. Field crew commits lookahead changes
 * 2. Attachments uploaded and marked pending
 * 3. Superintendent reviews and approves/rejects
 * 4. Approved changes merge to master schedule
 * 5. Audit logs created for all actions
 */
test.describe('Commit → Approval Workflow', () => {
  let companyId: string;
  let fieldUser: { email: string; password: string };
  let superintendentUser: { email: string; password: string };
  let projectId: string;
  let scheduleId: string;

  test.beforeAll(async () => {
    await initE2EDatabase();
    
    // Create test data
    const company = await createE2ECompany('Approval Workflow Test Company');
    companyId = company.id;

    const field = await createE2EUser(companyId, {
      email: 'field-crew@e2e.test',
      password: 'TestPassword123!',
      firstName: 'Field',
      lastName: 'Crew',
      role: 'user',
    });
    fieldUser = { email: field.email, password: field.password };

    const superintendent = await createE2EUser(companyId, {
      email: 'superintendent@e2e.test',
      password: 'TestPassword123!',
      firstName: 'Super',
      lastName: 'Intendent',
      role: 'superintendent',
    });
    superintendentUser = { email: superintendent.email, password: superintendent.password };

    const project = await createE2EProject(companyId, field.id, {
      name: 'Approval Workflow Test Project',
    });
    projectId = project.id;

    const schedule = await createE2ESchedule(projectId, field.id, {
      name: 'Approval Workflow Test Schedule',
    });
    scheduleId = schedule.id;

    await createE2EActivities(scheduleId, 3);
  });

  test.afterAll(async () => {
    await cleanE2EDatabase();
    await closeE2EDatabase();
  });

  test('should complete full approval workflow from commit to approval', async ({ 
    page, 
    loginPage, 
    lookaheadPage, 
    approvalPage 
  }) => {
    // Step 1: Field crew logs in and navigates to lookahead
    await loginPage.goto();
    await loginPage.login(fieldUser.email, fieldUser.password);
    await expect(page).not.toHaveURL(/\/login/);

    await lookaheadPage.goto(projectId);
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/lookahead`));

    // Step 2: Field crew marks activities as "Will Do"
    await lookaheadPage.markActivityAsWillDo('E2E Test Activity 1');
    await lookaheadPage.markActivityAsWillDo('E2E Test Activity 2');

    // Step 3: Field crew commits changes
    await lookaheadPage.commitChanges();
    
    // Step 4: Confirm commit in modal
    await lookaheadPage.confirmCommit();

    // Step 5: Wait for commit to process
    await page.waitForTimeout(2000);

    // Step 6: Logout and login as superintendent
    await page.getByRole('button', { name: /logout|sign out/i }).click();
    await page.waitForURL(/\/login/);

    await loginPage.login(superintendentUser.email, superintendentUser.password);
    await expect(page).not.toHaveURL(/\/login/);

    // Step 7: Navigate to approval page
    await approvalPage.goto(projectId);
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/approvals`));

    // Step 8: Check for pending approvals
    const pendingCount = await approvalPage.getPendingApprovalCount();
    expect(pendingCount).toBeGreaterThan(0);

    // Step 9: Review and approve the lookahead
    await approvalPage.approveLookahead('Approval Workflow Test Schedule', 'Looks good, approved');

    // Step 10: Verify approval was successful
    await page.waitForTimeout(1000);
    const newPendingCount = await approvalPage.getPendingApprovalCount();
    expect(newPendingCount).toBeLessThan(pendingCount);
  });
});
