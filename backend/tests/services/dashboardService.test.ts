/**
 * Dashboard Service Tests
 *
 * Tests for dashboard functionality including:
 * - Executive dashboard with workflow-gated data
 * - Project drill-down
 * - Financial drill-down
 * - Critical delays
 */

import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { dashboardService } from '../../src/services/dashboardService.js';
import {
  createTestCompany,
  createTestUser,
  createTestProject,
  createTestSchedule,
  // cleanupTestData,
} from '../helpers/testUtils.js';

const prisma = new PrismaClient();

describe('DashboardService', () => {
  let testCompanyId: string;
  let testProjectId: string;
  let testScheduleId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Create test company
    const company = await createTestCompany(`Dashboard Test Company ${Date.now()}`);
    testCompanyId = company.id;

    // Create test user
    const user = await createTestUser(testCompanyId);
    testUserId = user.id;

    // Create test project
    const project = await createTestProject(testCompanyId, testUserId, {
      name: 'Dashboard Test Project',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
    });
    testProjectId = project.id;

    // Create test schedule
    const schedule = await createTestSchedule(testProjectId, testUserId, {
      name: 'Dashboard Test Schedule',
    });
    testScheduleId = schedule.id;

    // Create test activities with various states
    const timestamp = Date.now();
    const activities = [
      {
        scheduleId: testScheduleId,
        persistentInternalGuid: `guid-dash-1-${timestamp}`,
        activityCode: 'D1000',
        name: 'Completed Activity',
        startDate: new Date('2024-01-15'),
        finishDate: new Date('2024-02-15'),
        duration: 30,
        percentComplete: 100,
        isCritical: true,
        totalFloat: 0,
        predecessorIds: [],
        successorIds: [],
      },
      {
        scheduleId: testScheduleId,
        persistentInternalGuid: `guid-dash-2-${timestamp}`,
        activityCode: 'D1010',
        name: 'In Progress Activity',
        startDate: new Date('2024-02-16'),
        finishDate: new Date('2024-04-15'),
        duration: 60,
        percentComplete: 50,
        isCritical: true,
        totalFloat: 0,
        predecessorIds: [],
        successorIds: [],
      },
      {
        scheduleId: testScheduleId,
        persistentInternalGuid: `guid-dash-3-${timestamp}`,
        activityCode: 'D1020',
        name: 'Delayed Activity',
        startDate: new Date('2024-01-01'),
        finishDate: new Date('2024-02-01'), // Past due
        duration: 30,
        percentComplete: 25,
        isCritical: false,
        totalFloat: 5,
        predecessorIds: [],
        successorIds: [],
      },
      {
        scheduleId: testScheduleId,
        persistentInternalGuid: `guid-dash-4-${timestamp}`,
        activityCode: 'D1030',
        name: 'Future Activity',
        startDate: new Date('2024-08-01'),
        finishDate: new Date('2024-09-01'),
        duration: 30,
        percentComplete: 0,
        isCritical: false,
        totalFloat: 20,
        predecessorIds: [],
        successorIds: [],
      },
      {
        scheduleId: testScheduleId,
        persistentInternalGuid: `guid-dash-5-${timestamp}`,
        activityCode: 'D1040',
        name: 'Milestone',
        startDate: new Date('2024-06-15'),
        finishDate: new Date('2024-06-15'),
        duration: 0,
        percentComplete: 0,
        isCritical: true,
        totalFloat: 0,
        predecessorIds: [],
        successorIds: [],
      },
    ];

    await prisma.scheduleActivity.createMany({ data: activities });

    // Create a staff role for resource utilization tests
    await prisma.staffRole.create({
      data: {
        company: { connect: { id: testCompanyId } },
        name: 'Project Manager',
        hourlyCost: 75.0,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('getExecutiveDashboard', () => {
    it('should return executive dashboard data', async () => {
      const dashboard = await dashboardService.getExecutiveDashboard(testCompanyId);

      expect(dashboard).toBeDefined();
      expect(dashboard.summary).toBeDefined();
      expect(dashboard.projects).toBeDefined();
      expect(dashboard.criticalDelays).toBeDefined();
      expect(dashboard.financials).toBeDefined();
      expect(dashboard.resourceUtilization).toBeDefined();
      expect(dashboard.lastUpdated).toBeDefined();
      expect(dashboard.dataIntegrityNote).toBeDefined();
    });

    it('should include project count in summary', async () => {
      const dashboard = await dashboardService.getExecutiveDashboard(testCompanyId);

      expect(dashboard.summary.totalProjects).toBeGreaterThanOrEqual(1);
    });

    it('should calculate portfolio health', async () => {
      const dashboard = await dashboardService.getExecutiveDashboard(testCompanyId);

      expect(['healthy', 'at_risk', 'critical']).toContain(
        dashboard.summary.overallPortfolioHealth
      );
    });

    it('should include project health metrics', async () => {
      const dashboard = await dashboardService.getExecutiveDashboard(testCompanyId);

      expect(dashboard.projects.length).toBeGreaterThanOrEqual(1);

      const project = dashboard.projects[0];
      expect(project.projectId).toBeDefined();
      expect(project.projectName).toBeDefined();
      expect(project.status).toBeDefined();
      expect(project.overallProgress).toBeDefined();
      expect(project.schedulePerformanceIndex).toBeDefined();
      expect(project.criticalPathHealth).toBeDefined();
    });

    it('should include resource utilization', async () => {
      const dashboard = await dashboardService.getExecutiveDashboard(testCompanyId);

      expect(dashboard.resourceUtilization).toBeDefined();
      expect(Array.isArray(dashboard.resourceUtilization)).toBe(true);
    });

    it('should include data integrity note', async () => {
      const dashboard = await dashboardService.getExecutiveDashboard(testCompanyId);

      expect(dashboard.dataIntegrityNote).toContain('workflow-approved');
    });
  });

  describe('getProjectDrillDown', () => {
    it('should return project drill-down data', async () => {
      const drillDown = await dashboardService.getProjectDrillDown(testProjectId);

      expect(drillDown).toBeDefined();
      expect(drillDown.project).toBeDefined();
      expect(drillDown.scheduleHealth).toBeDefined();
      expect(drillDown.milestones).toBeDefined();
      expect(drillDown.weeklyProgress).toBeDefined();
      expect(drillDown.topDelays).toBeDefined();
      expect(drillDown.financialDetails).toBeDefined();
    });

    it('should include schedule health metrics', async () => {
      const drillDown = await dashboardService.getProjectDrillDown(testProjectId);

      expect(drillDown.scheduleHealth.criticalActivities).toBeDefined();
      expect(drillDown.scheduleHealth.nearCriticalActivities).toBeDefined();
      expect(drillDown.scheduleHealth.activitiesWithNegativeFloat).toBeDefined();
    });

    it('should identify milestones', async () => {
      const drillDown = await dashboardService.getProjectDrillDown(testProjectId);

      // Should find the milestone activity (duration = 0)
      expect(drillDown.milestones.length).toBeGreaterThanOrEqual(1);

      const milestone = drillDown.milestones.find((m) => m.name === 'Milestone');
      expect(milestone).toBeDefined();
    });

    it('should include weekly progress data', async () => {
      const drillDown = await dashboardService.getProjectDrillDown(testProjectId);

      expect(drillDown.weeklyProgress.length).toBeGreaterThan(0);

      const week = drillDown.weeklyProgress[0];
      expect(week.week).toBeDefined();
      expect(week.planned).toBeDefined();
      expect(week.actual).toBeDefined();
      expect(week.earned).toBeDefined();
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        dashboardService.getProjectDrillDown('non-existent-id')
      ).rejects.toThrow('Project not found');
    });
  });

  describe('getFinancialDrillDown', () => {
    it('should return financial drill-down data', async () => {
      const financials = await dashboardService.getFinancialDrillDown(testProjectId);

      expect(financials).toBeDefined();
      expect(financials.summary).toBeDefined();
      expect(financials.monthlyBreakdown).toBeDefined();
      expect(financials.costByCategory).toBeDefined();
      expect(financials.forecastToCompletion).toBeDefined();
    });

    it('should include financial summary metrics', async () => {
      const financials = await dashboardService.getFinancialDrillDown(testProjectId);

      expect(financials.summary.budgetedCost).toBeDefined();
      expect(financials.summary.actualCost).toBeDefined();
      expect(financials.summary.earnedValue).toBeDefined();
      expect(financials.summary.costVariance).toBeDefined();
      expect(financials.summary.scheduleVariance).toBeDefined();
    });

    it('should include monthly breakdown', async () => {
      const financials = await dashboardService.getFinancialDrillDown(testProjectId);

      expect(financials.monthlyBreakdown.length).toBeGreaterThan(0);

      const month = financials.monthlyBreakdown[0];
      expect(month.month).toBeDefined();
      expect(month.budgeted).toBeDefined();
      expect(month.actual).toBeDefined();
      expect(month.variance).toBeDefined();
    });

    it('should include forecast to completion', async () => {
      const financials = await dashboardService.getFinancialDrillDown(testProjectId);

      expect(financials.forecastToCompletion.optimistic).toBeDefined();
      expect(financials.forecastToCompletion.mostLikely).toBeDefined();
      expect(financials.forecastToCompletion.pessimistic).toBeDefined();

      // Optimistic should be less than pessimistic
      expect(financials.forecastToCompletion.optimistic).toBeLessThan(
        financials.forecastToCompletion.pessimistic
      );
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        dashboardService.getFinancialDrillDown('non-existent-id')
      ).rejects.toThrow('Project not found');
    });
  });

  describe('critical delays detection', () => {
    it('should identify delayed activities', async () => {
      const dashboard = await dashboardService.getExecutiveDashboard(testCompanyId);

      // Should find the delayed activity (past due with incomplete progress)
      const delays = dashboard.criticalDelays;
      expect(delays.length).toBeGreaterThanOrEqual(1);
    });

    it('should categorize delay impact', async () => {
      const dashboard = await dashboardService.getExecutiveDashboard(testCompanyId);

      if (dashboard.criticalDelays.length > 0) {
        const delay = dashboard.criticalDelays[0];
        expect(['low', 'medium', 'high', 'critical']).toContain(delay.impact);
      }
    });

    it('should include delay details', async () => {
      const dashboard = await dashboardService.getExecutiveDashboard(testCompanyId);

      if (dashboard.criticalDelays.length > 0) {
        const delay = dashboard.criticalDelays[0];
        expect(delay.projectId).toBeDefined();
        expect(delay.activityId).toBeDefined();
        expect(delay.activityName).toBeDefined();
        expect(delay.delayDays).toBeDefined();
        expect(delay.isCriticalPath).toBeDefined();
      }
    });
  });

  describe('project health calculation', () => {
    it('should calculate overall progress', async () => {
      const drillDown = await dashboardService.getProjectDrillDown(testProjectId);

      expect(drillDown.project.overallProgress).toBeGreaterThanOrEqual(0);
      expect(drillDown.project.overallProgress).toBeLessThanOrEqual(100);
    });

    it('should calculate schedule performance index', async () => {
      const drillDown = await dashboardService.getProjectDrillDown(testProjectId);

      expect(drillDown.project.schedulePerformanceIndex).toBeGreaterThan(0);
    });

    it('should determine project status', async () => {
      const drillDown = await dashboardService.getProjectDrillDown(testProjectId);

      expect(['on_track', 'at_risk', 'delayed', 'critical']).toContain(
        drillDown.project.status
      );
    });

    it('should determine critical path health', async () => {
      const drillDown = await dashboardService.getProjectDrillDown(testProjectId);

      expect(['healthy', 'at_risk', 'delayed']).toContain(
        drillDown.project.criticalPathHealth
      );
    });

    it('should count activities by status', async () => {
      const drillDown = await dashboardService.getProjectDrillDown(testProjectId);

      expect(drillDown.project.activitiesTotal).toBe(5);
      expect(drillDown.project.activitiesCompleted).toBe(1);
      expect(drillDown.project.activitiesInProgress).toBeGreaterThanOrEqual(1);
    });
  });
});
