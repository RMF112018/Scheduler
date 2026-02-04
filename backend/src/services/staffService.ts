/**
 * Staff Service
 *
 * Provides comprehensive staff management functionality including:
 * - Staff Role CRUD (position/title management)
 * - Staff Member CRUD with availability tracking
 * - Staff Assignment management (project-level allocations)
 * - CSV import for bulk staff data
 * - Allocation calculations and conflict detection
 */

import { PrismaClient, Prisma, StaffMember, StaffRole, StaffAssignment } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

export interface StaffRoleInput {
  companyId: string;
  name: string;
  description?: string;
  hourlyCost: number;
  defaultBillableRate?: number;
  isActive?: boolean;
}

export interface StaffMemberInput {
  companyId: string;
  userId?: string;
  staffRoleId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  role: string;
  certifications?: string[];
  skills?: string[];
  internalHourlyCost?: number;
  availabilityStart?: Date;
  availabilityEnd?: Date;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

export interface StaffAssignmentInput {
  staffMemberId: string;
  projectId: string;
  startDate: Date;
  endDate: Date;
  hoursPerWeek?: number;
  roleOnProject?: string;
  allocationType?: 'full' | 'split_by_projects' | 'percentage_total' | 'percentage_monthly';
  allocationPercentage?: number;
  allowOverAllocation?: boolean;
  monthlyAllocations?: Array<{
    month: Date;
    allocationPercentage: number;
  }>;
}

export interface AllocationInfo {
  totalAllocation: number;
  rawTotalAllocation: number;
  availableAllocation: number;
  assignments: Array<{
    assignmentId: string;
    projectId: string;
    projectName: string;
    startDate: string;
    endDate: string;
    allocationPercentage: number;
    roleOnProject: string | null;
  }>;
}

export interface StaffAvailabilityResult {
  staffId: string;
  name: string;
  roleId: string | null;
  roleName: string | null;
  availabilityStatus: 'available' | 'partial' | 'unavailable';
  currentAllocation: number;
  availableAllocation: number;
  currentAssignments: AllocationInfo['assignments'];
  skills: string[];
  reason?: string;
}

// ============================================================================
// Staff Role Functions
// ============================================================================

export class StaffService {
  // --------------------------------------------------------------------------
  // Staff Role CRUD
  // --------------------------------------------------------------------------

