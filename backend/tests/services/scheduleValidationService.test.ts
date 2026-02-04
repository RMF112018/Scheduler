import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../setup';
import { ScheduleValidationService } from '../../src/services/scheduleValidationService';
import { ActivityService } from '../../src/services/activityService';

const validationService = new ScheduleValidationService();
const activityService = new ActivityService();

describe('ScheduleValidationService', () => {
  let testCompany: { id: string };
  let testUser: { id: string };
  let testProject: { id: string };
  let testSchedule: { id: string };

  beforeEach(async () => {
    // Create test company
    testCompany = await prisma.company.create({
      data: { name: 'Test Company' },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        companyId: testCompany.id,
      },
    });

    // Create test project
    testProject = await prisma.project.create({
      data: {
        companyId: testCompany.id,
        name: 'Test Project',
        description: 'A test project',
        status: 'active',
        createdBy: testUser.id,
      },
    });

    // Create test schedule
    testSchedule = await prisma.schedule.create({
      data: {
        projectId: testProject.id,
        name: 'Test Schedule',
        status: 'active',
        createdBy: testUser.id,
      },
    });
  });

  describe('detectOutOfSequence', () => {
    it('should detect when activity starts before predecessor finishes', async () => {
      // Create predecessor activity that finished on Jan 10
      const predecessor = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Predecessor',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          actualStartDate: new Date('2024-01-01'),
          actualFinishDate: new Date('2024-01-10'),
        },
      });

      // Create successor activity that started on Jan 8 (before predecessor finished)
      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Successor',
          startDate: new Date('2024-01-11'),
          finishDate: new Date('2024-01-15'),
          duration: 5,
          predecessorIds: [predecessor.id],
          actualStartDate: new Date('2024-01-08'), // Started before predecessor finished!
        },
      });

      const violations = await validationService.detectOutOfSequence(testSchedule.id);

      expect(violations.length).toBe(1);
      expect(violations[0].violationType).toBe('actual_start_before_predecessor');
      expect(violations[0].predecessorName).toBe('Predecessor');
    });

    it('should detect when activity finishes before predecessor finishes', async () => {
      const predecessor = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Predecessor',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-15'),
          duration: 15,
          actualStartDate: new Date('2024-01-01'),
          actualFinishDate: new Date('2024-01-15'),
        },
      });

      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Successor',
          startDate: new Date('2024-01-16'),
          finishDate: new Date('2024-01-20'),
          duration: 5,
          predecessorIds: [predecessor.id],
          actualStartDate: new Date('2024-01-10'),
          actualFinishDate: new Date('2024-01-12'), // Finished before predecessor!
        },
      });

      const violations = await validationService.detectOutOfSequence(testSchedule.id);

      // Should have both start and finish violations
      expect(violations.length).toBe(2);
      expect(violations.some((v) => v.violationType === 'actual_start_before_predecessor')).toBe(true);
      expect(violations.some((v) => v.violationType === 'actual_finish_before_predecessor')).toBe(true);
    });

    it('should detect when successor starts while predecessor is still in progress', async () => {
      const predecessor = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Predecessor',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          percentComplete: 50, // In progress, not finished
          actualStartDate: new Date('2024-01-01'),
          // No actualFinishDate - still in progress
        },
      });

      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Successor',
          startDate: new Date('2024-01-11'),
          finishDate: new Date('2024-01-15'),
          duration: 5,
          predecessorIds: [predecessor.id],
          actualStartDate: new Date('2024-01-08'), // Started while predecessor in progress
        },
      });

      const violations = await validationService.detectOutOfSequence(testSchedule.id);

      expect(violations.length).toBe(1);
      expect(violations[0].violationType).toBe('actual_start_before_predecessor');
      expect(violations[0].message).toContain('50% complete');
    });

    it('should not flag activities without actual dates', async () => {
      const predecessor = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Predecessor',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          // No actual dates
        },
      });

      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Successor',
          startDate: new Date('2024-01-11'),
          finishDate: new Date('2024-01-15'),
          duration: 5,
          predecessorIds: [predecessor.id],
          // No actual dates
        },
      });

      const violations = await validationService.detectOutOfSequence(testSchedule.id);

      expect(violations.length).toBe(0);
    });

    it('should not flag activities that follow correct sequence', async () => {
      const predecessor = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Predecessor',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          actualStartDate: new Date('2024-01-01'),
          actualFinishDate: new Date('2024-01-10'),
        },
      });

      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Successor',
          startDate: new Date('2024-01-11'),
          finishDate: new Date('2024-01-15'),
          duration: 5,
          predecessorIds: [predecessor.id],
          actualStartDate: new Date('2024-01-11'), // Started after predecessor finished
          actualFinishDate: new Date('2024-01-15'),
        },
      });

      const violations = await validationService.detectOutOfSequence(testSchedule.id);

      expect(violations.length).toBe(0);
    });
  });

  describe('flagOutOfSequenceActivities', () => {
    it('should flag activities with out-of-sequence status', async () => {
      const predecessor = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Predecessor',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          actualStartDate: new Date('2024-01-01'),
          actualFinishDate: new Date('2024-01-10'),
        },
      });

      const successor = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Successor',
          startDate: new Date('2024-01-11'),
          finishDate: new Date('2024-01-15'),
          duration: 5,
          predecessorIds: [predecessor.id],
          actualStartDate: new Date('2024-01-08'), // Out of sequence!
        },
      });

      const flaggedCount = await validationService.flagOutOfSequenceActivities(testSchedule.id);

      expect(flaggedCount).toBe(1);

      const updatedSuccessor = await prisma.scheduleActivity.findUnique({
        where: { id: successor.id },
      });

      expect(updatedSuccessor?.outOfSequenceStatus).toBe('detected');
      expect(updatedSuccessor?.outOfSequenceReason).toBeTruthy();
    });

    it('should not re-flag already resolved activities', async () => {
      const predecessor = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Predecessor',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          actualStartDate: new Date('2024-01-01'),
          actualFinishDate: new Date('2024-01-10'),
        },
      });

      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Successor',
          startDate: new Date('2024-01-11'),
          finishDate: new Date('2024-01-15'),
          duration: 5,
          predecessorIds: [predecessor.id],
          actualStartDate: new Date('2024-01-08'),
          outOfSequenceStatus: 'resolved', // Already resolved
          outOfSequenceReason: 'Approved by PM',
        },
      });

      const flaggedCount = await validationService.flagOutOfSequenceActivities(testSchedule.id);

      expect(flaggedCount).toBe(0);
    });
  });

  describe('resolveOutOfSequence', () => {
    it('should resolve out-of-sequence violation with reason', async () => {
      const activity = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          outOfSequenceStatus: 'detected',
          outOfSequenceReason: 'Started before predecessor',
        },
      });

      const resolved = await validationService.resolveOutOfSequence({
        activityId: activity.id,
        reason: 'Approved by PM due to weather delay',
        resolvedBy: testUser.id,
      });

      expect(resolved.outOfSequenceStatus).toBe('resolved');
      expect(resolved.outOfSequenceReason).toBe('Approved by PM due to weather delay');
      expect(resolved.outOfSequenceResolvedBy).toBe(testUser.id);
      expect(resolved.outOfSequenceResolvedAt).toBeTruthy();
    });

    it('should require a reason for resolution', async () => {
      const activity = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          outOfSequenceStatus: 'detected',
        },
      });

      await expect(
        validationService.resolveOutOfSequence({
          activityId: activity.id,
          reason: '', // Empty reason
          resolvedBy: testUser.id,
        })
      ).rejects.toThrow('Resolution reason is required');
    });

    it('should reject resolution of non-flagged activities', async () => {
      const activity = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          // No out-of-sequence status
        },
      });

      await expect(
        validationService.resolveOutOfSequence({
          activityId: activity.id,
          reason: 'Some reason',
          resolvedBy: testUser.id,
        })
      ).rejects.toThrow('Activity is not flagged as out-of-sequence');
    });
  });

  describe('acknowledgeOutOfSequence', () => {
    it('should acknowledge out-of-sequence violation', async () => {
      const activity = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          outOfSequenceStatus: 'detected',
        },
      });

      const acknowledged = await validationService.acknowledgeOutOfSequence(activity.id);

      expect(acknowledged.outOfSequenceStatus).toBe('acknowledged');
    });
  });

  describe('validateSchedule - DCMA-14 Rules', () => {
    it('should detect missing logic (no predecessors or successors)', async () => {
      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Isolated Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          // No predecessors or successors
        },
      });

      const result = await validationService.validateSchedule(testSchedule.id);

      expect(result.issues.some((i) => i.ruleType === 'missing_logic')).toBe(true);
    });

    it('should detect negative float', async () => {
      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Negative Float Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          totalFloat: -5, // Negative float
        },
      });

      const result = await validationService.validateSchedule(testSchedule.id);

      const negativeFloatIssue = result.issues.find((i) => i.ruleType === 'negative_float');
      expect(negativeFloatIssue).toBeTruthy();
      expect(negativeFloatIssue?.severity).toBe('error');
    });

    it('should detect high duration activities', async () => {
      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Long Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-02-10'),
          duration: 40, // > 20 days threshold
        },
      });

      const result = await validationService.validateSchedule(testSchedule.id);

      const highDurationIssue = result.issues.find((i) => i.ruleType === 'high_duration');
      expect(highDurationIssue).toBeTruthy();
      expect(highDurationIssue?.severity).toBe('warning');
    });

    it('should detect high float activities', async () => {
      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'High Float Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          totalFloat: 60, // > 44 days threshold
        },
      });

      const result = await validationService.validateSchedule(testSchedule.id);

      const highFloatIssue = result.issues.find((i) => i.ruleType === 'high_float');
      expect(highFloatIssue).toBeTruthy();
      expect(highFloatIssue?.severity).toBe('info');
    });

    it('should detect dangling references to non-existent activities', async () => {
      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Activity with bad reference',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          predecessorIds: ['non-existent-id'],
        },
      });

      const result = await validationService.validateSchedule(testSchedule.id);

      const danglingIssue = result.issues.find((i) => i.ruleType === 'dangling_activity');
      expect(danglingIssue).toBeTruthy();
      expect(danglingIssue?.severity).toBe('error');
    });

    it('should use custom thresholds', async () => {
      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-15'),
          duration: 15, // Below default 20, above custom 10
          totalFloat: 30, // Below default 44, above custom 20
        },
      });

      const result = await validationService.validateSchedule(testSchedule.id, {
        highDurationThreshold: 10,
        highFloatThreshold: 20,
      });

      expect(result.issues.some((i) => i.ruleType === 'high_duration')).toBe(true);
      expect(result.issues.some((i) => i.ruleType === 'high_float')).toBe(true);
    });

    it('should allow disabling specific rules', async () => {
      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-02-10'),
          duration: 40,
          totalFloat: -5,
        },
      });

      const result = await validationService.validateSchedule(testSchedule.id, {
        enableHighDuration: false,
        enableNegativeFloat: false,
      });

      expect(result.issues.some((i) => i.ruleType === 'high_duration')).toBe(false);
      expect(result.issues.some((i) => i.ruleType === 'negative_float')).toBe(false);
    });

    it('should include out-of-sequence violations in validation', async () => {
      const predecessor = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Predecessor',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          actualStartDate: new Date('2024-01-01'),
          actualFinishDate: new Date('2024-01-10'),
        },
      });

      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Successor',
          startDate: new Date('2024-01-11'),
          finishDate: new Date('2024-01-15'),
          duration: 5,
          predecessorIds: [predecessor.id],
          actualStartDate: new Date('2024-01-08'), // Out of sequence
        },
      });

      const result = await validationService.validateSchedule(testSchedule.id);

      expect(result.outOfSequenceViolations.length).toBe(1);
      expect(result.issues.some((i) => i.ruleType === 'out_of_sequence')).toBe(true);
      expect(result.isValid).toBe(false); // Has errors
    });

    it('should return valid for clean schedule', async () => {
      const actA = await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Activity A',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-05'),
          duration: 5,
          totalFloat: 0,
        },
      });

      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Activity B',
          startDate: new Date('2024-01-06'),
          finishDate: new Date('2024-01-10'),
          duration: 5,
          predecessorIds: [actA.id],
          totalFloat: 0,
        },
      });

      // Update A's successors
      await prisma.scheduleActivity.update({
        where: { id: actA.id },
        data: { successorIds: [(await prisma.scheduleActivity.findFirst({ where: { name: 'Activity B' } }))!.id] },
      });

      const result = await validationService.validateSchedule(testSchedule.id);

      expect(result.isValid).toBe(true);
      expect(result.errorCount).toBe(0);
    });
  });

  describe('getValidationSummary', () => {
    it('should return summary counts', async () => {
      // Create activities with various issues
      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Isolated',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
        },
      });

      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Negative Float',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          totalFloat: -5,
        },
      });

      const summary = await validationService.getValidationSummary(testSchedule.id);

      expect(summary.totalActivities).toBe(2);
      expect(summary.missingLogicCount).toBe(2); // Both isolated
      expect(summary.negativeFloatCount).toBe(1);
    });
  });

  describe('getOutOfSequenceActivities', () => {
    it('should return activities with out-of-sequence status', async () => {
      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'Normal Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
        },
      });

      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'OOS Detected',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          outOfSequenceStatus: 'detected',
        },
      });

      await prisma.scheduleActivity.create({
        data: {
          scheduleId: testSchedule.id,
          name: 'OOS Resolved',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: 10,
          outOfSequenceStatus: 'resolved',
        },
      });

      const oosActivities = await validationService.getOutOfSequenceActivities(testSchedule.id);

      expect(oosActivities.length).toBe(2);
      expect(oosActivities.some((a) => a.name === 'OOS Detected')).toBe(true);
      expect(oosActivities.some((a) => a.name === 'OOS Resolved')).toBe(true);
      expect(oosActivities.some((a) => a.name === 'Normal Activity')).toBe(false);
    });
  });
});
