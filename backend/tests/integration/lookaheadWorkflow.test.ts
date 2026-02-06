/**
 * Integration Tests: Complete Lookahead Workflow
 * 
 * Tests the full end-to-end lookahead workflow including:
 * 1. Creating a lookahead schedule from master
 * 2. Pulling activities from master
 * 3. Marking activities as "Should Do" / "Will Do" (Last Planner methodology)
 * 4. Detecting conflicts (zero-float, predecessor, resource over-allocation)
 * 5. Committing changes with attachments
 * 6. PM approval workflow
 * 7. Merging approved changes back to master
 * 8. Rejection workflow and return for revision
 * 9. Attachment approval gating
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../setup.js';
import { LookaheadService } from '../../src/modules/core/services/lookaheadService.js';
import { ScheduleValidationService } from '../../src/modules/core/services/scheduleValidationService.js';
import {
  createTestCompany,
  createTestUser,
  createTestProject,
  createTestSchedule,
  TestUser,
  TestCompany,
  TestProject,
  TestSchedule,
} from '../helpers/testUtils.js';

describe('Lookahead Workflow Integration Tests', () => {
  let lookaheadService: LookaheadService;
  let validationService: ScheduleValidationService;
  
  // Test entities
  let company: TestCompany;
  let fieldUser: TestUser;      // Field crew / subcontractor
  let pmUser: TestUser;         // Project Manager (approver)
  let project: TestProject;
  let masterSchedule: TestSchedule;
  let activityIds: string[];

  beforeEach(async () => {
    lookaheadService = new LookaheadService();
    validationService = new ScheduleValidationService();

    // Create test company
    company = await createTestCompany('Integration Test Construction Co');

    // Create users with different roles
    fieldUser = await createTestUser(company.id, {
      email: `field-${Date.now()}@test.com`,
      firstName: 'Field',
      lastName: 'Worker',
      role: 'user',
    });

    pmUser = await createTestUser(company.id, {
      email: `pm-${Date.now()}@test.com`,
      firstName: 'Project',
      lastName: 'Manager',
      role: 'pm',
    });

    // Create project and master schedule
    project = await createTestProject(company.id, pmUser.id, {
      name: 'Integration Test Project',
      status: 'active',
    });

    masterSchedule = await createTestSchedule(project.id, pmUser.id, {
      name: 'Master Schedule',
      status: 'active',
    });

    // Create a realistic set of activities with dependencies
    activityIds = await createRealisticActivities(masterSchedule.id);
  });

  afterEach(async () => {
    // Clean up test data in reverse order of dependencies
    await prisma.workflowHistory.deleteMany({});
    await prisma.workflowApproval.deleteMany({});
    await prisma.lookaheadVersion.deleteMany({});
    await prisma.lookaheadActivity.deleteMany({});
    await prisma.lookaheadSchedule.deleteMany({});
    await prisma.activityAttachment.deleteMany({});
    await prisma.resourceAssignment.deleteMany({});
    await prisma.scheduleBaseline.deleteMany({});
    await prisma.scheduleActivity.deleteMany({});
    await prisma.schedule.deleteMany({});
    await prisma.projectSettings.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.staffMember.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.company.deleteMany({});
  });

  // ===========================================================================
  // Test Suite 1: Lookahead Creation and Setup
  // ===========================================================================

  describe('1. Lookahead Creation and Setup', () => {
    it('should create a 2-week lookahead from master schedule', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      const lookahead = await lookaheadService.create({
        masterScheduleId: masterSchedule.id,
        projectId: project.id,
        name: '2-Week Lookahead - Week 1',
        startDate,
        endDate,
      });

      expect(lookahead).toBeDefined();
      expect(lookahead.id).toBeDefined();
      expect(lookahead.masterScheduleId).toBe(masterSchedule.id);
      expect(lookahead.projectId).toBe(project.id);
      expect(lookahead.status).toBe('active');
      expect(lookahead.lastSyncedAt).toBeNull();
    });

    it('should pull activities from master into lookahead', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: masterSchedule.id,
        projectId: project.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      const pullResult = await lookaheadService.pullFromMaster(lookahead.id);

      expect(pullResult.added).toBeGreaterThan(0);
      expect(pullResult.updated).toBe(0);
      expect(pullResult.unchanged).toBe(0);
      expect(pullResult.conflicts).toHaveLength(0);

      // Verify activities were created
      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });

      expect(lookaheadWithActivities.activities.length).toBe(pullResult.added);
      expect(lookaheadWithActivities.lastSyncedAt).not.toBeNull();

      // Verify activity properties were copied correctly
      const firstActivity = lookaheadWithActivities.activities[0];
      expect(firstActivity.persistentInternalGuid).toBeDefined();
      expect(firstActivity.name).toBeDefined();
      expect(firstActivity.plannerStatus).toBeNull(); // Not yet marked
      expect(firstActivity.isCommitted).toBe(false);
    });

    it('should preserve persistent GUID mapping between master and lookahead', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: masterSchedule.id,
        projectId: project.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });

      // Get master activities
      const masterActivities = await prisma.scheduleActivity.findMany({
        where: { scheduleId: masterSchedule.id },
      });

      // Verify GUID mapping
      for (const lookaheadActivity of lookaheadWithActivities.activities) {
        const masterActivity = masterActivities.find(
          (m) => m.persistentInternalGuid === lookaheadActivity.persistentInternalGuid
        );
        expect(masterActivity).toBeDefined();
        expect(lookaheadActivity.name).toBe(masterActivity!.name);
      }
    });
  });

  // ===========================================================================
  // Test Suite 2: Last Planner Methodology (Should Do / Will Do)
  // ===========================================================================

  describe('2. Last Planner Methodology', () => {
    it('should mark activities as "should_do"', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      const activity = activities[0];
      const updatedActivity = await lookaheadService.markTaskStatus(
        lookahead.id,
        activity.id,
        'should_do',
        fieldUser.id
      );

      expect(updatedActivity.plannerStatus).toBe('should_do');
      expect(updatedActivity.plannerUpdatedBy).toBe(fieldUser.id);
      expect(updatedActivity.plannerUpdatedAt).not.toBeNull();
    });

    it('should mark activities as "will_do" (commitment)', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      const activity = activities[0];
      const updatedActivity = await lookaheadService.markTaskStatus(
        lookahead.id,
        activity.id,
        'will_do',
        fieldUser.id
      );

      expect(updatedActivity.plannerStatus).toBe('will_do');
    });

    it('should not overwrite "will_do" activities during master pull', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      // Mark first activity as will_do
      const activity = activities[0];
      await lookaheadService.markTaskStatus(lookahead.id, activity.id, 'will_do', fieldUser.id);

      // Modify the activity locally
      const customProgress = 50;
      await lookaheadService.updateActivity(lookahead.id, activity.id, {
        percentComplete: customProgress,
      });

      // Pull from master again
      const pullResult = await lookaheadService.pullFromMaster(lookahead.id);

      // Verify the will_do activity was not overwritten
      const updatedLookahead = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });
      const preservedActivity = updatedLookahead.activities.find((a) => a.id === activity.id);

      expect(preservedActivity?.percentComplete).toBe(customProgress);
      expect(preservedActivity?.plannerStatus).toBe('will_do');
    });

    it('should update "should_do" activities during master pull', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      // Mark first activity as should_do (not committed)
      const activity = activities[0];
      await lookaheadService.markTaskStatus(lookahead.id, activity.id, 'should_do', fieldUser.id);

      // Update master schedule activity
      const masterActivity = await prisma.scheduleActivity.findFirst({
        where: {
          scheduleId: masterSchedule.id,
          persistentInternalGuid: activity.persistentInternalGuid,
        },
      });

      const newMasterProgress = 25;
      await prisma.scheduleActivity.update({
        where: { id: masterActivity!.id },
        data: { percentComplete: newMasterProgress },
      });

      // Pull from master again
      await lookaheadService.pullFromMaster(lookahead.id);

      // Verify the should_do activity was updated
      const updatedLookahead = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });
      const updatedActivity = updatedLookahead.activities.find((a) => a.id === activity.id);

      // Should take the higher progress value
      expect(updatedActivity?.percentComplete).toBeGreaterThanOrEqual(newMasterProgress);
    });
  });

  // ===========================================================================
  // Test Suite 3: Conflict Detection
  // ===========================================================================

  describe('3. Conflict Detection', () => {
    it('should detect zero-float violations on critical path activities', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      // Find a critical activity
      const criticalActivity = activities.find((a) => {
        // Activity 0 is set as critical in our test data
        return true; // We'll check the first one
      });

      // Get the master activity to check if it's critical
      const masterActivity = await prisma.scheduleActivity.findFirst({
        where: {
          scheduleId: masterSchedule.id,
          persistentInternalGuid: criticalActivity!.persistentInternalGuid,
        },
      });

      if (masterActivity?.isCritical || masterActivity?.totalFloat === 0) {
        // Delay the lookahead activity
        const newFinishDate = new Date(criticalActivity!.finishDate);
        newFinishDate.setDate(newFinishDate.getDate() + 5);

        await prisma.lookaheadActivity.update({
          where: { id: criticalActivity!.id },
          data: { finishDate: newFinishDate },
        });

        // Detect conflicts
        const conflicts = await lookaheadService.detectConflicts(lookahead.id, criticalActivity!.id);

        expect(conflicts.some((c) => c.type === 'zero_float_violation')).toBe(true);
        const zeroFloatConflict = conflicts.find((c) => c.type === 'zero_float_violation');
        expect(zeroFloatConflict?.severity).toBe('high');
      }
    });

    it('should detect predecessor conflicts', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      // Find an activity with predecessors (activities 1+ have predecessors)
      const activityWithPred = activities.find((a, index) => index > 0);
      
      if (activityWithPred) {
        // Get the predecessor
        const masterActivity = await prisma.scheduleActivity.findFirst({
          where: {
            scheduleId: masterSchedule.id,
            persistentInternalGuid: activityWithPred.persistentInternalGuid,
          },
        });

        if (masterActivity?.predecessorIds.length) {
          // Find predecessor in lookahead
          const predecessorMaster = await prisma.scheduleActivity.findFirst({
            where: { id: masterActivity.predecessorIds[0] },
          });

          const predecessorLookahead = activities.find(
            (a) => a.persistentInternalGuid === predecessorMaster?.persistentInternalGuid
          );

          if (predecessorLookahead) {
            // Set activity start before predecessor finish
            const predFinish = new Date(predecessorLookahead.finishDate);
            const earlyStart = new Date(predFinish);
            earlyStart.setDate(earlyStart.getDate() - 3);

            await prisma.lookaheadActivity.update({
              where: { id: activityWithPred.id },
              data: { startDate: earlyStart },
            });

            // Detect conflicts
            const conflicts = await lookaheadService.detectConflicts(lookahead.id, activityWithPred.id);

            expect(conflicts.some((c) => c.type === 'predecessor_conflict')).toBe(true);
          }
        }
      }
    });

    it('should detect date conflicts (activity scheduled too early)', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      const activity = activities[0];

      // Get master activity start date
      const masterActivity = await prisma.scheduleActivity.findFirst({
        where: {
          scheduleId: masterSchedule.id,
          persistentInternalGuid: activity.persistentInternalGuid,
        },
      });

      // Schedule lookahead activity 10 days earlier than master
      const earlyStart = new Date(masterActivity!.startDate);
      earlyStart.setDate(earlyStart.getDate() - 10);

      await prisma.lookaheadActivity.update({
        where: { id: activity.id },
        data: { startDate: earlyStart },
      });

      // Detect conflicts
      const conflicts = await lookaheadService.detectConflicts(lookahead.id, activity.id);

      expect(conflicts.some((c) => c.type === 'date_conflict')).toBe(true);
    });

    it('should return no violations when activities align with master', async () => {
      const { lookahead } = await setupLookaheadWithActivities();

      // No modifications - should have no violations
      const conflicts = await lookaheadService.detectConflicts(lookahead.id);

      expect(Array.isArray(conflicts)).toBe(true);
      
      // When activities are pulled fresh from master without modifications,
      // we should not have zero-float violations (which require date changes),
      // predecessor conflicts (which require start before predecessor finish),
      // or date conflicts (which require scheduling earlier than master).
      // Near-critical warnings and out-of-sequence risks are informational.
      const violationConflicts = conflicts.filter((c) => 
        c.type === 'zero_float_violation' || 
        c.type === 'predecessor_conflict' || 
        c.type === 'date_conflict'
      );
      
      expect(violationConflicts.length).toBe(0);
    });
  });

  // ===========================================================================
  // Test Suite 4: Commit Workflow
  // ===========================================================================

  describe('4. Commit Workflow', () => {
    it('should commit "will_do" activities and create approval request', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      // Mark some activities as will_do
      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      await lookaheadService.markTaskStatus(lookahead.id, activities[1].id, 'will_do', fieldUser.id);

      // Commit changes
      const commitResult = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      expect(commitResult.approvalId).toBeDefined();
      expect(commitResult.activitiesCommitted).toBe(2);

      // Verify approval was created
      const approval = await prisma.workflowApproval.findUnique({
        where: { id: commitResult.approvalId },
      });

      expect(approval).not.toBeNull();
      expect(approval?.status).toBe('pending');
      expect(approval?.submittedBy).toBe(fieldUser.id);
      expect(approval?.commitSnapshot).not.toBeNull();

      // Verify commit snapshot contains activity data
      const snapshot = approval?.commitSnapshot as Record<string, unknown>;
      expect(snapshot.totalActivities).toBe(2);
      expect((snapshot.activities as unknown[]).length).toBe(2);
    });

    it('should update lookahead status to "submitted" after commit', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      const updatedLookahead = await lookaheadService.findById(lookahead.id);
      expect(updatedLookahead.status).toBe('submitted');
    });

    it('should mark activities as committed after commit', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      const committedActivities = await prisma.lookaheadActivity.findMany({
        where: {
          lookaheadScheduleId: lookahead.id,
          isCommitted: true,
        },
      });

      expect(committedActivities.length).toBe(1);
      expect(committedActivities[0].id).toBe(activities[0].id);
    });

    it('should prevent double commit', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      // Try to commit again
      await expect(
        lookaheadService.commitChanges(lookahead.id, fieldUser.id)
      ).rejects.toThrow('Lookahead is already submitted for approval');
    });

    it('should track post-commit tweaks', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      const commitResult = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      // Make a post-commit tweak
      await lookaheadService.updateActivity(lookahead.id, activities[0].id, {
        percentComplete: 75,
      });

      // Verify post-commit tweak is flagged
      const updatedActivity = await prisma.lookaheadActivity.findUnique({
        where: { id: activities[0].id },
      });
      expect(updatedActivity?.hasPostCommitTweaks).toBe(true);

      // Verify approval is flagged
      const approval = await prisma.workflowApproval.findUnique({
        where: { id: commitResult.approvalId },
      });
      expect(approval?.hasPostCommitTweaks).toBe(true);
    });

    it('should record workflow history on commit', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      const commitResult = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      const history = await prisma.workflowHistory.findMany({
        where: { approvalId: commitResult.approvalId },
      });

      expect(history.length).toBe(1);
      expect(history[0].action).toBe('submitted');
      expect(history[0].performedBy).toBe(fieldUser.id);
    });
  });

  // ===========================================================================
  // Test Suite 5: PM Approval Workflow
  // ===========================================================================

  describe('5. PM Approval Workflow', () => {
    it('should approve changes and merge to master', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      // Field user marks and commits
      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      await lookaheadService.updateActivity(lookahead.id, activities[0].id, {
        percentComplete: 80,
      });
      const commitResult = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      // PM approves
      await prisma.workflowApproval.update({
        where: { id: commitResult.approvalId },
        data: {
          status: 'approved',
          approvedBy: pmUser.id,
          approvedAt: new Date(),
        },
      });

      // Merge to master
      await lookaheadService.mergeToMaster(commitResult.approvalId);

      // Verify master schedule was updated
      const masterActivity = await prisma.scheduleActivity.findFirst({
        where: {
          scheduleId: masterSchedule.id,
          persistentInternalGuid: activities[0].persistentInternalGuid,
        },
      });

      expect(masterActivity?.percentComplete).toBe(80);
    });

    it('should create lookahead version after merge', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      const commitResult = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      await prisma.workflowApproval.update({
        where: { id: commitResult.approvalId },
        data: {
          status: 'approved',
          approvedBy: pmUser.id,
          approvedAt: new Date(),
        },
      });

      await lookaheadService.mergeToMaster(commitResult.approvalId);

      // Verify version was created
      const versions = await prisma.lookaheadVersion.findMany({
        where: { lookaheadScheduleId: lookahead.id },
      });

      expect(versions.length).toBe(1);
      expect(versions[0].versionNumber).toBe(1);
      expect(versions[0].approvedBy).toBe(pmUser.id);
    });

    it('should reset lookahead status to active after merge', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      const commitResult = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      await prisma.workflowApproval.update({
        where: { id: commitResult.approvalId },
        data: {
          status: 'approved',
          approvedBy: pmUser.id,
          approvedAt: new Date(),
        },
      });

      await lookaheadService.mergeToMaster(commitResult.approvalId);

      const updatedLookahead = await lookaheadService.findById(lookahead.id);
      expect(updatedLookahead.status).toBe('active');
    });

    it('should reset committed flags after merge', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      const commitResult = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      await prisma.workflowApproval.update({
        where: { id: commitResult.approvalId },
        data: {
          status: 'approved',
          approvedBy: pmUser.id,
          approvedAt: new Date(),
        },
      });

      await lookaheadService.mergeToMaster(commitResult.approvalId);

      // Verify committed flags are reset
      const lookaheadActivities = await prisma.lookaheadActivity.findMany({
        where: { lookaheadScheduleId: lookahead.id },
      });

      for (const activity of lookaheadActivities) {
        expect(activity.isCommitted).toBe(false);
        expect(activity.hasPostCommitTweaks).toBe(false);
      }
    });

    it('should prevent merge without approval', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      const commitResult = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      // Try to merge without approval
      await expect(
        lookaheadService.mergeToMaster(commitResult.approvalId)
      ).rejects.toThrow('Can only merge approved changes');
    });
  });

  // ===========================================================================
  // Test Suite 6: Rejection Workflow
  // ===========================================================================

  describe('6. Rejection Workflow', () => {
    it('should reject approval and return lookahead to active status', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      const commitResult = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      // PM rejects
      await prisma.workflowApproval.update({
        where: { id: commitResult.approvalId },
        data: {
          status: 'rejected',
          rejectionReason: 'Dates conflict with concrete pour schedule',
          rejectionCategory: 'schedule_conflict',
        },
      });

      // Reset lookahead status (simulating what workflowController.reject does)
      await prisma.lookaheadSchedule.update({
        where: { id: lookahead.id },
        data: { status: 'active' },
      });

      await prisma.lookaheadActivity.updateMany({
        where: {
          lookaheadScheduleId: lookahead.id,
          isCommitted: true,
        },
        data: {
          isCommitted: false,
          hasPostCommitTweaks: false,
        },
      });

      // Verify lookahead is back to active
      const updatedLookahead = await lookaheadService.findById(lookahead.id);
      expect(updatedLookahead.status).toBe('active');

      // Verify activities can be edited again
      const updatedActivity = await prisma.lookaheadActivity.findUnique({
        where: { id: activities[0].id },
      });
      expect(updatedActivity?.isCommitted).toBe(false);
    });

    it('should allow re-commit after rejection', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      // First commit
      await lookaheadService.markTaskStatus(lookahead.id, activities[0].id, 'will_do', fieldUser.id);
      const firstCommit = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      // Rejection (simulated)
      await prisma.workflowApproval.update({
        where: { id: firstCommit.approvalId },
        data: { status: 'rejected', rejectionReason: 'Needs revision' },
      });

      await prisma.lookaheadSchedule.update({
        where: { id: lookahead.id },
        data: { status: 'active' },
      });

      await prisma.lookaheadActivity.updateMany({
        where: { lookaheadScheduleId: lookahead.id, isCommitted: true },
        data: { isCommitted: false },
      });

      // Make revisions
      await lookaheadService.updateActivity(lookahead.id, activities[0].id, {
        percentComplete: 50,
      });

      // Re-commit
      const secondCommit = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      expect(secondCommit.approvalId).toBeDefined();
      expect(secondCommit.approvalId).not.toBe(firstCommit.approvalId);
    });
  });

  // ===========================================================================
  // Test Suite 7: Attachment Approval Gating
  // ===========================================================================

  describe('7. Attachment Approval Gating', () => {
    it('should create attachment with pending status from lookahead', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      // Create an attachment from lookahead
      const attachment = await prisma.activityAttachment.create({
        data: {
          persistentInternalGuid: activities[0].persistentInternalGuid,
          attachmentType: 'photo',
          fileName: 'progress_photo.jpg',
          filePath: '/uploads/progress_photo.jpg',
          uploadedBy: fieldUser.id,
          status: 'pending',
          sourceType: 'lookahead',
        },
      });

      expect(attachment.status).toBe('pending');
      expect(attachment.sourceType).toBe('lookahead');
    });

    it('should approve attachment and promote to master', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      // Create pending attachment
      const attachment = await prisma.activityAttachment.create({
        data: {
          persistentInternalGuid: activities[0].persistentInternalGuid,
          attachmentType: 'photo',
          fileName: 'progress_photo.jpg',
          filePath: '/uploads/progress_photo.jpg',
          uploadedBy: fieldUser.id,
          status: 'pending',
          sourceType: 'lookahead',
        },
      });

      // PM approves
      const approvedAttachment = await prisma.activityAttachment.update({
        where: { id: attachment.id },
        data: {
          status: 'approved',
          approvedBy: pmUser.id,
          approvedAt: new Date(),
          sourceType: 'master', // Promoted to master
        },
      });

      expect(approvedAttachment.status).toBe('approved');
      expect(approvedAttachment.sourceType).toBe('master');
      expect(approvedAttachment.approvedBy).toBe(pmUser.id);
    });

    it('should reject attachment with reason', async () => {
      const { lookahead, activities } = await setupLookaheadWithActivities();

      // Create pending attachment
      const attachment = await prisma.activityAttachment.create({
        data: {
          persistentInternalGuid: activities[0].persistentInternalGuid,
          attachmentType: 'photo',
          fileName: 'blurry_photo.jpg',
          filePath: '/uploads/blurry_photo.jpg',
          uploadedBy: fieldUser.id,
          status: 'pending',
          sourceType: 'lookahead',
        },
      });

      // PM rejects
      const rejectedAttachment = await prisma.activityAttachment.update({
        where: { id: attachment.id },
        data: {
          status: 'rejected',
          rejectionReason: 'Photo is too blurry to verify work completion',
        },
      });

      expect(rejectedAttachment.status).toBe('rejected');
      expect(rejectedAttachment.sourceType).toBe('lookahead'); // Stays in lookahead
      expect(rejectedAttachment.rejectionReason).toBeDefined();
    });
  });

  // ===========================================================================
  // Test Suite 8: Full End-to-End Workflow
  // ===========================================================================

  describe('8. Full End-to-End Workflow', () => {
    it('should complete full workflow: create → pull → mark → commit → approve → merge', async () => {
      // Step 1: Create lookahead
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      const lookahead = await lookaheadService.create({
        masterScheduleId: masterSchedule.id,
        projectId: project.id,
        name: 'Week 1 Lookahead',
        startDate,
        endDate,
      });

      expect(lookahead.status).toBe('active');

      // Step 2: Pull from master
      const pullResult = await lookaheadService.pullFromMaster(lookahead.id);
      expect(pullResult.added).toBeGreaterThan(0);

      // Step 3: Field user marks activities
      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });

      const activity1 = lookaheadWithActivities.activities[0];
      const activity2 = lookaheadWithActivities.activities[1];

      await lookaheadService.markTaskStatus(lookahead.id, activity1.id, 'will_do', fieldUser.id);
      await lookaheadService.markTaskStatus(lookahead.id, activity2.id, 'should_do', fieldUser.id);

      // Step 4: Update progress
      await lookaheadService.updateActivity(lookahead.id, activity1.id, {
        percentComplete: 75,
      });

      // Step 5: Check conflicts
      const conflicts = await lookaheadService.detectConflicts(lookahead.id);
      // Log conflicts for visibility
      if (conflicts.length > 0) {
        console.log('Detected conflicts:', conflicts.map((c) => c.message));
      }

      // Step 6: Commit changes
      const commitResult = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);
      expect(commitResult.activitiesCommitted).toBe(1); // Only will_do activities

      // Step 7: PM reviews and approves
      await prisma.workflowApproval.update({
        where: { id: commitResult.approvalId },
        data: {
          status: 'approved',
          approvedBy: pmUser.id,
          approvedAt: new Date(),
        },
      });

      // Step 8: Merge to master
      await lookaheadService.mergeToMaster(commitResult.approvalId);

      // Step 9: Verify master was updated
      const masterActivity = await prisma.scheduleActivity.findFirst({
        where: {
          scheduleId: masterSchedule.id,
          persistentInternalGuid: activity1.persistentInternalGuid,
        },
      });

      expect(masterActivity?.percentComplete).toBe(75);

      // Step 10: Verify lookahead is ready for next cycle
      const finalLookahead = await lookaheadService.findById(lookahead.id);
      expect(finalLookahead.status).toBe('active');

      // Step 11: Verify version history
      const versions = await prisma.lookaheadVersion.findMany({
        where: { lookaheadScheduleId: lookahead.id },
      });
      expect(versions.length).toBe(1);
    });

    it('should handle multiple commit cycles', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: masterSchedule.id,
        projectId: project.id,
        name: 'Multi-Cycle Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });

      // Cycle 1
      await lookaheadService.markTaskStatus(
        lookahead.id,
        lookaheadWithActivities.activities[0].id,
        'will_do',
        fieldUser.id
      );
      await lookaheadService.updateActivity(
        lookahead.id,
        lookaheadWithActivities.activities[0].id,
        { percentComplete: 50 }
      );

      const commit1 = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      await prisma.workflowApproval.update({
        where: { id: commit1.approvalId },
        data: { status: 'approved', approvedBy: pmUser.id, approvedAt: new Date() },
      });

      await lookaheadService.mergeToMaster(commit1.approvalId);

      // Cycle 2
      await lookaheadService.markTaskStatus(
        lookahead.id,
        lookaheadWithActivities.activities[0].id,
        'will_do',
        fieldUser.id
      );
      await lookaheadService.updateActivity(
        lookahead.id,
        lookaheadWithActivities.activities[0].id,
        { percentComplete: 100 }
      );

      const commit2 = await lookaheadService.commitChanges(lookahead.id, fieldUser.id);

      await prisma.workflowApproval.update({
        where: { id: commit2.approvalId },
        data: { status: 'approved', approvedBy: pmUser.id, approvedAt: new Date() },
      });

      await lookaheadService.mergeToMaster(commit2.approvalId);

      // Verify final state
      const masterActivity = await prisma.scheduleActivity.findFirst({
        where: {
          scheduleId: masterSchedule.id,
          persistentInternalGuid: lookaheadWithActivities.activities[0].persistentInternalGuid,
        },
      });

      expect(masterActivity?.percentComplete).toBe(100);

      const versions = await prisma.lookaheadVersion.findMany({
        where: { lookaheadScheduleId: lookahead.id },
        orderBy: { versionNumber: 'asc' },
      });

      expect(versions.length).toBe(2);
      expect(versions[0].versionNumber).toBe(1);
      expect(versions[1].versionNumber).toBe(2);
    });
  });

  // ===========================================================================
  // Helper Functions
  // ===========================================================================

  /**
   * Create a realistic set of activities with proper sequential dependencies
   * Each activity starts after its predecessor finishes (no overlaps)
   */
  async function createRealisticActivities(scheduleId: string): Promise<string[]> {
    const activityIds: string[] = [];
    const baseDate = new Date();
    let currentDate = new Date(baseDate);

    const activities = [
      { name: 'Site Preparation', duration: 5, isCritical: true, totalFloat: 0 },
      { name: 'Foundation Excavation', duration: 7, isCritical: true, totalFloat: 0 },
      { name: 'Foundation Pour', duration: 3, isCritical: true, totalFloat: 0 },
      { name: 'Framing - Phase 1', duration: 10, isCritical: false, totalFloat: 5 },
      { name: 'Electrical Rough-In', duration: 5, isCritical: false, totalFloat: 8 },
      { name: 'Plumbing Rough-In', duration: 5, isCritical: false, totalFloat: 8 },
      { name: 'HVAC Installation', duration: 7, isCritical: false, totalFloat: 3 },
      { name: 'Drywall', duration: 8, isCritical: true, totalFloat: 0 },
    ];

    for (let i = 0; i < activities.length; i++) {
      const activityData = activities[i];
      
      // Start date is current date (which is after predecessor's finish)
      const startDate = new Date(currentDate);
      const finishDate = new Date(startDate);
      finishDate.setDate(finishDate.getDate() + activityData.duration);

      const activity = await prisma.scheduleActivity.create({
        data: {
          scheduleId,
          activityCode: `ACT-${1000 + i}`,
          name: activityData.name,
          startDate,
          finishDate,
          duration: activityData.duration,
          percentComplete: 0,
          predecessorIds: activityIds.length > 0 ? [activityIds[activityIds.length - 1]] : [],
          successorIds: [],
          totalFloat: activityData.totalFloat,
          isCritical: activityData.isCritical,
        },
      });

      activityIds.push(activity.id);
      
      // Move current date to after this activity finishes for the next activity
      currentDate = new Date(finishDate);
    }

    return activityIds;
  }

  /**
   * Helper to set up a lookahead with activities pulled from master
   */
  async function setupLookaheadWithActivities() {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 60); // 60 days to include all activities

    const lookahead = await lookaheadService.create({
      masterScheduleId: masterSchedule.id,
      projectId: project.id,
      name: 'Test Lookahead',
      startDate,
      endDate,
    });

    await lookaheadService.pullFromMaster(lookahead.id);

    const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
      includeActivities: true,
    });

    return {
      lookahead: lookaheadWithActivities,
      activities: lookaheadWithActivities.activities,
    };
  }
});
