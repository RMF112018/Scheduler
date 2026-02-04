/**
 * Staff Routes
 *
 * API routes for staff management including:
 * - Staff Roles (position/title management)
 * - Staff Members (employee management)
 * - Staff Assignments (project allocations)
 * - Availability and allocation queries
 * - CSV Import
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as staffController from '../controllers/staffController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================================================
// Staff Role Routes
// ============================================================================

/**
 * @route   GET /api/staff/roles
 * @desc    Get all staff roles for the company
 * @query   active_only - Filter to active roles only
 * @access  Private
 */
router.get('/roles', staffController.getStaffRoles);

/**
 * @route   POST /api/staff/roles
 * @desc    Create a new staff role
 * @body    { name, description?, hourlyCost, defaultBillableRate?, isActive? }
 * @access  Private
 */
router.post('/roles', staffController.createStaffRole);

/**
 * @route   GET /api/staff/roles/:id
 * @desc    Get a specific staff role by ID
 * @access  Private
 */
router.get('/roles/:id', staffController.getStaffRoleById);

/**
 * @route   PUT /api/staff/roles/:id
 * @desc    Update a staff role
 * @body    { name?, description?, hourlyCost?, defaultBillableRate?, isActive? }
 * @access  Private
 */
router.put('/roles/:id', staffController.updateStaffRole);

/**
 * @route   DELETE /api/staff/roles/:id
 * @desc    Delete a staff role
 * @access  Private
 */
router.delete('/roles/:id', staffController.deleteStaffRole);

// ============================================================================
// Staff Member Routes
// ============================================================================

/**
 * @route   GET /api/staff/members
 * @desc    Get all staff members for the company
 * @query   staff_role_id - Filter by staff role
 * @query   active_only - Filter to active members only
 * @query   available_from - Filter by availability start date
 * @query   available_to - Filter by availability end date
 * @query   skills - Comma-separated list of skills to filter by
 * @access  Private
 */
router.get('/members', staffController.getStaffMembers);

/**
 * @route   POST /api/staff/members
 * @desc    Create a new staff member
 * @body    { firstName, lastName, role, staffRoleId?, email?, certifications?, skills?, internalHourlyCost?, availabilityStart?, availabilityEnd?, isActive?, metadata? }
 * @access  Private
 */
router.post('/members', staffController.createStaffMember);

/**
 * @route   GET /api/staff/members/:id
 * @desc    Get a specific staff member by ID
 * @access  Private
 */
router.get('/members/:id', staffController.getStaffMemberById);

/**
 * @route   PUT /api/staff/members/:id
 * @desc    Update a staff member
 * @body    { firstName?, lastName?, role?, staffRoleId?, email?, certifications?, skills?, internalHourlyCost?, availabilityStart?, availabilityEnd?, isActive?, metadata? }
 * @access  Private
 */
router.put('/members/:id', staffController.updateStaffMember);

/**
 * @route   DELETE /api/staff/members/:id
 * @desc    Delete a staff member
 * @access  Private
 */
router.delete('/members/:id', staffController.deleteStaffMember);

/**
 * @route   GET /api/staff/members/:id/allocation
 * @desc    Get allocation info for a staff member in a period
 * @query   start_date - Period start date (required)
 * @query   end_date - Period end date (required)
 * @access  Private
 */
router.get('/members/:id/allocation', staffController.getStaffAllocation);

/**
 * @route   GET /api/staff/members/:id/over-allocations
 * @desc    Detect over-allocation conflicts for a staff member
 * @query   start_date - Period start date (required)
 * @query   end_date - Period end date (required)
 * @access  Private
 */
router.get('/members/:id/over-allocations', staffController.detectOverAllocations);

// ============================================================================
// Staff Assignment Routes
// ============================================================================

/**
 * @route   GET /api/staff/assignments
 * @desc    Get staff assignments
 * @query   staff_member_id - Filter by staff member
 * @query   project_id - Filter by project
 * @query   start_date - Filter by date range start
 * @query   end_date - Filter by date range end
 * @access  Private
 */
router.get('/assignments', staffController.getStaffAssignments);

/**
 * @route   POST /api/staff/assignments
 * @desc    Create a new staff assignment
 * @body    { staffMemberId, projectId, startDate, endDate, hoursPerWeek?, roleOnProject?, allocationType?, allocationPercentage?, allowOverAllocation?, monthlyAllocations? }
 * @access  Private
 */
router.post('/assignments', staffController.createStaffAssignment);

/**
 * @route   GET /api/staff/assignments/:id
 * @desc    Get a specific staff assignment by ID
 * @access  Private
 */
router.get('/assignments/:id', staffController.getStaffAssignmentById);

/**
 * @route   PUT /api/staff/assignments/:id
 * @desc    Update a staff assignment
 * @body    { startDate?, endDate?, hoursPerWeek?, roleOnProject?, allocationType?, allocationPercentage?, allowOverAllocation?, monthlyAllocations? }
 * @access  Private
 */
router.put('/assignments/:id', staffController.updateStaffAssignment);

/**
 * @route   DELETE /api/staff/assignments/:id
 * @desc    Delete a staff assignment
 * @access  Private
 */
router.delete('/assignments/:id', staffController.deleteStaffAssignment);

/**
 * @route   POST /api/staff/assignments/validate
 * @desc    Pre-validate a proposed assignment for over-allocation conflicts
 * @body    { staffMemberId, startDate, endDate, allocationPercentage, excludeAssignmentId? }
 * @access  Private
 */
router.post('/assignments/validate', staffController.validateAssignmentAllocation);

// ============================================================================
// Availability & Forecasting Routes
// ============================================================================

/**
 * @route   GET /api/staff/availability
 * @desc    Get staff availability forecast
 * @query   staff_role_id - Filter by staff role
 * @query   start_date - Period start date (defaults to today)
 * @query   end_date - Period end date (defaults to 90 days from start)
 * @access  Private
 */
router.get('/availability', staffController.getStaffAvailabilityForecast);

// ============================================================================
// Import Routes
// ============================================================================

/**
 * @route   POST /api/staff/import
 * @desc    Import staff members from CSV
 * @body    { csvContent, defaultRoleId?, updateExisting? }
 * @access  Private
 */
router.post('/import', staffController.importStaffFromCSV);

export default router;
