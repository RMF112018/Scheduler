/**
 * Permission Service
 *
 * Phase 11: Role-based permission checking and management with project scoping.
 * Handles permission checks, role assignments, and permission grants/revokes.
 * Uses Redis caching to reduce database queries.
 */

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

// ============================================================================
// Types
// ============================================================================

export interface PermissionCheck {
  resource: string;
  action: string;
  scope?: 'project' | 'company' | 'global';
}

export interface EffectivePermission {
  resource: string;
  action: string;
  scope: string;
  granted: boolean;
  source: 'role' | 'project_override' | 'user_permission';
}

// ============================================================================
// Permission Service
// ============================================================================

export class PermissionService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'permission:';

  /**
   * Check if user has permission
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    projectId?: string
  ): Promise<boolean> {
    const cacheKey = `${this.CACHE_PREFIX}${userId}:${resource}:${action}:${projectId || 'global'}`;

    // Try cache first (if Redis is available)
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null) {
        return cached === 'true';
      }
    } catch (error) {
      // Silently fall back to database if Redis is unavailable (common in tests)
      if (process.env.NODE_ENV !== 'test') {
        logger.warn('Redis cache read failed, falling back to database:', error);
      }
    }

    // Check database
    const hasPermission = await this._checkPermissionInDb(userId, resource, action, projectId);

    // Cache result (if Redis is available)
    try {
      await redis.setex(cacheKey, this.CACHE_TTL, hasPermission ? 'true' : 'false');
    } catch (error) {
      // Silently ignore cache write failures (common in tests)
      if (process.env.NODE_ENV !== 'test') {
        logger.warn('Redis cache write failed:', error);
      }
    }

    return hasPermission;
  }

  /**
   * Internal method to check permission in database
   */
  private async _checkPermissionInDb(
    userId: string,
    resource: string,
    action: string,
    projectId?: string
  ): Promise<boolean> {
    // Get user roles (project-scoped or company-wide)
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        OR: [
          { projectId: null }, // Company-wide roles
          ...(projectId ? [{ projectId }] : []), // Project-scoped roles
        ],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Check role permissions
    for (const userRole of userRoles) {
      // Check default permissions from role JSON
      if (userRole.role.defaultPermissions) {
        const defaultPerms = userRole.role.defaultPermissions as Record<string, string[]>;
        if (defaultPerms[resource]?.includes(action)) {
          return true;
        }
      }

      // Check role permissions from RolePermission table
      for (const rolePerm of userRole.role.permissions) {
        const perm = rolePerm.permission;
        if (
          (perm.resource === resource || perm.name === `${resource}:${action}`) &&
          (perm.action === action || !perm.action) &&
          (!projectId || perm.scope === 'project' || perm.scope === 'global')
        ) {
          return true;
        }
      }
    }

    // Check project-specific permission overrides
    if (projectId) {
      const projectPerm = await prisma.projectPermission.findUnique({
        where: {
          userId_projectId_permission: {
            userId,
            projectId,
            permission: `${resource}:${action}`,
          },
        },
      });

      if (projectPerm && projectPerm.granted) {
        return true;
      }
    }

    // Check direct user permissions
    const userPerms = await prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });

    for (const userPerm of userPerms) {
      const perm = userPerm.permission;
      if (
        (perm.resource === resource || perm.name === `${resource}:${action}`) &&
        (perm.action === action || !perm.action)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all roles for a user (optionally scoped to project)
   */
  async getUserRoles(userId: string, projectId?: string): Promise<any[]> {
    const where: any = { userId };
    if (projectId !== undefined) {
      where.OR = [{ projectId: null }, { projectId }];
    }

    const userRoles = await prisma.userRole.findMany({
      where,
      include: {
        role: true,
        project: projectId ? true : false,
      },
    });

    return userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
      projectId: ur.projectId,
      assignedAt: ur.assignedAt,
    }));
  }

  /**
   * Assign role to user (optionally scoped to project)
   */
  async assignRole(
    userId: string,
    roleId: string,
    projectId: string | null,
    assignedBy: string
  ): Promise<any> {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify role exists
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    // Verify project exists if projectId provided
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        throw new NotFoundError('Project not found');
      }
      // Verify project belongs to same company
      if (project.companyId !== user.companyId) {
        throw new BadRequestError('Project does not belong to user company');
      }
    }

    // Check if assignment already exists
    const existing = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
        projectId: projectId || null,
      },
    });

    if (existing) {
      return existing;
    }

    // Create assignment
    const userRole = await prisma.userRole.create({
      data: {
        userId,
        roleId,
        projectId: projectId || null,
        assignedBy,
      },
      include: {
        role: true,
        project: projectId ? true : false,
      },
    });

    // Invalidate cache
    await this._invalidateUserCache(userId);

    return userRole;
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, roleId: string, projectId?: string): Promise<void> {
    const where: any = { userId, roleId };
    if (projectId !== undefined) {
      where.projectId = projectId || null;
    }

    await prisma.userRole.deleteMany({ where });

    // Invalidate cache
    await this._invalidateUserCache(userId);
  }

  /**
   * Grant/revoke specific permission
   */
  async grantPermission(
    userId: string,
    projectId: string,
    permission: string,
    granted: boolean,
    grantedBy: string
  ): Promise<any> {
    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Verify project belongs to same company
    if (project.companyId !== user.companyId) {
      throw new BadRequestError('Project does not belong to user company');
    }

    // Upsert permission
    const projectPerm = await prisma.projectPermission.upsert({
      where: {
        userId_projectId_permission: {
          userId,
          projectId,
          permission,
        },
      },
      update: {
        granted,
        grantedBy,
        grantedAt: new Date(),
      },
      create: {
        userId,
        projectId,
        permission,
        granted,
        grantedBy,
      },
    });

    // Invalidate cache
    await this._invalidateUserCache(userId);

    return projectPerm;
  }

  /**
   * Get effective permissions for user (roles + overrides)
   */
  async getEffectivePermissions(userId: string, projectId?: string): Promise<EffectivePermission[]> {
    const permissions: EffectivePermission[] = [];

    // Get user roles
    const userRoles = await this.getUserRoles(userId, projectId);

    for (const userRole of userRoles) {
      const role = await prisma.role.findUnique({
        where: { id: userRole.id },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      if (!role) continue;

      // Add default permissions from role JSON
      if (role.defaultPermissions) {
        const defaultPerms = role.defaultPermissions as Record<string, string[]>;
        for (const [resource, actions] of Object.entries(defaultPerms)) {
          for (const action of actions) {
            permissions.push({
              resource,
              action,
              scope: 'project',
              granted: true,
              source: 'role',
            });
          }
        }
      }

      // Add role permissions
      for (const rolePerm of role.permissions) {
        const perm = rolePerm.permission;
        permissions.push({
          resource: perm.resource || perm.name.split(':')[0],
          action: perm.action || perm.name.split(':')[1],
          scope: perm.scope || 'project',
          granted: true,
          source: 'role',
        });
      }
    }

    // Add project-specific overrides
    if (projectId) {
      const projectPerms = await prisma.projectPermission.findMany({
        where: { userId, projectId },
      });

      for (const projectPerm of projectPerms) {
        const [resource, action] = projectPerm.permission.split(':');
        const existing = permissions.findIndex(
          (p) => p.resource === resource && p.action === action && p.scope === 'project'
        );

        if (existing >= 0) {
          permissions[existing].granted = projectPerm.granted;
          permissions[existing].source = 'project_override';
        } else {
          permissions.push({
            resource,
            action,
            scope: 'project',
            granted: projectPerm.granted,
            source: 'project_override',
          });
        }
      }
    }

    // Add direct user permissions
    const userPerms = await prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });

    for (const userPerm of userPerms) {
      const perm = userPerm.permission;
      permissions.push({
        resource: perm.resource || perm.name.split(':')[0],
        action: perm.action || perm.name.split(':')[1],
        scope: perm.scope || 'project',
        granted: true,
        source: 'user_permission',
      });
    }

    return permissions;
  }

  /**
   * Invalidate permission cache for user
   */
  private async _invalidateUserCache(userId: string): Promise<void> {
    try {
      const keys = await redis.keys(`${this.CACHE_PREFIX}${userId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      // Silently ignore cache invalidation failures (common in tests)
      if (process.env.NODE_ENV !== 'test') {
        logger.warn('Failed to invalidate permission cache:', error);
      }
    }
  }
}

// Export singleton instance
export const permissionService = new PermissionService();
