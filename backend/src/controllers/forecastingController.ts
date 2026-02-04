/**
 * Forecasting Controller
 *
 * Handles HTTP requests for resource forecasting including:
 * - Project staffing forecasts
 * - Organization-wide forecasts
 * - Staff suggestions
 * - New hire needs analysis
 * - Staffing gaps detection
 * - Capacity analysis
 */

import { Response, NextFunction } from 'express';
import { forecastingService } from '../services/forecastingService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

// ============================================================================
// Project Forecast Endpoints
// ============================================================================

export const getProjectForecast = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { projectId } = req.params;
    const { start_date, end_date } = req.query;

    const forecast = await forecastingService.calculateProjectStaffingNeeds(
      projectId,
      start_date ? new Date(start_date as string) : undefined,
      end_date ? new Date(end_date as string) : undefined
    );

    res.json(forecast);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Organization Forecast Endpoints
// ============================================================================

export const getOrganizationForecast = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId } = req.user!;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      throw new AppError('start_date and end_date are required', 400);
    }

    const forecast = await forecastingService.calculateOrganizationForecast(
      companyId,
      new Date(start_date as string),
      new Date(end_date as string)
    );

    res.json(forecast);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Staff Suggestions Endpoints
// ============================================================================

export const getStaffSuggestions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId } = req.user!;
    const {
      staff_role_id,
      start_date,
      end_date,
      allocation_percentage,
      max_suggestions,
    } = req.query;

    if (!staff_role_id || !start_date || !end_date) {
      throw new AppError(
        'staff_role_id, start_date, and end_date are required',
        400
      );
    }

    const suggestions = await forecastingService.suggestStaffForRole(
      companyId,
      staff_role_id as string,
      new Date(start_date as string),
      new Date(end_date as string),
      allocation_percentage ? parseFloat(allocation_percentage as string) : 100,
      max_suggestions ? parseInt(max_suggestions as string, 10) : 10
    );

    res.json(suggestions);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// New Hire Needs Endpoints
// ============================================================================

export const getNewHireNeeds = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId } = req.user!;
    const {
      staff_role_id,
      start_date,
      end_date,
      required_count,
      allocation_percentage,
    } = req.query;

    if (!staff_role_id || !start_date || !end_date) {
      throw new AppError(
        'staff_role_id, start_date, and end_date are required',
        400
      );
    }

    const result = await forecastingService.flagNewHireNeeds(
      companyId,
      staff_role_id as string,
      new Date(start_date as string),
      new Date(end_date as string),
      required_count ? parseInt(required_count as string, 10) : 1,
      allocation_percentage ? parseFloat(allocation_percentage as string) : 100
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Staffing Gaps Endpoints
// ============================================================================

export const getStaffingGaps = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId } = req.user!;
    const { project_id, start_date, end_date } = req.query;

    const gaps = await forecastingService.detectStaffingGaps(
      companyId,
      project_id as string | undefined,
      start_date ? new Date(start_date as string) : undefined,
      end_date ? new Date(end_date as string) : undefined
    );

    res.json({ gaps, count: gaps.length });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// Capacity Analysis Endpoints
// ============================================================================

export const getCapacityAnalysis = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId } = req.user!;
    const { staff_member_id, start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      throw new AppError('start_date and end_date are required', 400);
    }

    const analysis = await forecastingService.calculateCapacityAnalysis(
      companyId,
      (staff_member_id as string) || null,
      new Date(start_date as string),
      new Date(end_date as string)
    );

    res.json(analysis);
  } catch (error) {
    next(error);
  }
};
