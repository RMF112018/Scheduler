/**
 * Staff Controller
 *
 * Handles HTTP requests for staff management including:
 * - Staff Roles (position/title management)
 * - Staff Members (employee management)
 * - Staff Assignments (project allocations)
 * - CSV Import
 * - Availability and allocation queries
 */

import { Request, Response, NextFunction } from 'express';
import { staffService } from '../services/staffService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

// ============================================================================
// Staff Role Endpoints
// ============================================================================

export const createStaffRole = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId } = req.user!;
    const { name, description, hourlyCost, defaultBillableRate, isActive } =
      req.body;

    if (!name || hourlyCost === undefined) {
      throw new AppError('Name and hourlyCost are required', 400);
    }

    const role = await staffService.createStaffRole({
      companyId,
      name,
      description,
      hourlyCost: parseFloat(hourlyCost),
      defaultBillableRate: defaultBillableRate
        ? parseFloat(defaultBillableRate)
        : undefined,
      isActive,
    });

    res.status(201).json(role);
  } catch (error) {
    next(error);
  }
};

export const getStaffRoles = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId } = req.user!;
    const activeOnly = req.query.active_only === 'true';

    const roles = await staffService.getStaffRoles(companyId, { activeOnly });
    res.json(roles);
  } catch (error) {
    next(error);
  }
};

export const getStaffRoleById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const role = await staffService.getStaffRoleById(id);
    if (!role) {
      throw new AppError('Staff role not found', 404);
    }

    res.json(role);
  } catch (error) {
    next(error);
  }
};

export const updateStaffRole = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, description, hourlyCost, defaultBillableRate, isActive } =
      req.body;

    const role = await staffService.updateStaffRole(id, {
      name,
      description,
      hourlyCost: hourlyCost !== undefined ? parseFloat(hourlyCost) : undefined,
      defaultBillableRate:
        defaultBillableRate !== undefined
          ? parseFloat(defaultBillableRate)
          : undefined,
      isActive,
    });

    res.json(role);
  } catch (error) {
    next(error);
  }
};

export const deleteStaffRole = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    await staffService.deleteStaffRole(id);
    res.json({ message: 'Staff role deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Staff Member Endpoints
// ============================================================================

export const createStaffMember = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId } = req.user!;
    const {
      userId,
      staffRoleId,
      firstName,
      lastName,
      email,
      role,
      certifications,
      skills,
      internalHourlyCost,
      availabilityStart,
      availabilityEnd,
      isActive,
      metadata,
    } = req.body;

    if (!firstName || !lastName || !role) {
      throw new AppError('firstName, lastName, and role are required', 400);
    }

    const staffMember = await staffService.createStaffMember({
      companyId,
      userId,
      staffRoleId,
      firstName,
      lastName,
      email,
      role,
      certifications,
      skills,
      internalHourlyCost: internalHourlyCost
        ? parseFloat(internalHourlyCost)
        : undefined,
      availabilityStart: availabilityStart
        ? new Date(availabilityStart)
        : undefined,
      availabilityEnd: availabilityEnd ? new Date(availabilityEnd) : undefined,
      isActive,
      metadata,
    });

    res.status(201).json(staffMember);
  } catch (error) {
    next(error);
  }
};

export const getStaffMembers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId } = req.user!;
    const {
      staff_role_id,
      active_only,
      available_from,
      available_to,
      skills,
    } = req.query;

    const staffMembers = await staffService.getStaffMembers(companyId, {
      staffRoleId: staff_role_id as string | undefined,
      activeOnly: active_only === 'true',
      availableFrom: available_from
        ? new Date(available_from as string)
        : undefined,
      availableTo: available_to ? new Date(available_to as string) : undefined,
      skills: skills ? (skills as string).split(',') : undefined,
    });

    res.json(staffMembers);
  } catch (error) {
    next(error);
  }
};

export const getStaffMemberById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const staffMember = await staffService.getStaffMemberById(id);
    if (!staffMember) {
      throw new AppError('Staff member not found', 404);
    }

    res.json(staffMember);
  } catch (error) {
    next(error);
  }
};

export const updateStaffMember = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const {
      staffRoleId,
      firstName,
      lastName,
      email,
      role,
      certifications,
      skills,
      internalHourlyCost,
      availabilityStart,
      availabilityEnd,
      isActive,
      metadata,
    } = req.body;

    const staffMember = await staffService.updateStaffMember(id, {
      staffRoleId,
      firstName,
      lastName,
      email,
      role,
      certifications,
      skills,
      internalHourlyCost:
        internalHourlyCost !== undefined
          ? parseFloat(internalHourlyCost)
          : undefined,
      availabilityStart:
        availabilityStart !== undefined
          ? availabilityStart
            ? new Date(availabilityStart)
            : undefined
          : undefined,
      availabilityEnd:
        availabilityEnd !== undefined
          ? availabilityEnd
            ? new Date(availabilityEnd)
            : undefined
          : undefined,
      isActive,
      metadata,
    });

    res.json(staffMember);
  } catch (error) {
    next(error);
  }
};

