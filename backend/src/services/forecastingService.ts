/**
 * Forecasting Service
 *
 * Provides resource forecasting and gap analysis functionality including:
 * - Project staffing needs calculation
 * - Organization-wide forecasting
 * - Staff suggestions for roles
 * - New hire needs identification
 * - Cost analysis and projections
 */

import { PrismaClient } from '@prisma/client';
import { staffService } from './staffService.js';

const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

export interface ProjectForecast {
  projectId: string;
  projectName: string;
  forecastPeriod: {
    startDate: string;
    endDate: string;
  };
  weeklyStaffing: Record<string, number>;
  staffBreakdown: Record<string, Record<string, number>>;
  totalEstimatedCost: number;
  totalInternalCost: number;
  assignmentsCount: number;
}

export interface StaffSuggestion {
  staffId: string;
  name: string;
  roleId: string | null;
  roleName: string | null;
  internalHourlyCost: number | null;
  matchScore: number;
  matchReasons: string[];
  currentAllocation: number;
  availableAllocation: number;
  currentAssignments: Array<{
    assignmentId: string;
    projectId: string;
    projectName: string;
    startDate: string;
    endDate: string;
    allocationPercentage: number;
    roleOnProject: string | null;
  }>;
  skills: string[];
}

export interface NewHireNeedsResult {
  role: {
    id: string;
    name: string;
    hourlyCost: number;
    defaultBillableRate: number | null;
  };
  period: {
    startDate: string;
    endDate: string;
    durationWeeks: number;
  };
  requirement: {
    requiredCount: number;
    allocationPercentage: number;
  };
  availability: {
    totalStaffWithRole: number;
    qualifiedAvailable: number;
    gap: number;
  };
  needsNewHire: boolean;
  newHireCount: number;
  existingSuggestions: StaffSuggestion[];
  estimatedImpact: {
    hoursPerPerson: number;
    internalCostForGap: number;
    billableForGap: number;
  };
  recommendations: Array<{
    type: string;
    priority: 'low' | 'medium' | 'high';
    message: string;
    details: string;
  }>;
}

// ============================================================================
// Forecasting Service Class
// ============================================================================

export class ForecastingService {
  // --------------------------------------------------------------------------
  // Date Range Overlap Calculation
  // --------------------------------------------------------------------------