  async createStaffRole(input: StaffRoleInput): Promise<StaffRole> {
    return prisma.staffRole.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        description: input.description,
        hourlyCost: new Decimal(input.hourlyCost),
        defaultBillableRate: input.defaultBillableRate
          ? new Decimal(input.defaultBillableRate)
          : null,
        isActive: input.isActive ?? true,
      },
    });
  }

  async getStaffRoles(
    companyId: string,
    options?: { activeOnly?: boolean }
  ): Promise<StaffRole[]> {
    const where: Prisma.StaffRoleWhereInput = { companyId };
    if (options?.activeOnly) {
      where.isActive = true;
    }
    return prisma.staffRole.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { staffMembers: true },
        },
      },
    });
  }

  async getStaffRoleById(id: string): Promise<StaffRole | null> {
    return prisma.staffRole.findUnique({
      where: { id },
      include: {
        staffMembers: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async updateStaffRole(
    id: string,
    input: Partial<StaffRoleInput>
  ): Promise<StaffRole> {
    const data: Prisma.StaffRoleUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.hourlyCost !== undefined)
      data.hourlyCost = new Decimal(input.hourlyCost);
    if (input.defaultBillableRate !== undefined)
      data.defaultBillableRate = input.defaultBillableRate
        ? new Decimal(input.defaultBillableRate)
        : null;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    return prisma.staffRole.update({
      where: { id },
      data,
    });
  }

  async deleteStaffRole(id: string): Promise<void> {
    // Check if any staff members are assigned to this role
    const staffCount = await prisma.staffMember.count({
      where: { staffRoleId: id },
    });

    if (staffCount > 0) {
      throw new Error(
        `Cannot delete role - ${staffCount} staff member(s) assigned`
      );
    }

    await prisma.staffRole.delete({ where: { id } });
  }

  // --------------------------------------------------------------------------
  // Staff Member CRUD
  // --------------------------------------------------------------------------

  async createStaffMember(input: StaffMemberInput): Promise<StaffMember> {
    return prisma.staffMember.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        staffRoleId: input.staffRoleId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        role: input.role,
        certifications: input.certifications ?? [],
        skills: input.skills ?? [],
        internalHourlyCost: input.internalHourlyCost
          ? new Decimal(input.internalHourlyCost)
          : null,
        availabilityStart: input.availabilityStart,
        availabilityEnd: input.availabilityEnd,
        isActive: input.isActive ?? true,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
      include: {
        staffRole: true,
      },
    });
  }

  async getStaffMembers(
    companyId: string,
    options?: {
      staffRoleId?: string;
      activeOnly?: boolean;
      availableFrom?: Date;
      availableTo?: Date;
      skills?: string[];
    }
  ): Promise<StaffMember[]> {
    const where: Prisma.StaffMemberWhereInput = { companyId };

    if (options?.staffRoleId) {
      where.staffRoleId = options.staffRoleId;
    }

    if (options?.activeOnly) {
      where.isActive = true;
    }

    if (options?.availableFrom) {
      where.OR = [
        { availabilityStart: { lte: options.availableFrom } },
        { availabilityStart: null },
      ];
    }

    if (options?.availableTo) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { availabilityEnd: { gte: options.availableTo } },
            { availabilityEnd: null },
          ],
        },
      ];
    }

    const staffMembers = await prisma.staffMember.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        staffRole: true,
        staffAssignments: {
          where: {
            endDate: { gte: new Date() },
          },
          include: {
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Filter by skills if specified
    if (options?.skills && options.skills.length > 0) {
      return staffMembers.filter((staff) =>
        options.skills!.some((skill) => staff.skills.includes(skill))
      );
    }

    return staffMembers;
  }

  async getStaffMemberById(id: string): Promise<StaffMember | null> {
    return prisma.staffMember.findUnique({
      where: { id },
      include: {
        staffRole: true,
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        staffAssignments: {
          include: {
            project: { select: { id: true, name: true, status: true } },
            monthlyAllocations: true,
          },
          orderBy: { startDate: 'desc' },
        },
      },
    });
  }

  async updateStaffMember(
    id: string,
    input: Partial<StaffMemberInput>
  ): Promise<StaffMember> {
    const data: Prisma.StaffMemberUpdateInput = {};

    if (input.staffRoleId !== undefined) data.staffRoleId = input.staffRoleId;
    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.email !== undefined) data.email = input.email;
    if (input.role !== undefined) data.role = input.role;
    if (input.certifications !== undefined)
      data.certifications = input.certifications;
    if (input.skills !== undefined) data.skills = input.skills;
    if (input.internalHourlyCost !== undefined)
      data.internalHourlyCost = input.internalHourlyCost
        ? new Decimal(input.internalHourlyCost)
        : null;
    if (input.availabilityStart !== undefined)
      data.availabilityStart = input.availabilityStart;
    if (input.availabilityEnd !== undefined)
      data.availabilityEnd = input.availabilityEnd;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.metadata !== undefined)
      data.metadata = input.metadata as Prisma.InputJsonValue;

    return prisma.staffMember.update({
      where: { id },
      data,
      include: {
        staffRole: true,
      },
    });
  }

  async deleteStaffMember(id: string): Promise<void> {
    // Check if staff has active assignments
    const assignmentCount = await prisma.staffAssignment.count({
      where: {
        staffMemberId: id,
        endDate: { gte: new Date() },
      },
    });

    if (assignmentCount > 0) {
      throw new Error(
        `Cannot delete staff member with ${assignmentCount} active assignment(s)`
      );
    }

    await prisma.staffMember.delete({ where: { id } });
  }

  // --------------------------------------------------------------------------
  // Staff Assignment CRUD
  // --------------------------------------------------------------------------

  async createStaffAssignment(
    input: StaffAssignmentInput
  ): Promise<StaffAssignment> {
    const assignment = await prisma.staffAssignment.create({
      data: {
        staffMemberId: input.staffMemberId,
        projectId: input.projectId,
        startDate: input.startDate,
        endDate: input.endDate,
        hoursPerWeek: input.hoursPerWeek
          ? new Decimal(input.hoursPerWeek)
          : new Decimal(40),
        roleOnProject: input.roleOnProject,
        allocationType: input.allocationType ?? 'full',
        allocationPercentage: input.allocationPercentage
          ? new Decimal(input.allocationPercentage)
          : new Decimal(100),
        allowOverAllocation: input.allowOverAllocation ?? false,
      },
      include: {
        staffMember: { include: { staffRole: true } },
        project: { select: { id: true, name: true } },
      },
    });

    // Create monthly allocations if provided
    if (
      input.allocationType === 'percentage_monthly' &&
      input.monthlyAllocations
    ) {
      await prisma.staffAssignmentMonthlyAllocation.createMany({
        data: input.monthlyAllocations.map((ma) => ({
          staffAssignmentId: assignment.id,
          month: ma.month,
          allocationPercentage: new Decimal(ma.allocationPercentage),
        })),
      });
    }

    return assignment;
  }

  async getStaffAssignments(options?: {
    staffMemberId?: string;
    projectId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<StaffAssignment[]> {
    const where: Prisma.StaffAssignmentWhereInput = {};

    if (options?.staffMemberId) {
      where.staffMemberId = options.staffMemberId;
    }

    if (options?.projectId) {
      where.projectId = options.projectId;
    }

    if (options?.startDate || options?.endDate) {
      where.AND = [];
      if (options.startDate) {
        where.AND.push({ endDate: { gte: options.startDate } });
      }
      if (options.endDate) {
        where.AND.push({ startDate: { lte: options.endDate } });
      }
    }

    return prisma.staffAssignment.findMany({
      where,
      include: {
        staffMember: { include: { staffRole: true } },
        project: { select: { id: true, name: true, status: true } },
        monthlyAllocations: true,
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async getStaffAssignmentById(id: string): Promise<StaffAssignment | null> {
    return prisma.staffAssignment.findUnique({
      where: { id },
      include: {
        staffMember: { include: { staffRole: true } },
        project: { select: { id: true, name: true, status: true } },
        monthlyAllocations: true,
      },
    });
  }

  async updateStaffAssignment(
    id: string,
    input: Partial<StaffAssignmentInput>
  ): Promise<StaffAssignment> {
    const data: Prisma.StaffAssignmentUpdateInput = {};

    if (input.startDate !== undefined) data.startDate = input.startDate;
    if (input.endDate !== undefined) data.endDate = input.endDate;
    if (input.hoursPerWeek !== undefined)
      data.hoursPerWeek = new Decimal(input.hoursPerWeek);
    if (input.roleOnProject !== undefined)
      data.roleOnProject = input.roleOnProject;
    if (input.allocationType !== undefined)
      data.allocationType = input.allocationType;
    if (input.allocationPercentage !== undefined)
      data.allocationPercentage = new Decimal(input.allocationPercentage);
    if (input.allowOverAllocation !== undefined)
      data.allowOverAllocation = input.allowOverAllocation;

    const assignment = await prisma.staffAssignment.update({
      where: { id },
      data,
      include: {
        staffMember: { include: { staffRole: true } },
        project: { select: { id: true, name: true } },
        monthlyAllocations: true,
      },
    });

    // Update monthly allocations if provided
    if (input.monthlyAllocations) {
      // Delete existing and create new
      await prisma.staffAssignmentMonthlyAllocation.deleteMany({
        where: { staffAssignmentId: id },
      });

      await prisma.staffAssignmentMonthlyAllocation.createMany({
        data: input.monthlyAllocations.map((ma) => ({
          staffAssignmentId: id,
          month: ma.month,
          allocationPercentage: new Decimal(ma.allocationPercentage),
        })),
      });
    }

    return assignment;
  }

  async deleteStaffAssignment(id: string): Promise<void> {
    await prisma.staffAssignment.delete({ where: { id } });
  }

  // --------------------------------------------------------------------------
  // Allocation Calculations
  // --------------------------------------------------------------------------

  async getStaffAllocationInPeriod(
    staffMemberId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<AllocationInfo> {
    const assignments = await prisma.staffAssignment.findMany({
      where: {
        staffMemberId,
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      include: {
        project: { select: { id: true, name: true } },
        monthlyAllocations: true,
      },
    });

    if (assignments.length === 0) {
      return {
        totalAllocation: 0,
        rawTotalAllocation: 0,
        availableAllocation: 100,
        assignments: [],
      };
    }

    let totalAllocation = 0;
    const assignmentDetails: AllocationInfo['assignments'] = [];

    for (const assignment of assignments) {
      const allocation = this.calculateAllocationForPeriod(
        assignment,
        periodStart,
        periodEnd
      );
      totalAllocation += allocation;

      assignmentDetails.push({
        assignmentId: assignment.id,
        projectId: assignment.projectId,
        projectName: assignment.project.name,
        startDate: assignment.startDate.toISOString(),
        endDate: assignment.endDate.toISOString(),
        allocationPercentage: allocation,
        roleOnProject: assignment.roleOnProject,
      });
    }

    return {
      totalAllocation: Math.min(totalAllocation, 100),
      rawTotalAllocation: totalAllocation,
      availableAllocation: Math.max(0, 100 - totalAllocation),
      assignments: assignmentDetails,
    };
  }

  private calculateAllocationForPeriod(
    assignment: StaffAssignment & {
      monthlyAllocations: Array<{
        month: Date;
        allocationPercentage: Prisma.Decimal;
      }>;
    },
    periodStart: Date,
    periodEnd: Date
  ): number {
    const allocationType = assignment.allocationType;

    if (allocationType === 'full') {
      return 100;
    }

    if (allocationType === 'percentage_total') {
      return Number(assignment.allocationPercentage);
    }

    if (allocationType === 'percentage_monthly') {
      // Calculate weighted average based on monthly allocations
      if (assignment.monthlyAllocations.length === 0) {
        return 100;
      }

      let totalDays = 0;
      let weightedAllocation = 0;

      const currentMonth = new Date(
        periodStart.getFullYear(),
        periodStart.getMonth(),
        1
      );
      while (currentMonth <= periodEnd) {
        const monthAllocation = assignment.monthlyAllocations.find(
          (ma) =>
            ma.month.getFullYear() === currentMonth.getFullYear() &&
            ma.month.getMonth() === currentMonth.getMonth()
        );

        const allocationPct = monthAllocation
          ? Number(monthAllocation.allocationPercentage)
          : 100;

        // Calculate days in this month that overlap with the period
        const monthStart = new Date(
          Math.max(currentMonth.getTime(), periodStart.getTime())
        );
        const nextMonth = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + 1,
          0
        );
        const monthEnd = new Date(
          Math.min(nextMonth.getTime(), periodEnd.getTime())
        );

        const daysInPeriod = Math.max(
          0,
          Math.ceil(
            (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1
        );

        if (daysInPeriod > 0) {
          totalDays += daysInPeriod;
          weightedAllocation += daysInPeriod * allocationPct;
        }

        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }

      return totalDays > 0 ? weightedAllocation / totalDays : 100;
    }

    // split_by_projects: divide by number of overlapping assignments
    // This would require querying other assignments, so default to the stored percentage
    return Number(assignment.allocationPercentage);
  }

  // --------------------------------------------------------------------------
  // Staff Availability Forecast
  // --------------------------------------------------------------------------

  async getStaffAvailabilityForecast(
    companyId: string,
    options?: {
      staffRoleId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    period: { startDate: string; endDate: string };
    available: StaffAvailabilityResult[];
    partiallyAvailable: StaffAvailabilityResult[];
    unavailable: StaffAvailabilityResult[];
    summary: {
      totalStaff: number;
      availableCount: number;
      partialCount: number;
      unavailableCount: number;
    };
  }> {
    const startDate = options?.startDate ?? new Date();
    const endDate =
      options?.endDate ??
      new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    const staffMembers = await this.getStaffMembers(companyId, {
      staffRoleId: options?.staffRoleId,
      activeOnly: true,
    });

    const available: StaffAvailabilityResult[] = [];
    const partiallyAvailable: StaffAvailabilityResult[] = [];
    const unavailable: StaffAvailabilityResult[] = [];

    for (const staff of staffMembers) {
      // Check staff availability dates
      if (staff.availabilityEnd && staff.availabilityEnd < startDate) {
        unavailable.push({
          staffId: staff.id,
          name: `${staff.firstName} ${staff.lastName}`,
          roleId: staff.staffRoleId,
          roleName: (staff as any).staffRole?.name ?? null,
          availabilityStatus: 'unavailable',
          currentAllocation: 0,
          availableAllocation: 0,
          currentAssignments: [],
          skills: staff.skills,
          reason: 'Staff availability ends before period',
        });
        continue;
      }

      if (staff.availabilityStart && staff.availabilityStart > endDate) {
        unavailable.push({
          staffId: staff.id,
          name: `${staff.firstName} ${staff.lastName}`,
          roleId: staff.staffRoleId,
          roleName: (staff as any).staffRole?.name ?? null,
          availabilityStatus: 'unavailable',
          currentAllocation: 0,
          availableAllocation: 0,
          currentAssignments: [],
          skills: staff.skills,
          reason: 'Staff availability starts after period',
        });
        continue;
      }

      const allocationInfo = await this.getStaffAllocationInPeriod(
        staff.id,
        startDate,
        endDate
      );

      const result: StaffAvailabilityResult = {
        staffId: staff.id,
        name: `${staff.firstName} ${staff.lastName}`,
        roleId: staff.staffRoleId,
        roleName: (staff as any).staffRole?.name ?? null,
        availabilityStatus: 'available',
        currentAllocation: allocationInfo.rawTotalAllocation,
        availableAllocation: allocationInfo.availableAllocation,
        currentAssignments: allocationInfo.assignments,
        skills: staff.skills,
      };

      if (allocationInfo.rawTotalAllocation === 0) {
        result.availabilityStatus = 'available';
        available.push(result);
      } else if (allocationInfo.rawTotalAllocation < 100) {
        result.availabilityStatus = 'partial';
        partiallyAvailable.push(result);
      } else {
        result.availabilityStatus = 'unavailable';
        result.reason = 'Fully allocated during period';
        unavailable.push(result);
      }
    }

    return {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      available,
      partiallyAvailable,
      unavailable,
      summary: {
        totalStaff: staffMembers.length,
        availableCount: available.length,
        partialCount: partiallyAvailable.length,
        unavailableCount: unavailable.length,
      },
    };
  }

  // --------------------------------------------------------------------------
  // CSV Import
  // --------------------------------------------------------------------------

  async importStaffFromCSV(
    companyId: string,
    csvContent: string,
    options?: {
      defaultRoleId?: string;
      updateExisting?: boolean;
    }
  ): Promise<{
    imported: number;
    updated: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let imported = 0;
    let updated = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNum = i + 2; // Account for header row

      try {
        // Validate required fields
        if (!record.firstName && !record.first_name) {
          errors.push({ row: rowNum, error: 'Missing firstName' });
          continue;
        }
        if (!record.lastName && !record.last_name) {
          errors.push({ row: rowNum, error: 'Missing lastName' });
          continue;
        }

        const firstName = record.firstName || record.first_name;
        const lastName = record.lastName || record.last_name;
        const email = record.email || null;
        const role = record.role || 'Staff';
        const skills = record.skills
          ? record.skills.split(',').map((s: string) => s.trim())
          : [];
        const certifications = record.certifications
          ? record.certifications.split(',').map((c: string) => c.trim())
          : [];
        const internalHourlyCost = record.hourlyRate
          ? parseFloat(record.hourlyRate)
          : record.internalHourlyCost
            ? parseFloat(record.internalHourlyCost)
            : undefined;

        // Check if staff member already exists (by email)
        let existingStaff = null;
        if (email) {
          existingStaff = await prisma.staffMember.findFirst({
            where: { companyId, email },
          });
        }

        if (existingStaff && options?.updateExisting) {
          await this.updateStaffMember(existingStaff.id, {
            firstName,
            lastName,
            role,
            skills,
            certifications,
            internalHourlyCost,
            staffRoleId: options.defaultRoleId,
          });
          updated++;
        } else if (!existingStaff) {
          await this.createStaffMember({
            companyId,
            firstName,
            lastName,
            email,
            role,
            skills,
            certifications,
            internalHourlyCost,
            staffRoleId: options?.defaultRoleId,
          });
          imported++;
        }
      } catch (error) {
        errors.push({
          row: rowNum,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { imported, updated, errors };
  }

  // --------------------------------------------------------------------------
  // Over-Allocation Detection
  // --------------------------------------------------------------------------

  async detectOverAllocations(
    staffMemberId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    staffId: string;
    staffName: string;
    hasConflicts: boolean;
    overallSeverity: 'none' | 'moderate' | 'high' | 'critical';
    overAllocatedPeriods: Array<{
      month: string;
      totalAllocation: number;
      overAllocationAmount: number;
      severity: 'moderate' | 'high' | 'critical';
      conflictingAssignments: Array<{
        assignmentId: string;
        projectName: string;
        allocationPercentage: number;
      }>;
    }>;
  }> {
    const staff = await prisma.staffMember.findUnique({
      where: { id: staffMemberId },
    });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    const assignments = await prisma.staffAssignment.findMany({
      where: {
        staffMemberId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      include: {
        project: { select: { name: true } },
        monthlyAllocations: true,
      },
    });

    const overAllocatedPeriods: Array<{
      month: string;
      totalAllocation: number;
      overAllocationAmount: number;
      severity: 'moderate' | 'high' | 'critical';
      conflictingAssignments: Array<{
        assignmentId: string;
        projectName: string;
        allocationPercentage: number;
      }>;
    }> = [];

    // Check each month in the period
    const currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (currentMonth <= endDate) {
      const monthKey = currentMonth.toISOString().slice(0, 7);
      const monthEnd = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0
      );

      let totalAllocation = 0;
      const monthAssignments: Array<{
        assignmentId: string;
        projectName: string;
        allocationPercentage: number;
      }> = [];

      for (const assignment of assignments) {
        // Check if assignment overlaps with this month
        if (assignment.startDate <= monthEnd && assignment.endDate >= currentMonth) {
          const allocation = this.calculateAllocationForPeriod(
            assignment as any,
            currentMonth,
            monthEnd
          );
          totalAllocation += allocation;

          monthAssignments.push({
            assignmentId: assignment.id,
            projectName: assignment.project.name,
            allocationPercentage: allocation,
          });
        }
      }

      if (totalAllocation > 100) {
        const overAmount = totalAllocation - 100;
        let severity: 'moderate' | 'high' | 'critical' = 'moderate';
        if (overAmount > 50) severity = 'critical';
        else if (overAmount > 25) severity = 'high';

        overAllocatedPeriods.push({
          month: monthKey,
          totalAllocation,
          overAllocationAmount: overAmount,
          severity,
          conflictingAssignments: monthAssignments,
        });
      }

      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    const hasConflicts = overAllocatedPeriods.length > 0;
    let overallSeverity: 'none' | 'moderate' | 'high' | 'critical' = 'none';

    if (hasConflicts) {
      const maxOverAllocation = Math.max(
        ...overAllocatedPeriods.map((p) => p.overAllocationAmount)
      );
      if (maxOverAllocation > 50) overallSeverity = 'critical';
      else if (maxOverAllocation > 25) overallSeverity = 'high';
      else overallSeverity = 'moderate';
    }

    return {
      staffId: staffMemberId,
      staffName: `${staff.firstName} ${staff.lastName}`,
      hasConflicts,
      overallSeverity,
      overAllocatedPeriods,
    };
  }

  async validateAssignmentAllocation(
    staffMemberId: string,
    newStartDate: Date,
    newEndDate: Date,
    newAllocationPercentage: number,
    excludeAssignmentId?: string
  ): Promise<{
    isValid: boolean;
    conflicts: Array<{
      month: string;
      existingAllocation: number;
      newAllocation: number;
      projectedTotal: number;
      overAllocationAmount: number;
    }>;
    message: string;
  }> {
    const staff = await prisma.staffMember.findUnique({
      where: { id: staffMemberId },
    });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    const where: Prisma.StaffAssignmentWhereInput = {
      staffMemberId,
      startDate: { lte: newEndDate },
      endDate: { gte: newStartDate },
    };

    if (excludeAssignmentId) {
      where.id = { not: excludeAssignmentId };
    }

    const existingAssignments = await prisma.staffAssignment.findMany({
      where,
      include: {
        project: { select: { name: true } },
        monthlyAllocations: true,
      },
    });

    const conflicts: Array<{
      month: string;
      existingAllocation: number;
      newAllocation: number;
      projectedTotal: number;
      overAllocationAmount: number;
    }> = [];

    // Check each month in the new assignment period
    const currentMonth = new Date(newStartDate.getFullYear(), newStartDate.getMonth(), 1);
    while (currentMonth <= newEndDate) {
      const monthKey = currentMonth.toISOString().slice(0, 7);
      const monthEnd = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0
      );

      let existingAllocation = 0;

      for (const assignment of existingAssignments) {
        if (assignment.startDate <= monthEnd && assignment.endDate >= currentMonth) {
          existingAllocation += this.calculateAllocationForPeriod(
            assignment as any,
            currentMonth,
            monthEnd
          );
        }
      }

      const projectedTotal = existingAllocation + newAllocationPercentage;

      if (projectedTotal > 100) {
        conflicts.push({
          month: monthKey,
          existingAllocation: Math.round(existingAllocation * 10) / 10,
          newAllocation: newAllocationPercentage,
          projectedTotal: Math.round(projectedTotal * 10) / 10,
          overAllocationAmount: Math.round((projectedTotal - 100) * 10) / 10,
        });
      }

      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    return {
      isValid: conflicts.length === 0,
      conflicts,
      message:
        conflicts.length > 0
          ? 'Assignment would cause over-allocation'
          : 'Assignment is valid',
    };
  }
}

// Export singleton instance
export const staffService = new StaffService();
