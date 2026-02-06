/**
 * Staff Service Tests
 *
 * Comprehensive tests for staff management functionality including:
 * - Staff Role CRUD
 * - Staff Member CRUD
 * - Staff Assignment management
 * - Allocation calculations
 * - Availability forecasting
 * - Over-allocation detection
 * - CSV import
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StaffService } from '../../src/services/staffService.js';
import {
  createTestCompany,
  createTestUser,
  createTestProject,
  cleanupTestData,
} from '../helpers/testUtils.js';

describe('StaffService', () => {
  let staffService: StaffService;
  let testCompanyId: string;
  let testUserId: string;
  let testProjectId: string;

  beforeEach(async () => {
    staffService = new StaffService();

    // Create test company
    const company = await createTestCompany('Test Construction Co');
    testCompanyId = company.id;

    // Create test user
    const user = await createTestUser(testCompanyId, {
      email: `staff-test-${Date.now()}@test.com`,
      firstName: 'Test',
      lastName: 'User',
    });
    testUserId = user.id;

    // Create test project
    const project = await createTestProject(testCompanyId, testUserId, {
      name: 'Staff Test Project',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    });
    testProjectId = project.id;
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  // ==========================================================================
  // Staff Role Tests
  // ==========================================================================

  describe('Staff Role CRUD', () => {
    it('should create a staff role', async () => {
      const role = await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Project Manager',
        description: 'Manages construction projects',
        hourlyCost: 75.0,
        defaultBillableRate: 125.0,
        isActive: true,
      });

      expect(role).toBeDefined();
      expect(role.name).toBe('Project Manager');
      expect(Number(role.hourlyCost)).toBe(75.0);
      expect(Number(role.defaultBillableRate)).toBe(125.0);
      expect(role.isActive).toBe(true);
    });

    it('should get all staff roles for a company', async () => {
      // Create multiple roles
      await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Project Manager',
        hourlyCost: 75.0,
      });
      await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Site Superintendent',
        hourlyCost: 65.0,
      });
      await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Estimator',
        hourlyCost: 55.0,
        isActive: false,
      });

      const allRoles = await staffService.getStaffRoles(testCompanyId);
      expect(allRoles.length).toBe(3);

      const activeRoles = await staffService.getStaffRoles(testCompanyId, {
        activeOnly: true,
      });
      expect(activeRoles.length).toBe(2);
    });

    it('should update a staff role', async () => {
      const role = await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Project Manager',
        hourlyCost: 75.0,
      });

      const updatedRole = await staffService.updateStaffRole(role.id, {
        hourlyCost: 85.0,
        defaultBillableRate: 140.0,
      });

      expect(Number(updatedRole.hourlyCost)).toBe(85.0);
      expect(Number(updatedRole.defaultBillableRate)).toBe(140.0);
    });

    it('should delete a staff role without staff members', async () => {
      const role = await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Project Manager',
        hourlyCost: 75.0,
      });

      await staffService.deleteStaffRole(role.id);

      const deletedRole = await staffService.getStaffRoleById(role.id);
      expect(deletedRole).toBeNull();
    });

    it('should not delete a staff role with assigned staff members', async () => {
      const role = await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Project Manager',
        hourlyCost: 75.0,
      });

      await staffService.createStaffMember({
        companyId: testCompanyId,
        staffRoleId: role.id,
        firstName: 'John',
        lastName: 'Doe',
        role: 'Project Manager',
      });

      await expect(staffService.deleteStaffRole(role.id)).rejects.toThrow(
        /Cannot delete role/
      );
    });
  });

  // ==========================================================================
  // Staff Member Tests
  // ==========================================================================

  describe('Staff Member CRUD', () => {
    it('should create a staff member', async () => {
      const role = await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Project Manager',
        hourlyCost: 75.0,
      });

      const staffMember = await staffService.createStaffMember({
        companyId: testCompanyId,
        staffRoleId: role.id,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        role: 'Project Manager',
        certifications: ['PMP', 'LEED AP'],
        skills: ['scheduling', 'budgeting', 'team leadership'],
        internalHourlyCost: 70.0,
        availabilityStart: new Date('2026-01-01'),
        availabilityEnd: new Date('2026-12-31'),
      });

      expect(staffMember).toBeDefined();
      expect(staffMember.firstName).toBe('John');
      expect(staffMember.lastName).toBe('Doe');
      expect(staffMember.certifications).toContain('PMP');
      expect(staffMember.skills).toContain('scheduling');
    });

    it('should get staff members with filters', async () => {
      const role1 = await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Project Manager',
        hourlyCost: 75.0,
      });
      const role2 = await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Estimator',
        hourlyCost: 55.0,
      });

      await staffService.createStaffMember({
        companyId: testCompanyId,
        staffRoleId: role1.id,
        firstName: 'John',
        lastName: 'Doe',
        role: 'Project Manager',
        skills: ['scheduling'],
      });
      await staffService.createStaffMember({
        companyId: testCompanyId,
        staffRoleId: role2.id,
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'Estimator',
        skills: ['estimating', 'takeoffs'],
      });

      // Filter by role
      const pmStaff = await staffService.getStaffMembers(testCompanyId, {
        staffRoleId: role1.id,
      });
      expect(pmStaff.length).toBe(1);
      expect(pmStaff[0].firstName).toBe('John');

      // Filter by skills
      const estimatingStaff = await staffService.getStaffMembers(testCompanyId, {
        skills: ['estimating'],
      });
      expect(estimatingStaff.length).toBe(1);
      expect(estimatingStaff[0].firstName).toBe('Jane');
    });

    it('should update a staff member', async () => {
      const staffMember = await staffService.createStaffMember({
        companyId: testCompanyId,
        firstName: 'John',
        lastName: 'Doe',
        role: 'Project Manager',
      });

      const updated = await staffService.updateStaffMember(staffMember.id, {
        skills: ['scheduling', 'budgeting'],
        internalHourlyCost: 80.0,
      });

      expect(updated.skills).toContain('scheduling');
      expect(Number(updated.internalHourlyCost)).toBe(80.0);
    });

    it('should delete a staff member without active assignments', async () => {
      const staffMember = await staffService.createStaffMember({
        companyId: testCompanyId,
        firstName: 'John',
        lastName: 'Doe',
        role: 'Project Manager',
      });

      await staffService.deleteStaffMember(staffMember.id);

      const deleted = await staffService.getStaffMemberById(staffMember.id);
      expect(deleted).toBeNull();
    });
  });

  // ==========================================================================
  // Staff Assignment Tests
  // ==========================================================================

  describe('Staff Assignment Management', () => {
    let staffMemberId: string;

    beforeEach(async () => {
      const staffMember = await staffService.createStaffMember({
        companyId: testCompanyId,
        firstName: 'John',
        lastName: 'Doe',
        role: 'Project Manager',
        internalHourlyCost: 70.0,
      });
      staffMemberId = staffMember.id;
    });

    it('should create a staff assignment', async () => {
      const assignment = await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
        roleOnProject: 'Project Manager',
        allocationType: 'full',
        allocationPercentage: 100,
      });

      expect(assignment).toBeDefined();
      expect(assignment.staffMemberId).toBe(staffMemberId);
      expect(assignment.projectId).toBe(testProjectId);
      expect(Number(assignment.hoursPerWeek)).toBe(40);
    });

    it('should create a partial allocation assignment', async () => {
      const assignment = await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
        allocationType: 'percentage_total',
        allocationPercentage: 50,
      });

      expect(assignment.allocationType).toBe('percentage_total');
      expect(Number(assignment.allocationPercentage)).toBe(50);
    });

    it('should get assignments by staff member', async () => {
      await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
      });

      const assignments = await staffService.getStaffAssignments({
        staffMemberId,
      });

      expect(assignments.length).toBe(1);
      expect(assignments[0].staffMemberId).toBe(staffMemberId);
    });

    it('should update a staff assignment', async () => {
      const assignment = await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
      });

      const updated = await staffService.updateStaffAssignment(assignment.id, {
        hoursPerWeek: 32,
        allocationPercentage: 80,
      });

      expect(Number(updated.hoursPerWeek)).toBe(32);
      expect(Number(updated.allocationPercentage)).toBe(80);
    });

    it('should delete a staff assignment', async () => {
      const assignment = await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
      });

      await staffService.deleteStaffAssignment(assignment.id);

      const deleted = await staffService.getStaffAssignmentById(assignment.id);
      expect(deleted).toBeNull();
    });
  });

  // ==========================================================================
  // Allocation Calculation Tests
  // ==========================================================================

  describe('Allocation Calculations', () => {
    let staffMemberId: string;

    beforeEach(async () => {
      const staffMember = await staffService.createStaffMember({
        companyId: testCompanyId,
        firstName: 'John',
        lastName: 'Doe',
        role: 'Project Manager',
      });
      staffMemberId = staffMember.id;
    });

    it('should calculate allocation for a period with no assignments', async () => {
      const allocation = await staffService.getStaffAllocationInPeriod(
        staffMemberId,
        new Date('2026-01-01'),
        new Date('2026-03-31')
      );

      expect(allocation.totalAllocation).toBe(0);
      expect(allocation.availableAllocation).toBe(100);
      expect(allocation.assignments.length).toBe(0);
    });

    it('should calculate allocation for a period with full assignment', async () => {
      await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
        allocationType: 'full',
        allocationPercentage: 100,
      });

      const allocation = await staffService.getStaffAllocationInPeriod(
        staffMemberId,
        new Date('2026-02-01'),
        new Date('2026-03-31')
      );

      expect(allocation.totalAllocation).toBe(100);
      expect(allocation.availableAllocation).toBe(0);
      expect(allocation.assignments.length).toBe(1);
    });

    it('should calculate allocation for a period with partial assignment', async () => {
      await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
        allocationType: 'percentage_total',
        allocationPercentage: 50,
      });

      const allocation = await staffService.getStaffAllocationInPeriod(
        staffMemberId,
        new Date('2026-02-01'),
        new Date('2026-03-31')
      );

      expect(allocation.totalAllocation).toBe(50);
      expect(allocation.availableAllocation).toBe(50);
    });

    it('should calculate allocation with multiple overlapping assignments', async () => {
      // Create second project
      const project2 = await createTestProject(testCompanyId, testUserId, {
        name: 'Second Project',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
        allocationType: 'percentage_total',
        allocationPercentage: 60,
      });

      await staffService.createStaffAssignment({
        staffMemberId,
        projectId: project2.id,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-09-30'),
        hoursPerWeek: 40,
        allocationType: 'percentage_total',
        allocationPercentage: 50,
      });

      const allocation = await staffService.getStaffAllocationInPeriod(
        staffMemberId,
        new Date('2026-04-01'),
        new Date('2026-05-31')
      );

      // Both assignments overlap: 60% + 50% = 110%
      expect(allocation.rawTotalAllocation).toBe(110);
      expect(allocation.totalAllocation).toBe(100); // Capped at 100
      expect(allocation.availableAllocation).toBe(0);
      expect(allocation.assignments.length).toBe(2);
    });
  });

  // ==========================================================================
  // Availability Forecast Tests
  // ==========================================================================

  describe('Availability Forecasting', () => {
    it('should return available staff when no assignments exist', async () => {
      const role = await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Project Manager',
        hourlyCost: 75.0,
      });

      await staffService.createStaffMember({
        companyId: testCompanyId,
        staffRoleId: role.id,
        firstName: 'John',
        lastName: 'Doe',
        role: 'Project Manager',
      });

      const forecast = await staffService.getStaffAvailabilityForecast(
        testCompanyId,
        {
          staffRoleId: role.id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-03-31'),
        }
      );

      expect(forecast.available.length).toBe(1);
      expect(forecast.available[0].availabilityStatus).toBe('available');
      expect(forecast.available[0].availableAllocation).toBe(100);
    });

    it('should categorize staff by availability status', async () => {
      const role = await staffService.createStaffRole({
        companyId: testCompanyId,
        name: 'Project Manager',
        hourlyCost: 75.0,
      });

      // Create fully available staff
      const _staff1 = await staffService.createStaffMember({
        companyId: testCompanyId,
        staffRoleId: role.id,
        firstName: 'John',
        lastName: 'Available',
        role: 'Project Manager',
      });

      // Create partially available staff
      const staff2 = await staffService.createStaffMember({
        companyId: testCompanyId,
        staffRoleId: role.id,
        firstName: 'Jane',
        lastName: 'Partial',
        role: 'Project Manager',
      });

      // Create fully allocated staff
      const staff3 = await staffService.createStaffMember({
        companyId: testCompanyId,
        staffRoleId: role.id,
        firstName: 'Bob',
        lastName: 'Busy',
        role: 'Project Manager',
      });

      // Assign staff2 at 50%
      await staffService.createStaffAssignment({
        staffMemberId: staff2.id,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
        allocationType: 'percentage_total',
        allocationPercentage: 50,
      });

      // Assign staff3 at 100%
      await staffService.createStaffAssignment({
        staffMemberId: staff3.id,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
        allocationType: 'full',
        allocationPercentage: 100,
      });

      const forecast = await staffService.getStaffAvailabilityForecast(
        testCompanyId,
        {
          staffRoleId: role.id,
          startDate: new Date('2026-02-01'),
          endDate: new Date('2026-03-31'),
        }
      );

      expect(forecast.available.length).toBe(1);
      expect(forecast.partiallyAvailable.length).toBe(1);
      expect(forecast.unavailable.length).toBe(1);

      expect(forecast.summary.availableCount).toBe(1);
      expect(forecast.summary.partialCount).toBe(1);
      expect(forecast.summary.unavailableCount).toBe(1);
    });
  });

  // ==========================================================================
  // Over-Allocation Detection Tests
  // ==========================================================================

  describe('Over-Allocation Detection', () => {
    let staffMemberId: string;

    beforeEach(async () => {
      const staffMember = await staffService.createStaffMember({
        companyId: testCompanyId,
        firstName: 'John',
        lastName: 'Doe',
        role: 'Project Manager',
      });
      staffMemberId = staffMember.id;
    });

    it('should detect no conflicts when allocation is under 100%', async () => {
      await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
        allocationType: 'percentage_total',
        allocationPercentage: 80,
      });

      const result = await staffService.detectOverAllocations(
        staffMemberId,
        new Date('2026-01-01'),
        new Date('2026-06-30')
      );

      expect(result.hasConflicts).toBe(false);
      expect(result.overallSeverity).toBe('none');
      expect(result.overAllocatedPeriods.length).toBe(0);
    });

    it('should detect over-allocation when total exceeds 100%', async () => {
      // Create second project
      const project2 = await createTestProject(testCompanyId, testUserId, {
        name: 'Second Project',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
        allocationType: 'percentage_total',
        allocationPercentage: 70,
      });

      await staffService.createStaffAssignment({
        staffMemberId,
        projectId: project2.id,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-09-30'),
        hoursPerWeek: 40,
        allocationType: 'percentage_total',
        allocationPercentage: 50,
      });

      const result = await staffService.detectOverAllocations(
        staffMemberId,
        new Date('2026-01-01'),
        new Date('2026-09-30')
      );

      expect(result.hasConflicts).toBe(true);
      expect(result.overAllocatedPeriods.length).toBeGreaterThan(0);

      // Check that over-allocated periods are in the overlap range (March-June)
      const overAllocatedMonths = result.overAllocatedPeriods.map((p) => p.month);
      expect(overAllocatedMonths).toContain('2026-03');
      expect(overAllocatedMonths).toContain('2026-04');
    });

    it('should validate assignment allocation before creation', async () => {
      await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
        allocationType: 'percentage_total',
        allocationPercentage: 80,
      });

      // Validate a new assignment that would cause over-allocation
      const validation = await staffService.validateAssignmentAllocation(
        staffMemberId,
        new Date('2026-03-01'),
        new Date('2026-09-30'),
        50 // This would make total 130%
      );

      expect(validation.isValid).toBe(false);
      expect(validation.conflicts.length).toBeGreaterThan(0);
      expect(validation.message).toContain('over-allocation');
    });

    it('should validate assignment that fits within available capacity', async () => {
      await staffService.createStaffAssignment({
        staffMemberId,
        projectId: testProjectId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
        hoursPerWeek: 40,
        allocationType: 'percentage_total',
        allocationPercentage: 50,
      });

      // Validate a new assignment that fits
      const validation = await staffService.validateAssignmentAllocation(
        staffMemberId,
        new Date('2026-03-01'),
        new Date('2026-09-30'),
        40 // This would make total 90%
      );

      expect(validation.isValid).toBe(true);
      expect(validation.conflicts.length).toBe(0);
    });
  });

  // ==========================================================================
  // CSV Import Tests
  // ==========================================================================

  describe('CSV Import', () => {
    it('should import staff from CSV', async () => {
      const csvContent = `firstName,lastName,email,role,skills
John,Doe,john.doe@test.com,Project Manager,"scheduling,budgeting"
Jane,Smith,jane.smith@test.com,Estimator,"estimating,takeoffs"
Bob,Johnson,bob.johnson@test.com,Superintendent,"field management"`;

      const result = await staffService.importStaffFromCSV(
        testCompanyId,
        csvContent
      );

      expect(result.imported).toBe(3);
      expect(result.errors.length).toBe(0);

      const staffMembers = await staffService.getStaffMembers(testCompanyId);
      expect(staffMembers.length).toBe(3);
    });

    it('should handle CSV import errors gracefully', async () => {
      const csvContent = `firstName,lastName,email,role
John,,john.doe@test.com,Project Manager
,Smith,jane.smith@test.com,Estimator
Bob,Johnson,bob.johnson@test.com,Superintendent`;

      const result = await staffService.importStaffFromCSV(
        testCompanyId,
        csvContent
      );

      expect(result.imported).toBe(1); // Only Bob Johnson should import
      expect(result.errors.length).toBe(2); // John and Jane have missing fields
    });

    it('should update existing staff when updateExisting is true', async () => {
      // Create existing staff member
      await staffService.createStaffMember({
        companyId: testCompanyId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        role: 'Junior PM',
      });

      const csvContent = `firstName,lastName,email,role
John,Doe,john.doe@test.com,Senior Project Manager`;

      const result = await staffService.importStaffFromCSV(
        testCompanyId,
        csvContent,
        { updateExisting: true }
      );

      expect(result.updated).toBe(1);
      expect(result.imported).toBe(0);

      const staffMembers = await staffService.getStaffMembers(testCompanyId);
      expect(staffMembers.length).toBe(1);
      expect(staffMembers[0].role).toBe('Senior Project Manager');
    });
  });
});