  private calculateDateRangeOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): number {
    const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
    const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));

    if (overlapStart <= overlapEnd) {
      return Math.ceil(
        (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
    }
    return 0;
  }

  // --------------------------------------------------------------------------
  // Project Staffing Forecast
  // --------------------------------------------------------------------------

  async calculateProjectStaffingNeeds(
    projectId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ProjectForecast> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        staffAssignments: {
          include: {
            staffMember: {
              include: { staffRole: true },
            },
            monthlyAllocations: true,
          },
        },
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Use project dates if not specified
    const forecastStart = startDate ?? project.startDate ?? new Date();
    const forecastEnd =
      endDate ??
      project.endDate ??
      new Date(forecastStart.getTime() + 90 * 24 * 60 * 60 * 1000);

    const weeklyStaffing: Record<string, number> = {};
    const staffBreakdown: Record<string, Record<string, number>> = {};
    let totalEstimatedCost = 0;
    let totalInternalCost = 0;

    // Calculate weekly staffing
    const currentDate = new Date(forecastStart);
    while (currentDate <= forecastEnd) {
      // Get Monday of the week
      const weekStart = new Date(currentDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const weekKey = weekStart.toISOString().slice(0, 10);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      weeklyStaffing[weekKey] = 0;
      staffBreakdown[weekKey] = {};

      for (const assignment of project.staffAssignments) {
        const overlapDays = this.calculateDateRangeOverlap(
          assignment.startDate,
          assignment.endDate,
          weekStart,
          weekEnd
        );

        if (overlapDays > 0) {
          const weeksInPeriod = overlapDays / 7;
          const allocationPct = Number(assignment.allocationPercentage) / 100;
          const hours =
            weeksInPeriod * Number(assignment.hoursPerWeek) * allocationPct;

          weeklyStaffing[weekKey] += hours;

          const staffName = `${assignment.staffMember.firstName} ${assignment.staffMember.lastName}`;
          staffBreakdown[weekKey][staffName] = hours;
        }
      }

      currentDate.setDate(currentDate.getDate() + 7);
    }

    // Calculate costs
    for (const assignment of project.staffAssignments) {
      const durationWeeks =
        (assignment.endDate.getTime() - assignment.startDate.getTime()) /
        (7 * 24 * 60 * 60 * 1000);
      const allocationPct = Number(assignment.allocationPercentage) / 100;
      const totalHours =
        durationWeeks * Number(assignment.hoursPerWeek) * allocationPct;

      const internalCost = assignment.staffMember.internalHourlyCost
        ? totalHours * Number(assignment.staffMember.internalHourlyCost)
        : 0;

      const billableRate =
        assignment.staffMember.staffRole?.defaultBillableRate ??
        assignment.staffMember.internalHourlyCost;
      const estimatedCost = billableRate ? totalHours * Number(billableRate) : 0;

      totalInternalCost += internalCost;
      totalEstimatedCost += estimatedCost;
    }

    return {
      projectId,
      projectName: project.name,
      forecastPeriod: {
        startDate: forecastStart.toISOString(),
        endDate: forecastEnd.toISOString(),
      },
      weeklyStaffing,
      staffBreakdown,
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
      totalInternalCost: Math.round(totalInternalCost * 100) / 100,
      assignmentsCount: project.staffAssignments.length,
    };
  }

  // --------------------------------------------------------------------------
  // Organization-Wide Forecast
  // --------------------------------------------------------------------------

  async calculateOrganizationForecast(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    forecastPeriod: { startDate: string; endDate: string };
    weeklyForecast: Record<
      string,
      { totalHours: number; projects: Record<string, number> }
    >;
    projectForecasts: Record<string, ProjectForecast>;
    staffUtilization: Record<
      string,
      {
        assignedHours: number;
        availableHours: number;
        utilizationRate: number;
        role: string;
      }
    >;
    totalEstimatedCost: number;
    totalInternalCost: number;
    totalMargin: number;
    projectsCount: number;
  }> {
    // Get all active projects for the company
    const projects = await prisma.project.findMany({
      where: {
        companyId,
        status: { in: ['planning', 'active'] },
      },
    });

    const weeklyForecast: Record<
      string,
      { totalHours: number; projects: Record<string, number> }
    > = {};
    const projectForecasts: Record<string, ProjectForecast> = {};
    let totalEstimatedCost = 0;
    let totalInternalCost = 0;

    for (const project of projects) {
      try {
        const forecast = await this.calculateProjectStaffingNeeds(
          project.id,
          startDate,
          endDate
        );
        projectForecasts[project.id] = forecast;

        // Aggregate weekly data
        for (const [week, hours] of Object.entries(forecast.weeklyStaffing)) {
          if (!weeklyForecast[week]) {
            weeklyForecast[week] = { totalHours: 0, projects: {} };
          }
          weeklyForecast[week].totalHours += hours;
          weeklyForecast[week].projects[project.name] = hours;
        }

        totalEstimatedCost += forecast.totalEstimatedCost;
        totalInternalCost += forecast.totalInternalCost;
      } catch {
        // Skip projects without proper dates
        continue;
      }
    }

    // Calculate staff utilization
    const staffMembers = await prisma.staffMember.findMany({
      where: { companyId, isActive: true },
      include: { staffRole: true },
    });

    const staffUtilization: Record<
      string,
      {
        assignedHours: number;
        availableHours: number;
        utilizationRate: number;
        role: string;
      }
    > = {};

    const totalDays =
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000) + 1;
    const totalAvailableHours = (totalDays / 7) * 40; // 40 hours/week standard

    for (const staff of staffMembers) {
      const allocation = await staffService.getStaffAllocationInPeriod(
        staff.id,
        startDate,
        endDate
      );

      const assignedHours =
        (allocation.rawTotalAllocation / 100) * totalAvailableHours;

      staffUtilization[`${staff.firstName} ${staff.lastName}`] = {
        assignedHours: Math.round(assignedHours * 10) / 10,
        availableHours: Math.round(totalAvailableHours * 10) / 10,
        utilizationRate:
          Math.round((assignedHours / totalAvailableHours) * 1000) / 10,
        role: staff.staffRole?.name ?? staff.role,
      };
    }

    return {
      forecastPeriod: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      weeklyForecast,
      projectForecasts,
      staffUtilization,
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
      totalInternalCost: Math.round(totalInternalCost * 100) / 100,
      totalMargin:
        Math.round((totalEstimatedCost - totalInternalCost) * 100) / 100,
      projectsCount: Object.keys(projectForecasts).length,
    };
  }

  // --------------------------------------------------------------------------
  // Staff Suggestions for Role
  // --------------------------------------------------------------------------

  async suggestStaffForRole(
    companyId: string,
    staffRoleId: string,
    startDate: Date,
    endDate: Date,
    allocationPercentage: number = 100,
    maxSuggestions: number = 10
  ): Promise<{
    role: {
      id: string;
      name: string;
      hourlyCost: number;
      defaultBillableRate: number | null;
    };
    period: { startDate: string; endDate: string };
    requiredAllocation: number;
    suggestions: StaffSuggestion[];
    totalCandidates: number;
    qualifiedCandidates: number;
  }> {
    const role = await prisma.staffRole.findUnique({
      where: { id: staffRoleId },
    });

    if (!role) {
      throw new Error('Staff role not found');
    }

    // Get staff members with this role
    const staffWithRole = await prisma.staffMember.findMany({
      where: {
        companyId,
        staffRoleId,
        isActive: true,
      },
      include: { staffRole: true },
    });

    const suggestions: StaffSuggestion[] = [];

    for (const staff of staffWithRole) {
      // Check basic availability dates
      if (staff.availabilityEnd && staff.availabilityEnd < startDate) {
        continue;
      }
      if (staff.availabilityStart && staff.availabilityStart > endDate) {
        continue;
      }

      // Get current allocation
      const allocationInfo = await staffService.getStaffAllocationInPeriod(
        staff.id,
        startDate,
        endDate
      );

      // Check if staff has enough available allocation
      if (allocationInfo.availableAllocation < allocationPercentage) {
        continue;
      }

      // Calculate match score
      let matchScore = 0;
      const matchReasons: string[] = [];

      // Factor 1: Availability (40 points max)
      const availabilityScore = (allocationInfo.availableAllocation / 100) * 40;
      matchScore += availabilityScore;
      if (allocationInfo.availableAllocation === 100) {
        matchReasons.push('Fully available during period');
      } else {
        matchReasons.push(
          `${allocationInfo.availableAllocation.toFixed(0)}% available during period`
        );
      }

      // Factor 2: Assignment end date alignment (30 points max)
      let alignmentScore = 0;
      if (allocationInfo.assignments.length > 0) {
        const relevantEndDates = allocationInfo.assignments
          .map((a) => new Date(a.endDate))
          .filter((d) => d <= startDate);

        if (relevantEndDates.length > 0) {
          const closestEnd = new Date(
            Math.max(...relevantEndDates.map((d) => d.getTime()))
          );
          const daysGap = Math.ceil(
            (startDate.getTime() - closestEnd.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysGap <= 0) {
            alignmentScore = 30;
            matchReasons.push('Assignment ends on role start date');
          } else if (daysGap <= 7) {
            alignmentScore = 25;
            matchReasons.push(`Assignment ends ${daysGap} days before start`);
          } else if (daysGap <= 14) {
            alignmentScore = 20;
            matchReasons.push(`Assignment ends ${daysGap} days before start`);
          } else if (daysGap <= 30) {
            alignmentScore = 15;
            matchReasons.push(`Assignment ends ${daysGap} days before start`);
          } else {
            alignmentScore = 10;
          }
        }
      } else {
        alignmentScore = 25;
        matchReasons.push('No current assignments');
      }
      matchScore += alignmentScore;

      // Factor 3: Recent experience (20 points max)
      const recentAssignments = await prisma.staffAssignment.count({
        where: {
          staffMemberId: staff.id,
          endDate: {
            gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          },
        },
      });

      if (recentAssignments > 0) {
        const experienceScore = Math.min(recentAssignments * 5, 20);
        matchScore += experienceScore;
        matchReasons.push(`${recentAssignments} recent assignment(s)`);
      }

      // Factor 4: Skills (10 points max)
      const skillsScore = staff.skills.length > 0 ? 10 : 5;
      matchScore += skillsScore;

      suggestions.push({
        staffId: staff.id,
        name: `${staff.firstName} ${staff.lastName}`,
        roleId: staff.staffRoleId,
        roleName: staff.staffRole?.name ?? null,
        internalHourlyCost: staff.internalHourlyCost
          ? Number(staff.internalHourlyCost)
          : null,
        matchScore: Math.round(matchScore * 10) / 10,
        matchReasons,
        currentAllocation: allocationInfo.rawTotalAllocation,
        availableAllocation: allocationInfo.availableAllocation,
        currentAssignments: allocationInfo.assignments,
        skills: staff.skills,
      });
    }

    // Sort by match score descending
    suggestions.sort((a, b) => b.matchScore - a.matchScore);

    return {
      role: {
        id: role.id,
        name: role.name,
        hourlyCost: Number(role.hourlyCost),
        defaultBillableRate: role.defaultBillableRate
          ? Number(role.defaultBillableRate)
          : null,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      requiredAllocation: allocationPercentage,
      suggestions: suggestions.slice(0, maxSuggestions),
      totalCandidates: staffWithRole.length,
      qualifiedCandidates: suggestions.length,
    };
  }

  // --------------------------------------------------------------------------
  // New Hire Needs Analysis
  // --------------------------------------------------------------------------

  async flagNewHireNeeds(
    companyId: string,
    staffRoleId: string,
    startDate: Date,
    endDate: Date,
    requiredCount: number = 1,
    allocationPercentage: number = 100
  ): Promise<NewHireNeedsResult> {
    const role = await prisma.staffRole.findUnique({
      where: { id: staffRoleId },
    });

    if (!role) {
      throw new Error('Staff role not found');
    }

    // Get suggestions for this role
    const suggestions = await this.suggestStaffForRole(
      companyId,
      staffRoleId,
      startDate,
      endDate,
      allocationPercentage
    );

    // Count how many qualified candidates we have
    const qualifiedCount = suggestions.suggestions.filter(
      (s) => s.availableAllocation >= allocationPercentage
    ).length;

    // Calculate the gap
    const gap = requiredCount - qualifiedCount;
    const needsNewHire = gap > 0;

    // Calculate estimated cost impact
    const durationWeeks =
      (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000);
    const hoursPerPerson = durationWeeks * 40 * (allocationPercentage / 100);

    const estimatedInternalCost =
      hoursPerPerson * Number(role.hourlyCost) * Math.max(gap, 0);
    const billableRate = role.defaultBillableRate ?? role.hourlyCost;
    const estimatedBillable =
      hoursPerPerson * Number(billableRate) * Math.max(gap, 0);

    // Generate recommendations
    const recommendations = this.generateHireRecommendations(
      role,
      gap,
      suggestions.suggestions,
      startDate
    );

    return {
      role: {
        id: role.id,
        name: role.name,
        hourlyCost: Number(role.hourlyCost),
        defaultBillableRate: role.defaultBillableRate
          ? Number(role.defaultBillableRate)
          : null,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        durationWeeks: Math.round(durationWeeks * 10) / 10,
      },
      requirement: {
        requiredCount,
        allocationPercentage,
      },
      availability: {
        totalStaffWithRole: suggestions.totalCandidates,
        qualifiedAvailable: qualifiedCount,
        gap: Math.max(gap, 0),
      },
      needsNewHire,
      newHireCount: Math.max(gap, 0),
      existingSuggestions: suggestions.suggestions,
      estimatedImpact: {
        hoursPerPerson: Math.round(hoursPerPerson * 10) / 10,
        internalCostForGap: Math.round(estimatedInternalCost * 100) / 100,
        billableForGap: Math.round(estimatedBillable * 100) / 100,
      },
      recommendations,
    };
  }

  private generateHireRecommendations(
    role: { id: string; name: string },
    gap: number,
    availableSuggestions: StaffSuggestion[],
    startDate: Date
  ): Array<{
    type: string;
    priority: 'low' | 'medium' | 'high';
    message: string;
    details: string;
  }> {
    const recommendations: Array<{
      type: string;
      priority: 'low' | 'medium' | 'high';
      message: string;
      details: string;
    }> = [];

    if (gap > 0) {
      const daysUntilStart = Math.ceil(
        (startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      recommendations.push({
        type: 'new_hire',
        priority: daysUntilStart < 60 ? 'high' : 'medium',
        message: `Hire ${gap} new ${role.name}(s) to fill the staffing gap`,
        details: `Position(s) needed by ${startDate.toISOString().slice(0, 10)}. Allow 4-8 weeks for recruiting and onboarding.`,
      });

      if (daysUntilStart < 30) {
        recommendations.push({
          type: 'contractor',
          priority: 'high',
          message: 'Consider temporary contractors while recruiting permanent staff',
          details: 'Short timeline may require interim staffing solution.',
        });
      }

      // Check if partial allocations could help
      const partialCapacity = availableSuggestions.reduce(
        (sum, s) => sum + s.availableAllocation,
        0
      );
      if (partialCapacity >= 50) {
        recommendations.push({
          type: 'reallocation',
          priority: 'medium',
          message: 'Consider splitting requirements across partially available staff',
          details: `Combined available capacity: ${partialCapacity.toFixed(0)}%`,
        });
      }
    } else if (availableSuggestions.length > 0) {
      recommendations.push({
        type: 'assign',
        priority: 'low',
        message: 'Sufficient staff available - proceed with assignment',
        details: `${availableSuggestions.length} qualified candidate(s) available`,
      });
    }

    return recommendations;
  }

  // --------------------------------------------------------------------------
  // Staffing Gaps Detection
  // --------------------------------------------------------------------------

  async detectStaffingGaps(
    companyId: string,
    projectId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Array<{
      type: string;
      projectId: string;
      projectName: string;
      week: string;
      message: string;
    }>
  > {
    const gaps: Array<{
      type: string;
      projectId: string;
      projectName: string;
      week: string;
      message: string;
    }> = [];

    if (projectId) {
      // Check specific project
      try {
        const forecast = await this.calculateProjectStaffingNeeds(
          projectId,
          startDate,
          endDate
        );

        for (const [week, hours] of Object.entries(forecast.weeklyStaffing)) {
          if (hours === 0) {
            gaps.push({
              type: 'project_gap',
              projectId,
              projectName: forecast.projectName,
              week,
              message: `No staffing assigned for week of ${week}`,
            });
          }
        }
      } catch {
        // Skip if project has issues
      }
    } else {
      // Check all projects
      const projects = await prisma.project.findMany({
        where: {
          companyId,
          status: { in: ['planning', 'active'] },
        },
      });

      for (const project of projects) {
        const projectGaps = await this.detectStaffingGaps(
          companyId,
          project.id,
          startDate,
          endDate
        );
        gaps.push(...projectGaps);
      }
    }

    return gaps;
  }

  // --------------------------------------------------------------------------
  // Capacity Analysis
  // --------------------------------------------------------------------------

  async calculateCapacityAnalysis(
    companyId: string,
    staffMemberId: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<
    | {
        staffId: string;
        staffName: string;
        role: string;
        assignedHours: number;
        availableHours: number;
        utilizationRate: number;
        overallocated: boolean;
      }
    | Record<
        string,
        {
          staffId: string;
          staffName: string;
          role: string;
          assignedHours: number;
          availableHours: number;
          utilizationRate: number;
          overallocated: boolean;
        }
      >
  > {
    const totalDays =
      (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000) + 1;
    const totalAvailableHours = (totalDays / 7) * 40;

    if (staffMemberId) {
      const staff = await prisma.staffMember.findUnique({
        where: { id: staffMemberId },
        include: { staffRole: true },
      });

      if (!staff) {
        throw new Error('Staff member not found');
      }

      const allocation = await staffService.getStaffAllocationInPeriod(
        staffMemberId,
        startDate,
        endDate
      );

      const assignedHours =
        (allocation.rawTotalAllocation / 100) * totalAvailableHours;

      return {
        staffId: staffMemberId,
        staffName: `${staff.firstName} ${staff.lastName}`,
        role: staff.staffRole?.name ?? staff.role,
        assignedHours: Math.round(assignedHours * 10) / 10,
        availableHours: Math.round(totalAvailableHours * 10) / 10,
        utilizationRate:
          Math.round((assignedHours / totalAvailableHours) * 1000) / 10,
        overallocated: assignedHours > totalAvailableHours,
      };
    } else {
      // Analyze all staff
      const allStaff = await prisma.staffMember.findMany({
        where: { companyId, isActive: true },
        include: { staffRole: true },
      });

      const analysis: Record<
        string,
        {
          staffId: string;
          staffName: string;
          role: string;
          assignedHours: number;
          availableHours: number;
          utilizationRate: number;
          overallocated: boolean;
        }
      > = {};

      for (const staff of allStaff) {
        const result = (await this.calculateCapacityAnalysis(
          companyId,
          staff.id,
          startDate,
          endDate
        )) as {
          staffId: string;
          staffName: string;
          role: string;
          assignedHours: number;
          availableHours: number;
          utilizationRate: number;
          overallocated: boolean;
        };
        analysis[staff.id] = result;
      }

      return analysis;
    }
  }
}

// Export singleton instance
export const forecastingService = new ForecastingService();
