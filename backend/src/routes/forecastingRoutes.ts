/**
 * Forecasting Routes
 *
 * API routes for resource forecasting including:
 * - Project staffing forecasts
 * - Organization-wide forecasts
 * - Staff suggestions
 * - New hire needs analysis
 * - Staffing gaps detection
 * - Capacity analysis
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as forecastingController from '../controllers/forecastingController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Project Forecast Routes
// ============================================================================

/**
 * @route   GET /api/forecasts/projects/:projectId
 * @desc    Get staffing forecast for a specific project
 * @query   start_date - Forecast start date (optional, defaults to project start)
 * @query   end_date - Forecast end date (optional, defaults to project end)
 * @access  Private
 */
router.get('/projects/:projectId', forecastingController.getProjectForecast);

// ============================================================================
// Organization Forecast Routes
// ============================================================================

/**
 * @route   GET /api/forecasts/organization
 * @desc    Get organization-wide staffing forecast
 * @query   start_date - Forecast start date (required)
 * @query   end_date - Forecast end date (required)
 * @access  Private
 */
router.get('/organization', forecastingController.getOrganizationForecast);

// ============================================================================
// Staff Suggestions Routes
// ============================================================================

/**
 * @route   GET /api/forecasts/suggestions
 * @desc    Get staff suggestions for a role based on availability
 * @query   staff_role_id - ID of the role to fill (required)
 * @query   start_date - Start date of the role (required)
 * @query   end_date - End date of the role (required)
 * @query   allocation_percentage - Required allocation (optional, default 100)
 * @query   max_suggestions - Maximum suggestions to return (optional, default 10)
 * @access  Private
 */
router.get('/suggestions', forecastingController.getStaffSuggestions);

// ============================================================================
// New Hire Needs Routes
// ============================================================================

/**
 * @route   GET /api/forecasts/new-hire-needs
 * @desc    Identify positions requiring new hires
 * @query   staff_role_id - ID of the role to check (required)
 * @query   start_date - Start date of the requirement (required)
 * @query   end_date - End date of the requirement (required)
 * @query   required_count - Number of staff needed (optional, default 1)
 * @query   allocation_percentage - Required allocation per person (optional, default 100)
 * @access  Private
 */
router.get('/new-hire-needs', forecastingController.getNewHireNeeds);

// ============================================================================
// Staffing Gaps Routes
// ============================================================================

/**
 * @route   GET /api/forecasts/gaps
 * @desc    Detect staffing gaps
 * @query   project_id - Specific project to check (optional)
 * @query   start_date - Period start date (optional)
 * @query   end_date - Period end date (optional)
 * @access  Private
 */
router.get('/gaps', forecastingController.getStaffingGaps);

// ============================================================================
// Capacity Analysis Routes
// ============================================================================

/**
 * @route   GET /api/forecasts/capacity
 * @desc    Get capacity analysis for staff
 * @query   staff_member_id - Specific staff member (optional, all if not provided)
 * @query   start_date - Period start date (required)
 * @query   end_date - Period end date (required)
 * @access  Private
 */
router.get('/capacity', forecastingController.getCapacityAnalysis);

export default router;
