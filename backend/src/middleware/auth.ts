import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { prisma } from '../config/database.js';

// Extend Express Request to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      companyId: string;
      permissions?: string[];
    }
  }
}

// JWT authentication middleware
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  passport.authenticate('jwt', { session: false }, (err: Error | null, user: Express.User | false) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    req.user = user;
    next();
  })(req, res, next);
};

// Role-based access control (checks legacy User.role field)
export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

// Phase 11: Enhanced role-based access control (checks UserRole assignments)
export const requireRoleAssignment = (...roleNames: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    try {
      // Check legacy role field first (for backward compatibility)
      if (roleNames.includes(req.user.role)) {
        return next();
      }

      // Check UserRole assignments
      const userRoles = await prisma.userRole.findMany({
        where: { userId: req.user.id },
        include: { role: true },
      });

      const hasRole = userRoles.some((ur) => roleNames.includes(ur.role.name));

      if (!hasRole) {
        return next(new ForbiddenError(`Insufficient role. Required: ${roleNames.join(', ')}`));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Phase 11: Admin-only access control
export const requireAdmin = requireRoleAssignment('administrator', 'admin');

// Permission-based access control (legacy - checks UserPermission table)
export const requirePermission = (permission: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    try {
      // Get user permissions from database
      const userPermissions = await prisma.userPermission.findMany({
        where: { userId: req.user.id },
        include: { permission: true },
      });

      const hasPermission = userPermissions.some(
        (up) => up.permission.name === permission
      );

      if (!hasPermission) {
        return next(new ForbiddenError(`Permission '${permission}' required`));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Phase 11: Enhanced permission-based access control (checks PermissionService)
export const requirePermissionCheck = (resource: string, action: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    try {
      const { permissionService } = await import('../services/permissionService.js');
      const projectId = req.params.projectId || req.body.projectId;

      const hasPermission = await permissionService.hasPermission(
        req.user.id,
        resource,
        action,
        projectId
      );

      if (!hasPermission) {
        return next(
          new ForbiddenError(`Permission '${resource}:${action}' required${projectId ? ` for project ${projectId}` : ''}`)
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Project-level permission check
export const requireProjectPermission = (permission: string) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const projectId = req.params.projectId || req.body.projectId;

    if (!projectId) {
      return next(new ForbiddenError('Project ID required'));
    }

    try {
      // Check project-level permission
      const projectMember = await prisma.projectMember.findFirst({
        where: {
          projectId,
          userId: req.user.id,
        },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      if (!projectMember) {
        return next(new ForbiddenError('Not a member of this project'));
      }

      const hasPermission = projectMember.role.permissions.some(
        (rp) => rp.permission.name === permission
      );

      if (!hasPermission) {
        return next(new ForbiddenError(`Permission '${permission}' required for this project`));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
