/**
 * User Management Controller
 *
 * Phase 11: Admin-only user management API endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { userManagementService } from '../services/userManagementService.js';
import { permissionService } from '../services/permissionService.js';
import { prisma } from '../config/database.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Extend Express Request to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    companyId: string;
  };
}

export class UserManagementController {
  /**
   * List/search users (admin only)
   * GET /api/v1/admin/users
   */
  async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.user!;
      const {
        email,
        firstName,
        lastName,
        roleId,
        projectId,
        page = '1',
        limit = '20',
      } = req.query;

      const result = await userManagementService.searchUsers({
        companyId,
        email: email as string,
        firstName: firstName as string,
        lastName: lastName as string,
        roleId: roleId as string,
        projectId: projectId as string,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user details (admin only)
   * GET /api/v1/admin/users/:id
   */
  async getUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { companyId } = req.user!;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          userRoles: {
            include: {
              role: true,
              project: true,
            },
          },
          projectPermissions: {
            include: {
              project: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.companyId !== companyId) {
        throw new BadRequestError('User does not belong to your company');
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId,
        roles: user.userRoles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          description: ur.role.description,
          projectId: ur.projectId,
          projectName: ur.project?.name,
          assignedAt: ur.assignedAt,
        })),
        permissions: user.projectPermissions.map((pp) => ({
          permission: pp.permission,
          projectId: pp.projectId,
          projectName: pp.project.name,
          granted: pp.granted,
          grantedAt: pp.grantedAt,
        })),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create user (admin only, assigns "New User" role by default)
   * POST /api/v1/admin/users
   */
  async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, id: createdBy } = req.user!;
      const { email, password, firstName, lastName, roleId } = req.body;

      if (!email || !firstName || !lastName) {
        throw new BadRequestError('email, firstName, and lastName are required');
      }

      const user = await userManagementService.createUser(
        {
          email,
          password,
          firstName,
          lastName,
          companyId,
          roleId,
        },
        createdBy
      );

      logger.info(`User created: ${user.email} by ${req.user!.email}`);

      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          ...(user.password && { temporaryPassword: user.password }),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user (admin only)
   * PUT /api/v1/admin/users/:id
   */
  async updateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { id: updatedBy } = req.user!;
      const { email, firstName, lastName, password } = req.body;

      const user = await userManagementService.updateUser(
        id,
        {
          email,
          firstName,
          lastName,
          password,
        },
        updatedBy
      );

      logger.info(`User updated: ${user.email} by ${req.user!.email}`);

      res.json({
        message: 'User updated successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user (admin only)
   * DELETE /api/v1/admin/users/:id
   */
  async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { id: deletedBy } = req.user!;

      await userManagementService.deleteUser(id, deletedBy);

      logger.info(`User deleted: ${id} by ${req.user!.email}`);

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk import users from CSV (admin only)
   * POST /api/v1/admin/users/import
   */
  async importUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId, id: importedBy } = req.user!;
      const { csvContent } = req.body;

      if (!csvContent) {
        throw new BadRequestError('csvContent is required');
      }

      const result = await userManagementService.importUsersFromCSV(
        csvContent,
        companyId,
        importedBy
      );

      logger.info(
        `User import completed: ${result.imported} imported, ${result.updated} updated, ${result.errors.length} errors`
      );

      res.json({
        message: `Import complete: ${result.imported} imported, ${result.updated} updated`,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Assign role to user (admin only)
   * POST /api/v1/admin/users/:id/roles
   */
  async assignRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: userId } = req.params;
      const { id: assignedBy } = req.user!;
      const { roleId, projectId } = req.body;

      if (!roleId) {
        throw new BadRequestError('roleId is required');
      }

      const userRole = await userManagementService.assignRoleToUser(
        userId,
        roleId,
        projectId || null,
        assignedBy
      );

      logger.info(`Role assigned: ${userRole.role.name} to user ${userId} by ${req.user!.email}`);

      res.json({
        message: 'Role assigned successfully',
        userRole: {
          id: userRole.id,
          role: {
            id: userRole.role.id,
            name: userRole.role.name,
            description: userRole.role.description,
          },
          projectId: userRole.projectId,
          assignedAt: userRole.assignedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove role from user (admin only)
   * DELETE /api/v1/admin/users/:id/roles/:roleId
   */
  async removeRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: userId, roleId } = req.params;
      const { id: removedBy } = req.user!;
      const { projectId } = req.query;

      await userManagementService.removeRoleFromUser(
        userId,
        roleId,
        projectId ? (projectId as string) : null,
        removedBy
      );

      logger.info(`Role removed: ${roleId} from user ${userId} by ${req.user!.email}`);

      res.json({ message: 'Role removed successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Assign user to project (admin only)
   * POST /api/v1/admin/users/:id/projects
   */
  async assignToProject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: userId } = req.params;
      const { id: assignedBy } = req.user!;
      const { projectId, roleId } = req.body;

      if (!projectId || !roleId) {
        throw new BadRequestError('projectId and roleId are required');
      }

      await userManagementService.assignUserToProject(userId, projectId, roleId, assignedBy);

      logger.info(`User ${userId} assigned to project ${projectId} with role ${roleId} by ${req.user!.email}`);

      res.json({ message: 'User assigned to project successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get effective permissions for user (admin only)
   * GET /api/v1/admin/users/:id/permissions
   */
  async getPermissions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: userId } = req.params;
      const { projectId } = req.query;

      const permissions = await permissionService.getEffectivePermissions(
        userId,
        projectId as string | undefined
      );

      res.json({ permissions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update permissions for user (admin only)
   * PUT /api/v1/admin/users/:id/permissions
   */
  async updatePermissions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: userId } = req.params;
      const { id: grantedBy } = req.user!;
      const { projectId, permission, granted } = req.body;

      if (!projectId || !permission || typeof granted !== 'boolean') {
        throw new BadRequestError('projectId, permission, and granted are required');
      }

      const projectPerm = await permissionService.grantPermission(
        userId,
        projectId,
        permission,
        granted,
        grantedBy
      );

      logger.info(
        `Permission ${granted ? 'granted' : 'revoked'}: ${permission} for user ${userId} on project ${projectId} by ${req.user!.email}`
      );

      res.json({
        message: `Permission ${granted ? 'granted' : 'revoked'} successfully`,
        permission: projectPerm,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all roles (admin only)
   * GET /api/v1/admin/roles
   */
  async listRoles(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await prisma.role.findMany({
        orderBy: { name: 'asc' },
      });

      res.json({
        roles: roles.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          isSystem: r.isSystem,
          defaultPermissions: r.defaultPermissions,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
}
