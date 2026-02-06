import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../setup.js';
import { ActivityService } from '../../src/modules/core/services/activityService.js';

const activityService = new ActivityService();

describe('ActivityService', () => {
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

    // Create project settings with retained logic enabled by default
    await prisma.projectSettings.create({
      data: {
        projectId: testProject.id,
        useRetainedLogic: true,
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

  describe('create', () => {
    it('should create a new activity', async () => {
      const activity = await activityService.create({
        scheduleId: testSchedule.id,
        activityCode: 'A1000',
        name: 'Test Activity',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-05'),
        duration: 5,
      });

      expect(activity).toBeDefined();
      expect(activity.name).toBe('Test Activity');
      expect(activity.activityCode).toBe('A1000');
      expect(activity.duration).toBe(5);
      expect(activity.percentComplete).toBe(0);
    });

    it('should throw error for invalid dates', async () => {
      await expect(
        activityService.create({
          scheduleId: testSchedule.id,
          name: 'Invalid Activity',
          startDate: new Date('2024-01-05'),
          finishDate: new Date('2024-01-01'), // finish before start
          duration: 5,
        })
      ).rejects.toThrow('Start date must be before finish date');
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(
        activityService.create({
          scheduleId: 'non-existent-id',
          name: 'Test Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-05'),
          duration: 5,
        })
      ).rejects.toThrow('Schedule not found');
    });
  });

  describe('addPredecessor', () => {
    it('should add a predecessor relationship', async () => {
      const activity1 = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity 1',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-05'),
        duration: 5,
      });

      const activity2 = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity 2',
        startDate: new Date('2024-01-06'),
        finishDate: new Date('2024-01-10'),
        duration: 5,
      });

      const updated = await activityService.addPredecessor(activity2.id, activity1.id);

      expect(updated.predecessorIds).toContain(activity1.id);

      // Verify successor was updated too
      const pred = await activityService.findById(activity1.id);
      expect(pred.successorIds).toContain(activity2.id);
    });

    it('should detect circular dependency', async () => {
      const activity1 = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity 1',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-05'),
        duration: 5,
      });

      const activity2 = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity 2',
        startDate: new Date('2024-01-06'),
        finishDate: new Date('2024-01-10'),
        duration: 5,
      });

      // Add activity1 as predecessor of activity2
      await activityService.addPredecessor(activity2.id, activity1.id);

      // Try to add activity2 as predecessor of activity1 (would create cycle)
      await expect(
        activityService.addPredecessor(activity1.id, activity2.id)
      ).rejects.toThrow('circular dependency');
    });

    it('should prevent self-reference', async () => {
      const activity = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity 1',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-05'),
        duration: 5,
      });

      await expect(
        activityService.addPredecessor(activity.id, activity.id)
      ).rejects.toThrow('circular dependency');
    });
  });

  describe('calculateCriticalPath', () => {
    it('should calculate critical path for simple linear sequence', async () => {
      // Create a simple linear sequence: A -> B -> C
      const actA = await activityService.create({
        scheduleId: testSchedule.id,
        activityCode: 'A',
        name: 'Activity A',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-05'),
        duration: 5,
      });

      const actB = await activityService.create({
        scheduleId: testSchedule.id,
        activityCode: 'B',
        name: 'Activity B',
        startDate: new Date('2024-01-06'),
        finishDate: new Date('2024-01-10'),
        duration: 5,
        predecessorIds: [actA.id],
      });

      const actC = await activityService.create({
        scheduleId: testSchedule.id,
        activityCode: 'C',
        name: 'Activity C',
        startDate: new Date('2024-01-11'),
        finishDate: new Date('2024-01-15'),
        duration: 5,
        predecessorIds: [actB.id],
      });

      const result = await activityService.calculateCriticalPath(testSchedule.id);

      expect(result.projectDuration).toBe(15); // 5 + 5 + 5 = 15 days
      expect(result.criticalPath.length).toBe(3);
      expect(result.criticalPath).toContain(actA.id);
      expect(result.criticalPath).toContain(actB.id);
      expect(result.criticalPath).toContain(actC.id);

      // All activities should be critical (zero float)
      for (const node of result.activities) {
        expect(node.isCritical).toBe(true);
        expect(node.totalFloat).toBe(0);
      }
    });

    it('should identify non-critical activities with float', async () => {
      // Create a network with parallel paths:
      //     A (5 days) -> B (5 days) -> D (5 days)
      //                -> C (2 days) ->
      // Critical path: A -> B -> D (15 days)
      // Non-critical: C (has float)

      const actA = await activityService.create({
        scheduleId: testSchedule.id,
        activityCode: 'A',
        name: 'Activity A',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-05'),
        duration: 5,
      });

      const actB = await activityService.create({
        scheduleId: testSchedule.id,
        activityCode: 'B',
        name: 'Activity B',
        startDate: new Date('2024-01-06'),
        finishDate: new Date('2024-01-10'),
        duration: 5,
        predecessorIds: [actA.id],
      });

      const actC = await activityService.create({
        scheduleId: testSchedule.id,
        activityCode: 'C',
        name: 'Activity C',
        startDate: new Date('2024-01-06'),
        finishDate: new Date('2024-01-07'),
        duration: 2,
        predecessorIds: [actA.id],
      });

      const actD = await activityService.create({
        scheduleId: testSchedule.id,
        activityCode: 'D',
        name: 'Activity D',
        startDate: new Date('2024-01-11'),
        finishDate: new Date('2024-01-15'),
        duration: 5,
        predecessorIds: [actB.id, actC.id],
      });

      const result = await activityService.calculateCriticalPath(testSchedule.id);

      expect(result.projectDuration).toBe(15);

      // Find activity C in results
      const nodeC = result.activities.find((n) => n.id === actC.id);
      expect(nodeC).toBeDefined();
      expect(nodeC!.isCritical).toBe(false);
      expect(nodeC!.totalFloat).toBeGreaterThan(0);

      // A, B, D should be critical
      const nodeA = result.activities.find((n) => n.id === actA.id);
      const nodeB = result.activities.find((n) => n.id === actB.id);
      const nodeD = result.activities.find((n) => n.id === actD.id);

      expect(nodeA!.isCritical).toBe(true);
      expect(nodeB!.isCritical).toBe(true);
      expect(nodeD!.isCritical).toBe(true);
    });

    it('should handle empty schedule', async () => {
      const result = await activityService.calculateCriticalPath(testSchedule.id);

      expect(result.criticalPath).toEqual([]);
      expect(result.projectDuration).toBe(0);
      expect(result.activities).toEqual([]);
    });

    it('should update activities in database with critical path data', async () => {
      const actA = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity A',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-05'),
        duration: 5,
      });

      await activityService.calculateCriticalPath(testSchedule.id);

      // Verify database was updated
      const updatedActivity = await activityService.findById(actA.id);
      expect(updatedActivity.isCritical).toBe(true);
      expect(updatedActivity.totalFloat).toBe(0);
    });
  });

  describe('findByDateRange', () => {
    it('should find activities within date range', async () => {
      await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity 1',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-05'),
        duration: 5,
      });

      await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity 2',
        startDate: new Date('2024-01-10'),
        finishDate: new Date('2024-01-15'),
        duration: 5,
      });

      await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity 3',
        startDate: new Date('2024-01-20'),
        finishDate: new Date('2024-01-25'),
        duration: 5,
      });

      const activities = await activityService.findByDateRange(
        testSchedule.id,
        new Date('2024-01-01'),
        new Date('2024-01-15')
      );

      expect(activities.length).toBe(2);
    });
  });

  describe('updateProgress', () => {
    it('should update activity progress', async () => {
      const activity = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity 1',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-05'),
        duration: 5,
      });

      const updated = await activityService.updateProgress(activity.id, 50);

      expect(updated.percentComplete).toBe(50);
    });

    it('should reject invalid progress values', async () => {
      const activity = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity 1',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-05'),
        duration: 5,
      });

      await expect(activityService.updateProgress(activity.id, 150)).rejects.toThrow(
        'Percent complete must be between 0 and 100'
      );

      await expect(activityService.updateProgress(activity.id, -10)).rejects.toThrow(
        'Percent complete must be between 0 and 100'
      );
    });
  });

  describe('getCriticalActivities', () => {
    it('should return only critical activities', async () => {
      // Create activities and calculate critical path
      const actA = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity A',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-05'),
        duration: 5,
      });

      const actB = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity B',
        startDate: new Date('2024-01-06'),
        finishDate: new Date('2024-01-10'),
        duration: 5,
        predecessorIds: [actA.id],
      });

      // Calculate critical path to set isCritical flags
      await activityService.calculateCriticalPath(testSchedule.id);

      const criticalActivities = await activityService.getCriticalActivities(testSchedule.id);

      expect(criticalActivities.length).toBe(2);
      expect(criticalActivities.every((a) => a.isCritical)).toBe(true);
    });
  });

  describe('calculateCriticalPath with Retained Logic', () => {
    it('should use remaining duration for in-progress activities', async () => {
      // Create a linear sequence: A (10 days, 50% complete) -> B (5 days)
      const actA = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity A',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-10'),
        duration: 10,
        percentComplete: 50, // 50% complete = 5 days remaining
      });

      const actB = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity B',
        startDate: new Date('2024-01-11'),
        finishDate: new Date('2024-01-15'),
        duration: 5,
        predecessorIds: [actA.id],
      });

      // With retained logic: A has 5 days remaining + B has 5 days = 10 days total
      const result = await activityService.calculateCriticalPath(testSchedule.id);

      expect(result.useRetainedLogic).toBe(true);
      expect(result.projectDuration).toBe(10); // 5 remaining + 5 = 10

      const nodeA = result.activities.find((n) => n.id === actA.id);
      expect(nodeA?.remainingDuration).toBe(5);
      expect(nodeA?.duration).toBe(10);
    });

    it('should treat completed activities as having zero remaining duration', async () => {
      // Create: A (10 days, 100% complete) -> B (5 days)
      const actA = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity A',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-10'),
        duration: 10,
        percentComplete: 100, // Completed
      });

      const actB = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity B',
        startDate: new Date('2024-01-11'),
        finishDate: new Date('2024-01-15'),
        duration: 5,
        predecessorIds: [actA.id],
      });

      const result = await activityService.calculateCriticalPath(testSchedule.id);

      expect(result.projectDuration).toBe(5); // A is done, only B's 5 days remain

      const nodeA = result.activities.find((n) => n.id === actA.id);
      expect(nodeA?.remainingDuration).toBe(0);
      expect(nodeA?.isCritical).toBe(false); // Completed activities are not critical
    });

    it('should use full duration when retained logic is disabled', async () => {
      // Disable retained logic for the project
      await prisma.projectSettings.update({
        where: { projectId: testProject.id },
        data: { useRetainedLogic: false },
      });

      const actA = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity A',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-10'),
        duration: 10,
        percentComplete: 50,
      });

      const actB = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity B',
        startDate: new Date('2024-01-11'),
        finishDate: new Date('2024-01-15'),
        duration: 5,
        predecessorIds: [actA.id],
      });

      const result = await activityService.calculateCriticalPath(testSchedule.id);

      expect(result.useRetainedLogic).toBe(false);
      expect(result.projectDuration).toBe(15); // Full 10 + 5 = 15
    });

    it('should allow explicit override of retained logic setting', async () => {
      const actA = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity A',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-10'),
        duration: 10,
        percentComplete: 50,
      });

      // Explicitly disable retained logic even though project setting is enabled
      const result = await activityService.calculateCriticalPath(testSchedule.id, {
        useRetainedLogic: false,
      });

      expect(result.useRetainedLogic).toBe(false);
      expect(result.projectDuration).toBe(10); // Full duration
    });

    it('should calculate correct float with retained logic', async () => {
      // Create a network:
      //     A (10 days, 50% = 5 remaining) -> C (5 days)
      //     B (2 days) ---------------------->
      // Critical path should be A -> C (5 + 5 = 10 days)
      // B should have float (10 - 2 = 8 days)

      const actA = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity A',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-10'),
        duration: 10,
        percentComplete: 50,
      });

      const actB = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity B',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-01-02'),
        duration: 2,
        percentComplete: 0,
      });

      const actC = await activityService.create({
        scheduleId: testSchedule.id,
        name: 'Activity C',
        startDate: new Date('2024-01-11'),
        finishDate: new Date('2024-01-15'),
        duration: 5,
        predecessorIds: [actA.id, actB.id],
      });

      const result = await activityService.calculateCriticalPath(testSchedule.id);

      expect(result.projectDuration).toBe(10); // 5 (A remaining) + 5 (C) = 10

      const nodeB = result.activities.find((n) => n.id === actB.id);
      expect(nodeB?.isCritical).toBe(false);
      expect(nodeB?.totalFloat).toBe(3); // B can be delayed 3 days (5 - 2 = 3)

      const nodeA = result.activities.find((n) => n.id === actA.id);
      expect(nodeA?.isCritical).toBe(true);
    });

    it('should handle various progress levels correctly', async () => {
      // Test different progress levels
      const activities = [
        { name: 'A', duration: 10, percentComplete: 0, expectedRemaining: 10 },
        { name: 'B', duration: 10, percentComplete: 25, expectedRemaining: 8 }, // ceil(10 * 0.75) = 8
        { name: 'C', duration: 10, percentComplete: 50, expectedRemaining: 5 },
        { name: 'D', duration: 10, percentComplete: 75, expectedRemaining: 3 }, // ceil(10 * 0.25) = 3
        { name: 'E', duration: 10, percentComplete: 100, expectedRemaining: 0 },
      ];

      for (const act of activities) {
        await activityService.create({
          scheduleId: testSchedule.id,
          name: act.name,
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-10'),
          duration: act.duration,
          percentComplete: act.percentComplete,
        });
      }

      const result = await activityService.calculateCriticalPath(testSchedule.id);

      for (const act of activities) {
        const node = result.activities.find((n) => n.name === act.name);
        expect(node?.remainingDuration).toBe(act.expectedRemaining);
      }
    });
  });
});
