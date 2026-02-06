/**
 * Permission Service Tests
 *
 * Phase 11: Unit tests for PermissionService.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../setup.js';
import { permissionService } from '../../../src/services/permissionService.js';
import { createTestCompany, createTestUser } from '../helpers/testUtils.js';

describe('PermissionService', () => {
  let companyId: string;
  let adminUserId: string;
  let regularUserId: string;
  let projectId: string;
  let roleId: string;

  beforeEach(async () => {
    // Create test company
    const company = await createTestCompany();
    companyId = company.id;

    // Create test users
    const adminUser = await createTestUser(companyId, { role: 'admin' });
    adminUserId = adminUser.id;

    const regularUser = await createTestUser(companyId, { role: 'user' });
    regularUserId = regularUser.id;

    // Create test project
    const project = await prisma.project.create({
      data: {
        companyId,
        name: 'Test Project',
        createdBy: adminUserId,
      },
    });
    projectId = project.id;

    // Create test role
    const role = await prisma.role.create({
      data: {
        name: 'test_role',
        description: 'Test Role',
        isSystem: false,
        defaultPermissions: {
          schedule: ['read', 'write'],
          activity: ['read'],
        },
      },
    });
    roleId = role.id;
  });

  afterEach(async () => {
    // Cleanup
    await prisma.userRole.deleteMany();
    await prisma.projectPermission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();
  });

  describe('hasPermission', () => {
    it('should return false for user without role', async () => {
      const hasPermission = await permissionService.hasPermission(
        regularUserId,
        'schedule',
        'read'
      );
      expect(hasPermission).toBe(false);
    });

    it('should return true for user with role that has permission', async () => {
      // Assign role to user
      await prisma.userRole.create({
        data: {
          userId: regularUserId,
          roleId,
          assignedBy: adminUserId,
        },
      });

      const hasPermission = await permissionService.hasPermission(
        regularUserId,
        'schedule',
        'read'
      );
      expect(hasPermission).toBe(true);
    });

    it('should return false for user with role that does not have permission', async () => {
      // Assign role to user
      await prisma.userRole.create({
        data: {
          userId: regularUserId,
          roleId,
          assignedBy: adminUserId,
        },
      });

      const hasPermission = await permissionService.hasPermission(
        regularUserId,
        'schedule',
        'delete'
      );
      expect(hasPermission).toBe(false);
    });

    it('should respect project-scoped permissions', async () => {
      // Assign role to user with project scope
      await prisma.userRole.create({
        data: {
          userId: regularUserId,
          roleId,
          projectId,
          assignedBy: adminUserId,
        },
      });

      const hasPermission = await permissionService.hasPermission(
        regularUserId,
        'schedule',
        'read',
        projectId
      );
      expect(hasPermission).toBe(true);
    });
  });

  describe('assignRole', () => {
    it('should assign role to user', async () => {
      const userRole = await permissionService.assignRole(
        regularUserId,
        roleId,
        null,
        adminUserId
      );

      expect(userRole).toBeDefined();
      expect(userRole.userId).toBe(regularUserId);
      expect(userRole.roleId).toBe(roleId);
      expect(userRole.projectId).toBeNull();
    });

    it('should assign project-scoped role to user', async () => {
      const userRole = await permissionService.assignRole(
        regularUserId,
        roleId,
        projectId,
        adminUserId
      );

      expect(userRole).toBeDefined();
      expect(userRole.userId).toBe(regularUserId);
      expect(userRole.roleId).toBe(roleId);
      expect(userRole.projectId).toBe(projectId);
    });

    it('should throw error if user does not exist', async () => {
      await expect(
        permissionService.assignRole('invalid-user-id', roleId, null, adminUserId)
      ).rejects.toThrow();
    });

    it('should throw error if role does not exist', async () => {
      await expect(
        permissionService.assignRole(regularUserId, 'invalid-role-id', null, adminUserId)
      ).rejects.toThrow();
    });
  });

  describe('removeRole', () => {
    it('should remove role from user', async () => {
      // Assign role first
      await permissionService.assignRole(regularUserId, roleId, null, adminUserId);

      // Remove role
      await permissionService.removeRole(regularUserId, roleId);

      // Verify role is removed
      const userRoles = await prisma.userRole.findMany({
        where: { userId: regularUserId, roleId },
      });
      expect(userRoles.length).toBe(0);
    });
  });

  describe('grantPermission', () => {
    it('should grant project-specific permission', async () => {
      const projectPerm = await permissionService.grantPermission(
        regularUserId,
        projectId,
        'schedule:write',
        true,
        adminUserId
      );

      expect(projectPerm).toBeDefined();
      expect(projectPerm.userId).toBe(regularUserId);
      expect(projectPerm.projectId).toBe(projectId);
      expect(projectPerm.permission).toBe('schedule:write');
      expect(projectPerm.granted).toBe(true);
    });

    it('should revoke project-specific permission', async () => {
      // Grant permission first
      await permissionService.grantPermission(
        regularUserId,
        projectId,
        'schedule:write',
        true,
        adminUserId
      );

      // Revoke permission
      const projectPerm = await permissionService.grantPermission(
        regularUserId,
        projectId,
        'schedule:write',
        false,
        adminUserId
      );

      expect(projectPerm.granted).toBe(false);
    });
  });

  describe('getUserRoles', () => {
    it('should return empty array for user without roles', async () => {
      const roles = await permissionService.getUserRoles(regularUserId);
      expect(roles).toEqual([]);
    });

    it('should return user roles', async () => {
      // Assign role
      await permissionService.assignRole(regularUserId, roleId, null, adminUserId);

      const roles = await permissionService.getUserRoles(regularUserId);
      expect(roles.length).toBe(1);
      expect(roles[0].id).toBe(roleId);
      expect(roles[0].name).toBe('test_role');
    });
  });

  describe('getEffectivePermissions', () => {
    it('should return permissions from role', async () => {
      // Assign role
      await permissionService.assignRole(regularUserId, roleId, null, adminUserId);

      const permissions = await permissionService.getEffectivePermissions(regularUserId);
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions.some((p) => p.resource === 'schedule' && p.action === 'read')).toBe(true);
    });

    it('should include project-specific overrides', async () => {
      // Assign role
      await permissionService.assignRole(regularUserId, roleId, projectId, adminUserId);

      // Grant project-specific permission
      await permissionService.grantPermission(
        regularUserId,
        projectId,
        'schedule:delete',
        true,
        adminUserId
      );

      const permissions = await permissionService.getEffectivePermissions(regularUserId, projectId);
      expect(permissions.some((p) => p.resource === 'schedule' && p.action === 'delete')).toBe(true);
    });
  });
});