export const deleteStaffMember = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    await staffService.deleteStaffMember(id);
    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Staff Assignment Endpoints
// ============================================================================

export const createStaffAssignment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      staffMemberId,
      projectId,
      startDate,
      endDate,
      hoursPerWeek,
      roleOnProject,
      allocationType,
      allocationPercentage,
      allowOverAllocation,
      monthlyAllocations,
    } = req.body;

    if (!staffMemberId || !projectId || !startDate || !endDate) {
      throw new AppError(
        'staffMemberId, projectId, startDate, and endDate are required',
        400
      );
    }

    const assignment = await staffService.createStaffAssignment({
      staffMemberId,
      projectId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      hoursPerWeek: hoursPerWeek ? parseFloat(hoursPerWeek) : undefined,
      roleOnProject,
      allocationType,
      allocationPercentage: allocationPercentage
        ? parseFloat(allocationPercentage)
        : undefined,
      allowOverAllocation,
      monthlyAllocations: monthlyAllocations?.map(
        (ma: { month: string; allocationPercentage: number }) => ({
          month: new Date(ma.month),
          allocationPercentage: ma.allocationPercentage,
        })
      ),
    });

    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
};

export const getStaffAssignments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { staff_member_id, project_id, start_date, end_date } = req.query;

    const assignments = await staffService.getStaffAssignments({
      staffMemberId: staff_member_id as string | undefined,
      projectId: project_id as string | undefined,
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
    });

    res.json(assignments);
  } catch (error) {
    next(error);
  }
};

export const getStaffAssignmentById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const assignment = await staffService.getStaffAssignmentById(id);
    if (!assignment) {
      throw new AppError('Staff assignment not found', 404);
    }

    res.json(assignment);
  } catch (error) {
    next(error);
  }
};

export const updateStaffAssignment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      hoursPerWeek,
      roleOnProject,
      allocationType,
      allocationPercentage,
      allowOverAllocation,
      monthlyAllocations,
    } = req.body;

    const assignment = await staffService.updateStaffAssignment(id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      hoursPerWeek:
        hoursPerWeek !== undefined ? parseFloat(hoursPerWeek) : undefined,
      roleOnProject,
      allocationType,
      allocationPercentage:
        allocationPercentage !== undefined
          ? parseFloat(allocationPercentage)
          : undefined,
      allowOverAllocation,
      monthlyAllocations: monthlyAllocations?.map(
        (ma: { month: string; allocationPercentage: number }) => ({
          month: new Date(ma.month),
          allocationPercentage: ma.allocationPercentage,
        })
      ),
    });

    res.json(assignment);
  } catch (error) {
    next(error);
  }
};

export const deleteStaffAssignment = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    await staffService.deleteStaffAssignment(id);
    res.json({ message: 'Staff assignment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Allocation & Availability Endpoints
// ============================================================================

export const getStaffAllocation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      throw new AppError('start_date and end_date are required', 400);
    }

    const allocation = await staffService.getStaffAllocationInPeriod(
      id,
      new Date(start_date as string),
      new Date(end_date as string)
    );

    res.json(allocation);
  } catch (error) {
    next(error);
  }
};

export const getStaffAvailabilityForecast = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId } = req.user!;
    const { staff_role_id, start_date, end_date } = req.query;

    const forecast = await staffService.getStaffAvailabilityForecast(
      companyId,
      {
        staffRoleId: staff_role_id as string | undefined,
        startDate: start_date ? new Date(start_date as string) : undefined,
        endDate: end_date ? new Date(end_date as string) : undefined,
      }
    );

    res.json(forecast);
  } catch (error) {
    next(error);
  }
};

export const detectOverAllocations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      throw new AppError('start_date and end_date are required', 400);
    }

    const result = await staffService.detectOverAllocations(
      id,
      new Date(start_date as string),
      new Date(end_date as string)
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const validateAssignmentAllocation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      staffMemberId,
      startDate,
      endDate,
      allocationPercentage,
      excludeAssignmentId,
    } = req.body;

    if (
      !staffMemberId ||
      !startDate ||
      !endDate ||
      allocationPercentage === undefined
    ) {
      throw new AppError(
        'staffMemberId, startDate, endDate, and allocationPercentage are required',
        400
      );
    }

    const result = await staffService.validateAssignmentAllocation(
      staffMemberId,
      new Date(startDate),
      new Date(endDate),
      parseFloat(allocationPercentage),
      excludeAssignmentId
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// CSV Import Endpoint
// ============================================================================

export const importStaffFromCSV = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId } = req.user!;
    const { csvContent, defaultRoleId, updateExisting } = req.body;

    if (!csvContent) {
      throw new AppError('csvContent is required', 400);
    }

    const result = await staffService.importStaffFromCSV(companyId, csvContent, {
      defaultRoleId,
      updateExisting: updateExisting === true,
    });

    res.json({
      message: `Import complete: ${result.imported} imported, ${result.updated} updated`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
