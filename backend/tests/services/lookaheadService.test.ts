import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../setup.js';
import { LookaheadService } from '../../src/modules/core/services/lookaheadService.js';
import {
  createTestCompany,
  createTestUser,
  createTestProject,
  createTestSchedule,
  createTestActivities,
} from '../helpers/testUtils.js';

describe('LookaheadService', () => {
  let lookaheadService: LookaheadService;
  let testCompany: { id: string; name: string };
  let testUser: { id: string; email: string; companyId: string };
  let testProject: { id: string; name: string; companyId: string; createdBy: string };
  let testSchedule: { id: string; name: string; projectId: string; createdBy: string };
  // let activityIds: string[];

  beforeEach(async () => {
    lookaheadService = new LookaheadService();
    
    // Create test data
    testCompany = await createTestCompany('Test Construction Co');
    testUser = await createTestUser(testCompany.id, { role: 'pm' });
    testProject = await createTestProject(testCompany.id, testUser.id);
    testSchedule = await createTestSchedule(testProject.id, testUser.id);
    activityIds = await createTestActivities(testSchedule.id, 5);
  });

  describe('create', () => {
    it('should create a new lookahead schedule', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: '2-Week Lookahead',
        startDate,
        endDate,
      });

      expect(lookahead).toBeDefined();
      expect(lookahead.id).toBeDefined();
      expect(lookahead.name).toBe('2-Week Lookahead');
      expect(lookahead.masterScheduleId).toBe(testSchedule.id);
      expect(lookahead.projectId).toBe(testProject.id);
      expect(lookahead.status).toBe('active');
    });

    it('should throw error if master schedule not found', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      await expect(
        lookaheadService.create({
          masterScheduleId: '00000000-0000-0000-0000-000000000000',
          projectId: testProject.id,
          name: 'Test Lookahead',
          startDate,
          endDate,
        })
      ).rejects.toThrow('Master schedule not found');
    });

    it('should throw error if start date is after end date', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 7); // End date before start date

      await expect(
        lookaheadService.create({
          masterScheduleId: testSchedule.id,
          projectId: testProject.id,
          name: 'Test Lookahead',
          startDate,
          endDate,
        })
      ).rejects.toThrow('Start date must be before end date');
    });
  });

  describe('pullFromMaster', () => {
    it('should pull activities from master schedule into lookahead', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // 30 days to include all test activities

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      const result = await lookaheadService.pullFromMaster(lookahead.id);

      expect(result).toBeDefined();
      expect(result.added).toBeGreaterThan(0);
      expect(result.updated).toBe(0);
      expect(result.unchanged).toBe(0);

      // Verify activities were created in lookahead
      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });
      expect(lookaheadWithActivities.activities.length).toBe(result.added);
    });

    it('should update lastSyncedAt timestamp', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      expect(lookahead.lastSyncedAt).toBeNull();

      await lookaheadService.pullFromMaster(lookahead.id);

      const updatedLookahead = await lookaheadService.findById(lookahead.id);
      expect(updatedLookahead.lastSyncedAt).not.toBeNull();
    });

    it('should not overwrite activities marked as will_do', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      // First pull
      await lookaheadService.pullFromMaster(lookahead.id);

      // Get the first lookahead activity and mark it as will_do
      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });
      const firstActivity = lookaheadWithActivities.activities[0];

      // Mark as will_do
      await lookaheadService.markTaskStatus(
        lookahead.id,
        firstActivity.id,
        'will_do',
        testUser.id
      );

      // Modify the lookahead activity
      const customName = 'Modified by field crew';
      await prisma.lookaheadActivity.update({
        where: { id: firstActivity.id },
        data: { name: customName },
      });

      // Second pull should not overwrite will_do activity
      const _result = await lookaheadService.pullFromMaster(lookahead.id);

      // Verify the activity was not updated
      const activityAfterPull = await prisma.lookaheadActivity.findUnique({
        where: { id: firstActivity.id },
      });
      expect(activityAfterPull?.name).toBe(customName);
    });
  });

  describe('markTaskStatus', () => {
    it('should mark activity as should_do', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });
      const activity = lookaheadWithActivities.activities[0];

      const updatedActivity = await lookaheadService.markTaskStatus(
        lookahead.id,
        activity.id,
        'should_do',
        testUser.id
      );

      expect(updatedActivity.plannerStatus).toBe('should_do');
      expect(updatedActivity.plannerUpdatedBy).toBe(testUser.id);
      expect(updatedActivity.plannerUpdatedAt).not.toBeNull();
    });

    it('should mark activity as will_do', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });
      const activity = lookaheadWithActivities.activities[0];

      const updatedActivity = await lookaheadService.markTaskStatus(
        lookahead.id,
        activity.id,
        'will_do',
        testUser.id
      );

      expect(updatedActivity.plannerStatus).toBe('will_do');
    });

    it('should throw error if activity not found', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await expect(
        lookaheadService.markTaskStatus(
          lookahead.id,
          '00000000-0000-0000-0000-000000000000',
          'will_do',
          testUser.id
        )
      ).rejects.toThrow('Lookahead activity not found');
    });
  });

  describe('commitChanges', () => {
    it('should commit changes and create approval request', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      // Mark some activities as will_do
      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });

      for (const activity of lookaheadWithActivities.activities.slice(0, 2)) {
        await lookaheadService.markTaskStatus(
          lookahead.id,
          activity.id,
          'will_do',
          testUser.id
        );
      }

      // Commit changes
      const result = await lookaheadService.commitChanges(lookahead.id, testUser.id);

      expect(result.approvalId).toBeDefined();
      expect(result.activitiesCommitted).toBe(2);

      // Verify approval was created
      const approval = await prisma.workflowApproval.findUnique({
        where: { id: result.approvalId },
      });
      expect(approval).not.toBeNull();
      expect(approval?.status).toBe('pending');
      expect(approval?.submittedBy).toBe(testUser.id);
      expect(approval?.commitSnapshot).not.toBeNull();

      // Verify lookahead status changed
      const updatedLookahead = await lookaheadService.findById(lookahead.id);
      expect(updatedLookahead.status).toBe('submitted');

      // Verify activities are marked as committed
      const committedActivities = await prisma.lookaheadActivity.findMany({
        where: {
          lookaheadScheduleId: lookahead.id,
          isCommitted: true,
        },
      });
      expect(committedActivities.length).toBe(2);
    });

    it('should throw error if no uncommitted changes', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      // No activities marked as will_do
      await expect(
        lookaheadService.commitChanges(lookahead.id, testUser.id)
      ).rejects.toThrow('No uncommitted changes to commit');
    });

    it('should throw error if already submitted', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });

      await lookaheadService.markTaskStatus(
        lookahead.id,
        lookaheadWithActivities.activities[0].id,
        'will_do',
        testUser.id
      );

      // First commit
      await lookaheadService.commitChanges(lookahead.id, testUser.id);

      // Second commit should fail
      await expect(
        lookaheadService.commitChanges(lookahead.id, testUser.id)
      ).rejects.toThrow('Lookahead is already submitted for approval');
    });
  });

  describe('detectConflicts', () => {
    it('should detect zero-float violations', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });

      // Find a critical activity (totalFloat = 0 or isCritical = true)
      const masterActivities = await prisma.scheduleActivity.findMany({
        where: { scheduleId: testSchedule.id },
      });

      const criticalMasterActivity = masterActivities.find((a) => a.isCritical || a.totalFloat === 0);
      
      if (criticalMasterActivity) {
        const lookaheadActivity = lookaheadWithActivities.activities.find(
          (a) => a.persistentInternalGuid === criticalMasterActivity.persistentInternalGuid
        );

        if (lookaheadActivity) {
          // Delay the lookahead activity
          const newFinishDate = new Date(lookaheadActivity.finishDate);
          newFinishDate.setDate(newFinishDate.getDate() + 5);

          await prisma.lookaheadActivity.update({
            where: { id: lookaheadActivity.id },
            data: { finishDate: newFinishDate },
          });

          // Check for conflicts
          const conflicts = await lookaheadService.detectConflicts(lookahead.id, lookaheadActivity.id);

          expect(conflicts.length).toBeGreaterThan(0);
          expect(conflicts.some((c) => c.type === 'zero_float_violation')).toBe(true);
        }
      }
    });

    it('should return empty array when no conflicts', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      // No modifications, should have no conflicts
      const conflicts = await lookaheadService.detectConflicts(lookahead.id);

      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  describe('updateActivity', () => {
    it('should update a lookahead activity', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });
      const activity = lookaheadWithActivities.activities[0];

      const updatedActivity = await lookaheadService.updateActivity(
        lookahead.id,
        activity.id,
        { percentComplete: 50 }
      );

      expect(updatedActivity.percentComplete).toBe(50);
    });

    it('should track post-commit tweaks', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });
      const activity = lookaheadWithActivities.activities[0];

      // Mark as will_do and commit
      await lookaheadService.markTaskStatus(lookahead.id, activity.id, 'will_do', testUser.id);
      await lookaheadService.commitChanges(lookahead.id, testUser.id);

      // Update after commit
      const updatedActivity = await lookaheadService.updateActivity(
        lookahead.id,
        activity.id,
        { percentComplete: 75 }
      );

      expect(updatedActivity.hasPostCommitTweaks).toBe(true);

      // Verify approval is flagged
      const approval = await lookaheadService.getPendingApproval(lookahead.id);
      expect(approval?.hasPostCommitTweaks).toBe(true);
    });
  });

  describe('mergeToMaster', () => {
    it('should merge approved changes to master schedule', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });
      const activity = lookaheadWithActivities.activities[0];

      // Mark as will_do and update
      await lookaheadService.markTaskStatus(lookahead.id, activity.id, 'will_do', testUser.id);
      await lookaheadService.updateActivity(lookahead.id, activity.id, { percentComplete: 80 });

      // Commit
      const commitResult = await lookaheadService.commitChanges(lookahead.id, testUser.id);

      // Approve the changes
      await prisma.workflowApproval.update({
        where: { id: commitResult.approvalId },
        data: {
          status: 'approved',
          approvedBy: testUser.id,
          approvedAt: new Date(),
        },
      });

      // Merge to master
      await lookaheadService.mergeToMaster(commitResult.approvalId);

      // Verify master schedule was updated
      const masterActivity = await prisma.scheduleActivity.findFirst({
        where: {
          scheduleId: testSchedule.id,
          persistentInternalGuid: activity.persistentInternalGuid,
        },
      });

      expect(masterActivity?.percentComplete).toBe(80);

      // Verify lookahead version was created
      const versions = await prisma.lookaheadVersion.findMany({
        where: { lookaheadScheduleId: lookahead.id },
      });
      expect(versions.length).toBe(1);

      // Verify lookahead status is back to active
      const updatedLookahead = await lookaheadService.findById(lookahead.id);
      expect(updatedLookahead.status).toBe('active');
    });

    it('should throw error if approval is not approved', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });
      const activity = lookaheadWithActivities.activities[0];

      await lookaheadService.markTaskStatus(lookahead.id, activity.id, 'will_do', testUser.id);
      const commitResult = await lookaheadService.commitChanges(lookahead.id, testUser.id);

      // Try to merge without approval
      await expect(
        lookaheadService.mergeToMaster(commitResult.approvalId)
      ).rejects.toThrow('Can only merge approved changes');
    });
  });

  describe('delete', () => {
    it('should delete a lookahead schedule', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.delete(lookahead.id);

      await expect(lookaheadService.findById(lookahead.id)).rejects.toThrow(
        'Lookahead schedule not found'
      );
    });

    it('should throw error if lookahead has pending approval', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const lookahead = await lookaheadService.create({
        masterScheduleId: testSchedule.id,
        projectId: testProject.id,
        name: 'Test Lookahead',
        startDate,
        endDate,
      });

      await lookaheadService.pullFromMaster(lookahead.id);

      const lookaheadWithActivities = await lookaheadService.findById(lookahead.id, {
        includeActivities: true,
      });

      await lookaheadService.markTaskStatus(
        lookahead.id,
        lookaheadWithActivities.activities[0].id,
        'will_do',
        testUser.id
      );

      await lookaheadService.commitChanges(lookahead.id, testUser.id);

      await expect(lookaheadService.delete(lookahead.id)).rejects.toThrow(
        'Cannot delete lookahead with pending approval'
      );
    });
  });
});
