/**
 * User Management Service
 *
 * Phase 11: Admin-only user management with role assignment and bulk import.
 * All new users are assigned "New User" role by default.
 * Publishes events for all user/role/permission changes.
 */

import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { permissionService } from './permissionService.js';
import { eventBus } from './eventBus.js';
import { parse } from 'csv-parse/sync';
import bcrypt from 'bcryptjs';
import type {
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  RoleAssignedEvent,
  RoleRemovedEvent,
} from '../../../shared/src/events.js';

// ============================================================================
// Types
// ============================================================================

export interface CreateUserInput {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  companyId: string;
  roleId?: string; // Optional: if not provided, assigns "New User" role
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
}

export interface UserSearchFilters {
  companyId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roleId?: string;
  projectId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedUsers {
  users: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ImportResult {
  imported: number;
  updated: number;
  errors: Array<{ row: number; error: string }>;
}

// ============================================================================
// User Management Service
// ============================================================================

export class UserManagementService {
  /**
   * Create user (assigns "New User" role by default)
   */
  async createUser(data: CreateUserInput, createdBy: string): Promise<any> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestError('Email already registered');
    }

    // Hash password (generate random if not provided)
    const password = data.password || this._generateRandomPassword();
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        companyId: data.companyId,
        role: 'user', // Legacy field
      },
    });

    // Get "New User" role (or use provided roleId)
    let roleId = data.roleId;
    if (!roleId) {
      const newUserRole = await prisma.role.findUnique({
        where: { name: 'new_user' },
      });
      if (!newUserRole) {
        logger.warn('"New User" role not found, skipping role assignment');
      } else {
        roleId = newUserRole.id;
      }
    }

    // Assign role
    if (roleId) {
      await permissionService.assignRole(user.id, roleId, null, createdBy);

      // Publish RoleAssigned event
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (role) {
        await eventBus.publish({
          type: 'role.assigned',
          entityId: user.id,
          entityType: 'User',
          userId: createdBy,
          companyId: data.companyId,
          timestamp: new Date(),
          roleId,
          roleName: role.name,
          projectId: null,
        } as RoleAssignedEvent);
      }
    }

    // Publish UserCreated event
    await eventBus.publish({
      type: 'user.created',
      entityId: user.id,
      entityType: 'User',
      userId: createdBy,
      companyId: data.companyId,
      timestamp: new Date(),
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
      defaultRoleId: roleId,
    } as UserCreatedEvent);

    return {
      ...user,
      password: data.password ? undefined : password, // Return generated password if not provided
    };
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: UpdateUserInput, updatedBy: string): Promise<any> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const changes: Record<string, { old: unknown; new: unknown }> = {};

    // Track changes
    if (updates.email && updates.email !== user.email) {
      changes.email = { old: user.email, new: updates.email };
    }
    if (updates.firstName && updates.firstName !== user.firstName) {
      changes.firstName = { old: user.firstName, new: updates.firstName };
    }
    if (updates.lastName && updates.lastName !== user.lastName) {
      changes.lastName = { old: user.lastName, new: updates.lastName };
    }

    // Hash password if provided
    let passwordHash = user.passwordHash;
    if (updates.password) {
      passwordHash = await bcrypt.hash(updates.password, 12);
      changes.password = { old: '[REDACTED]', new: '[REDACTED]' };
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(updates.email && { email: updates.email.toLowerCase() }),
        ...(updates.firstName && { firstName: updates.firstName }),
        ...(updates.lastName && { lastName: updates.lastName }),
        ...(updates.password && { passwordHash }),
      },
    });

    // Publish UserUpdated event
    if (Object.keys(changes).length > 0) {
      await eventBus.publish({
        type: 'user.updated',
        entityId: userId,
        entityType: 'User',
        userId: updatedBy,
        companyId: user.companyId,
        timestamp: new Date(),
        changes,
      } as UserUpdatedEvent);
    }

    return updatedUser;
  }

  /**
   * Delete user (soft delete by setting inactive flag, or hard delete)
   */
  async deleteUser(userId: string, deletedBy: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Hard delete (cascade will handle related records)
    await prisma.user.delete({ where: { id: userId } });

    // Publish UserDeleted event
    await eventBus.publish({
      type: 'user.deleted',
      entityId: userId,
      entityType: 'User',
      userId: deletedBy,
      companyId: user.companyId,
      timestamp: new Date(),
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
    } as UserDeletedEvent);
  }

  /**
   * Search users with filters
   */
  async searchUsers(filters: UserSearchFilters): Promise<PaginatedUsers> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      companyId: filters.companyId,
    };

    if (filters.email) {
      where.email = { contains: filters.email, mode: 'insensitive' };
    }
    if (filters.firstName) {
      where.firstName = { contains: filters.firstName, mode: 'insensitive' };
    }
    if (filters.lastName) {
      where.lastName = { contains: filters.lastName, mode: 'insensitive' };
    }

    // Filter by role
    if (filters.roleId) {
      where.userRoles = {
        some: {
          roleId: filters.roleId,
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
        },
      };
    }

    // Filter by project
    if (filters.projectId && !filters.roleId) {
      where.userRoles = {
        some: {
          projectId: filters.projectId,
        },
      };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          userRoles: {
            include: {
              role: true,
              project: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        companyId: u.companyId,
        roles: u.userRoles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          description: ur.role.description,
          projectId: ur.projectId,
          projectName: ur.project?.name,
        })),
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Bulk import users from CSV
   */
  async importUsersFromCSV(
    csvContent: string,
    companyId: string,
    importedBy: string
  ): Promise<ImportResult> {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let imported = 0;
    let updated = 0;
    const errors: Array<{ row: number; error: string }> = [];

    // Get "New User" role
    const newUserRole = await prisma.role.findUnique({
      where: { name: 'new_user' },
    });

    if (!newUserRole) {
      throw new BadRequestError('"New User" role not found. Please seed roles first.');
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNum = i + 2; // Account for header row

      try {
        // Validate required fields
        if (!record.email || !record.firstName || !record.lastName) {
          errors.push({
            row: rowNum,
            error: 'Missing required fields: email, firstName, lastName',
          });
          continue;
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: record.email.toLowerCase() },
        });

        if (existingUser) {
          // Update existing user
          await this.updateUser(
            existingUser.id,
            {
              firstName: record.firstName,
              lastName: record.lastName,
              ...(record.password && { password: record.password }),
            },
            importedBy
          );
          updated++;
        } else {
          // Create new user
          const password = record.password || this._generateRandomPassword();
          await this.createUser(
            {
              email: record.email,
              password,
              firstName: record.firstName,
              lastName: record.lastName,
              companyId,
              roleId: newUserRole.id, // Assign "New User" role
            },
            importedBy
          );
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

  /**
   * Assign role to user
   */
  async assignRoleToUser(
    userId: string,
    roleId: string,
    projectId: string | null,
    assignedBy: string
  ): Promise<any> {
    const userRole = await permissionService.assignRole(userId, roleId, projectId, assignedBy);

      // Get user for companyId
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Publish RoleAssigned event
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (role) {
        await eventBus.publish({
          type: 'role.assigned',
          entityId: userId,
          entityType: 'User',
          userId: assignedBy,
          companyId: user.companyId,
          timestamp: new Date(),
          roleId,
          roleName: role.name,
          projectId,
        } as RoleAssignedEvent);
      }

      return userRole;
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(
    userId: string,
    roleId: string,
    projectId: string | null,
    removedBy: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await permissionService.removeRole(userId, roleId, projectId || undefined);

    // Publish RoleRemoved event
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (role) {
      await eventBus.publish({
        type: 'role.removed',
        entityId: userId,
        entityType: 'User',
        userId: removedBy,
        companyId: user.companyId,
        timestamp: new Date(),
        roleId,
        roleName: role.name,
        projectId,
      } as RoleRemovedEvent);
    }
  }

  /**
   * Assign user to project with role
   */
  async assignUserToProject(
    userId: string,
    projectId: string,
    roleId: string,
    assignedBy: string
  ): Promise<void> {
    await this.assignRoleToUser(userId, roleId, projectId, assignedBy);
  }

  /**
   * Generate random password
   */
  private _generateRandomPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}

// Export singleton instance
export const userManagementService = new UserManagementService();
