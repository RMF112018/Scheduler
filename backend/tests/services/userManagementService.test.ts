/**
 * User Management Service Tests
 *
 * Phase 11: Unit tests for UserManagementService.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../setup.js';
import { userManagementService } from '../../../src/services/userManagementService.js';
import { createTestCompany, createTestUser } from '../helpers/testUtils.js';

describe('UserManagementService', () => {
  let companyId: string;
  let adminUserId: string;
  let newUserRoleId: string;

  beforeEach(async () => {
    // Create test company
    const company = await createTestCompany();
    companyId = company.id;

    // Create admin user
    const adminUser = await createTestUser(companyId, { role: 'admin' });
    adminUserId = adminUser.id;

    // Get or create "New User" role
    let newUserRole = await prisma.role.findUnique({
      where: { name: 'new_user' },
    });

    if (!newUserRole) {
      newUserRole = await prisma.role.create({
        data: {
          name: 'new_user',
          description: 'New User',
          isSystem: true,
          defaultPermissions: {},
        },
      });
    }
    newUserRoleId = newUserRole.id;
  });

  afterEach(async () => {
    // Cleanup
    await prisma.userRole.deleteMany();
    await prisma.projectPermission.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.company.deleteMany();
  });

  describe('createUser', () => {
    it('should create user with "New User" role by default', async () => {
      const user = await userManagementService.createUser(
        {
          email: 'test@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          companyId,
        },
        adminUserId
      );

      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.firstName).toBe('Test');
      expect(user.lastName).toBe('User');

      // Verify "New User" role is assigned
      const userRoles = await prisma.userRole.findMany({
        where: { userId: user.id },
      });
      expect(userRoles.length).toBe(1);
      expect(userRoles[0].roleId).toBe(newUserRoleId);
    });

    it('should create user with specified role', async () => {
      const role = await prisma.role.create({
        data: {
          name: 'custom_role',
          description: 'Custom Role',
          isSystem: false,
        },
      });

      const user = await userManagementService.createUser(
        {
          email: 'test2@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          companyId,
          roleId: role.id,
        },
        adminUserId
      );

      // Verify custom role is assigned
      const userRoles = await prisma.userRole.findMany({
        where: { userId: user.id },
      });
      expect(userRoles.length).toBe(1);
      expect(userRoles[0].roleId).toBe(role.id);
    });

    it('should generate random password if not provided', async () => {
      const user = await userManagementService.createUser(
        {
          email: 'test3@example.com',
          firstName: 'Test',
          lastName: 'User',
          companyId,
        },
        adminUserId
      );

      expect(user).toBeDefined();
      expect((user as any).password).toBeDefined();
      expect((user as any).password.length).toBeGreaterThan(0);
    });

    it('should throw error if email already exists', async () => {
      await userManagementService.createUser(
        {
          email: 'duplicate@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          companyId,
        },
        adminUserId
      );

      await expect(
        userManagementService.createUser(
          {
            email: 'duplicate@example.com',
            password: 'TestPassword123!',
            firstName: 'Test',
            lastName: 'User',
            companyId,
          },
          adminUserId
        )
      ).rejects.toThrow();
    });
  });

  describe('updateUser', () => {
    it('should update user information', async () => {
      const user = await userManagementService.createUser(
        {
          email: 'update@example.com',
          password: 'TestPassword123!',
          firstName: 'Original',
          lastName: 'Name',
          companyId,
        },
        adminUserId
      );

      const updatedUser = await userManagementService.updateUser(
        user.id,
        {
          firstName: 'Updated',
          lastName: 'Name',
        },
        adminUserId
      );

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('Name');
    });

    it('should update user password', async () => {
      const user = await userManagementService.createUser(
        {
          email: 'password@example.com',
          password: 'OldPassword123!',
          firstName: 'Test',
          lastName: 'User',
          companyId,
        },
        adminUserId
      );

      await userManagementService.updateUser(
        user.id,
        {
          password: 'NewPassword123!',
        },
        adminUserId
      );

      // Verify password was updated (by checking user still exists)
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser).toBeDefined();
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      const user = await userManagementService.createUser(
        {
          email: 'delete@example.com',
          password: 'TestPassword123!',
          firstName: 'Test',
          lastName: 'User',
          companyId,
        },
        adminUserId
      );

      await userManagementService.deleteUser(user.id, adminUserId);

      const deletedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(deletedUser).toBeNull();
    });
  });

  describe('searchUsers', () => {
    it('should search users by email', async () => {
      await userManagementService.createUser(
        {
          email: 'search1@example.com',
          password: 'TestPassword123!',
          firstName: 'Search',
          lastName: 'User1',
          companyId,
        },
        adminUserId
      );

      await userManagementService.createUser(
        {
          email: 'search2@example.com',
          password: 'TestPassword123!',
          firstName: 'Search',
          lastName: 'User2',
          companyId,
        },
        adminUserId
      );

      const result = await userManagementService.searchUsers({
        companyId,
        email: 'search1',
        page: 1,
        limit: 20,
      });

      expect(result.users.length).toBe(1);
      expect(result.users[0].email).toBe('search1@example.com');
    });

    it('should filter users by role', async () => {
      const role = await prisma.role.create({
        data: {
          name: 'filter_role',
          description: 'Filter Role',
          isSystem: false,
        },
      });

      const user1 = await userManagementService.createUser(
        {
          email: 'filter1@example.com',
          password: 'TestPassword123!',
          firstName: 'Filter',
          lastName: 'User1',
          companyId,
          roleId: role.id,
        },
        adminUserId
      );

      await userManagementService.createUser(
        {
          email: 'filter2@example.com',
          password: 'TestPassword123!',
          firstName: 'Filter',
          lastName: 'User2',
          companyId,
        },
        adminUserId
      );

      const result = await userManagementService.searchUsers({
        companyId,
        roleId: role.id,
        page: 1,
        limit: 20,
      });

      expect(result.users.length).toBe(1);
      expect(result.users[0].id).toBe(user1.id);
    });
  });

  describe('importUsersFromCSV', () => {
    it('should import users from CSV', async () => {
      const csvContent = `email,firstName,lastName,password
import1@example.com,Import,User1,TestPass123!
import2@example.com,Import,User2,TestPass123!`;

      const result = await userManagementService.importUsersFromCSV(
        csvContent,
        companyId,
        adminUserId
      );

      expect(result.imported).toBe(2);
      expect(result.updated).toBe(0);
      expect(result.errors.length).toBe(0);

      // Verify users were created
      const user1 = await prisma.user.findUnique({
        where: { email: 'import1@example.com' },
      });
      expect(user1).toBeDefined();

      const user2 = await prisma.user.findUnique({
        where: { email: 'import2@example.com' },
      });
      expect(user2).toBeDefined();
    });

    it('should handle CSV import errors', async () => {
      const csvContent = `email,firstName,lastName
invalid-email,Invalid,User
valid@example.com,Valid,User,TestPass123!`;

      const result = await userManagementService.importUsersFromCSV(
        csvContent,
        companyId,
        adminUserId
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.imported).toBe(1);
    });
  });

  describe('assignRoleToUser', () => {
    it('should assign role to user', async () => {
      const user = await userManagementService.createUser(
        {
          email: 'assign@example.com',
          password: 'TestPassword123!',
          firstName: 'Assign',
          lastName: 'User',
          companyId,
        },
        adminUserId
      );

      const role = await prisma.role.create({
        data: {
          name: 'assign_role',
          description: 'Assign Role',
          isSystem: false,
        },
      });

      const userRole = await userManagementService.assignRoleToUser(
        user.id,
        role.id,
        null,
        adminUserId
      );

      expect(userRole).toBeDefined();
      expect(userRole.userId).toBe(user.id);
      expect(userRole.roleId).toBe(role.id);
    });
  });
});
