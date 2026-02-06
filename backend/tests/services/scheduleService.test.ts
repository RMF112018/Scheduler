import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../setup.js';
import { ScheduleService } from '../../src/services/scheduleService';

const scheduleService = new ScheduleService();

describe('ScheduleService', () => {
  let testCompany: { id: string };
  let testUser: { id: string };
  let testProject: { id: string };

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
  });

  describe('create', () => {
    it('should create a new schedule', async () => {
      const schedule = await scheduleService.create({
        projectId: testProject.id,
        name: 'Test Schedule',
        description: 'A test schedule',
        createdBy: testUser.id,
      });

      expect(schedule).toBeDefined();
      expect(schedule.name).toBe('Test Schedule');
      expect(schedule.status).toBe('draft');
      expect(schedule.projectId).toBe(testProject.id);
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        scheduleService.create({
          projectId: 'non-existent-id',
          name: 'Test Schedule',
          createdBy: testUser.id,
        })
      ).rejects.toThrow('Project not found');
    });
  });

  describe('findById', () => {
    it('should find a schedule by ID', async () => {
      const created = await scheduleService.create({
        projectId: testProject.id,
        name: 'Test Schedule',
        createdBy: testUser.id,
      });

      const found = await scheduleService.findById(created.id);
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Test Schedule');
    });

    it('should throw error for non-existent schedule', async () => {
      await expect(scheduleService.findById('non-existent-id')).rejects.toThrow(
        'Schedule not found'
      );
    });

    it('should include activities when requested', async () => {
      const created = await scheduleService.create({
        projectId: testProject.id,
        name: 'Test Schedule',
        createdBy: testUser.id,
      });

      // Create an activity
      await prisma.scheduleActivity.create({
        data: {
          scheduleId: created.id,
          name: 'Test Activity',
          startDate: new Date('2024-01-01'),
          finishDate: new Date('2024-01-05'),
          duration: 5,
        },
      });

      const found = await scheduleService.findById(created.id, { includeActivities: true });
      expect(found.activities).toBeDefined();
      expect(found.activities?.length).toBe(1);
    });
  });

  describe('createBaseline', () => {
    let testSchedule: { id: string };

    beforeEach(async () => {
      testSchedule = await scheduleService.create({
        projectId: testProject.id,
        name: 'Test Schedule',
        createdBy: testUser.id,
      });

      // Create some activities
      await prisma.scheduleActivity.createMany({
        data: [
          {
            scheduleId: testSchedule.id,
            name: 'Activity 1',
            startDate: new Date('2024-01-01'),
            finishDate: new Date('2024-01-05'),
            duration: 5,
          },
          {
            scheduleId: testSchedule.id,
            name: 'Activity 2',
            startDate: new Date('2024-01-06'),
            finishDate: new Date('2024-01-10'),
            duration: 5,
          },
        ],
      });
    });

    it('should create a baseline snapshot', async () => {
      const baseline = await scheduleService.createBaseline(testSchedule.id);

      expect(baseline).toBeDefined();
      expect(baseline.version).toBe(1);
      expect(baseline.scheduleId).toBe(testSchedule.id);
      expect(baseline.snapshotData).toBeDefined();
    });

    it('should increment version numbers', async () => {
      const baseline1 = await scheduleService.createBaseline(testSchedule.id);
      const baseline2 = await scheduleService.createBaseline(testSchedule.id);

      expect(baseline1.version).toBe(1);
      expect(baseline2.version).toBe(2);
    });

    it('should retain only 5 baselines', async () => {
      // Create 7 baselines
      for (let i = 0; i < 7; i++) {
        await scheduleService.createBaseline(testSchedule.id);
      }

      const baselines = await scheduleService.getBaselines(testSchedule.id);
      expect(baselines.length).toBe(5);

      // Verify oldest baselines were deleted (versions 1 and 2)
      const versions = baselines.map((b) => b.version);
      expect(versions).not.toContain(1);
      expect(versions).not.toContain(2);
      expect(versions).toContain(3);
      expect(versions).toContain(7);
    });

    it('should throw error for schedule with no activities', async () => {
      const emptySchedule = await scheduleService.create({
        projectId: testProject.id,
        name: 'Empty Schedule',
        createdBy: testUser.id,
      });

      await expect(scheduleService.createBaseline(emptySchedule.id)).rejects.toThrow(
        'Cannot create baseline for schedule with no activities'
      );
    });
  });

  describe('compareBaselines', () => {
    let testSchedule: { id: string };

    beforeEach(async () => {
      testSchedule = await scheduleService.create({
        projectId: testProject.id,
        name: 'Test Schedule',
        createdBy: testUser.id,
      });

      // Create initial activities
      await prisma.scheduleActivity.createMany({
        data: [
          {
            scheduleId: testSchedule.id,
            activityCode: 'A1000',
            name: 'Activity 1',
            startDate: new Date('2024-01-01'),
            finishDate: new Date('2024-01-05'),
            duration: 5,
            percentComplete: 0,
            isCritical: true,
          },
          {
            scheduleId: testSchedule.id,
            activityCode: 'A1010',
            name: 'Activity 2',
            startDate: new Date('2024-01-06'),
            finishDate: new Date('2024-01-10'),
            duration: 5,
            percentComplete: 0,
            isCritical: false,
          },
        ],
      });
    });

    it('should compare two baselines and calculate variances', async () => {
      // Create first baseline
      const baseline1 = await scheduleService.createBaseline(testSchedule.id);

      // Update an activity
      const activities = await prisma.scheduleActivity.findMany({
        where: { scheduleId: testSchedule.id },
      });

      await prisma.scheduleActivity.update({
        where: { id: activities[0].id },
        data: {
          finishDate: new Date('2024-01-07'), // 2 days later
          duration: 7,
          percentComplete: 50,
        },
      });

      // Create second baseline
      const baseline2 = await scheduleService.createBaseline(testSchedule.id);

      // Compare baselines
      const comparison = await scheduleService.compareBaselines(
        testSchedule.id,
        baseline1.id,
        baseline2.id
      );

      expect(comparison).toBeDefined();
      expect(comparison.baseline1.id).toBe(baseline1.id);
      expect(comparison.baseline2.id).toBe(baseline2.id);
      expect(comparison.summary.totalActivitiesCompared).toBe(2);
      expect(comparison.variances.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent baselines', async () => {
      const baseline1 = await scheduleService.createBaseline(testSchedule.id);

      await expect(
        scheduleService.compareBaselines(testSchedule.id, baseline1.id, 'non-existent-id')
      ).rejects.toThrow('One or both baselines not found');
    });
  });

  describe('getStatistics', () => {
    it('should return schedule statistics', async () => {
      const schedule = await scheduleService.create({
        projectId: testProject.id,
        name: 'Test Schedule',
        createdBy: testUser.id,
      });

      // Create activities with different statuses
      await prisma.scheduleActivity.createMany({
        data: [
          {
            scheduleId: schedule.id,
            name: 'Completed Activity',
            startDate: new Date('2024-01-01'),
            finishDate: new Date('2024-01-05'),
            duration: 5,
            percentComplete: 100,
            isCritical: true,
          },
          {
            scheduleId: schedule.id,
            name: 'In Progress Activity',
            startDate: new Date('2024-01-06'),
            finishDate: new Date('2024-01-10'),
            duration: 5,
            percentComplete: 50,
            isCritical: true,
          },
          {
            scheduleId: schedule.id,
            name: 'Not Started Activity',
            startDate: new Date('2024-01-11'),
            finishDate: new Date('2024-01-15'),
            duration: 5,
            percentComplete: 0,
            isCritical: false,
          },
        ],
      });

      const stats = await scheduleService.getStatistics(schedule.id);

      expect(stats.totalActivities).toBe(3);
      expect(stats.completedActivities).toBe(1);
      expect(stats.inProgressActivities).toBe(1);
      expect(stats.notStartedActivities).toBe(1);
      expect(stats.criticalPathActivities).toBe(2);
      expect(stats.overallProgress).toBeGreaterThan(0);
      expect(stats.earliestStart).toEqual(new Date('2024-01-01'));
      expect(stats.latestFinish).toEqual(new Date('2024-01-15'));
    });

    it('should return zero statistics for empty schedule', async () => {
      const schedule = await scheduleService.create({
        projectId: testProject.id,
        name: 'Empty Schedule',
        createdBy: testUser.id,
      });

      const stats = await scheduleService.getStatistics(schedule.id);

      expect(stats.totalActivities).toBe(0);
      expect(stats.overallProgress).toBe(0);
      expect(stats.earliestStart).toBeNull();
      expect(stats.latestFinish).toBeNull();
    });
  });
});
