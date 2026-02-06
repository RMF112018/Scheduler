import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt.js';
import { BadRequestError, UnauthorizedError } from '../utils/errors.js';
import { permissionService } from '../services/permissionService.js';
import { eventBus } from '../services/eventBus.js';
import type { UserCreatedEvent, RoleAssignedEvent } from '../../../shared/src/events.js';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: { company: true },
      });

      if (!user) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        throw new UnauthorizedError('Invalid email or password');
      }

      const tokenPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      };

      const token = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          companyId: user.companyId,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName, companyId, companyName } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        throw new BadRequestError('Email already registered');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create or use existing company
      let finalCompanyId = companyId;
      if (!finalCompanyId && companyName) {
        // Create a new company for this user
        const company = await prisma.company.create({
          data: { name: companyName },
        });
        finalCompanyId = company.id;
      }

      if (!finalCompanyId) {
        throw new BadRequestError('Company ID or Company Name is required');
      }

      // Check if this is the first user in the company
      const existingUsers = await prisma.user.count({
        where: { companyId: finalCompanyId },
      });
      const isFirstUser = existingUsers === 0;

      // Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          role: isFirstUser ? 'admin' : 'user', // First user is admin, others are regular users
          companyId: finalCompanyId,
        },
      });

      // Phase 11: Assign role (admin for first user, "New User" for others)
      let roleId: string | undefined;
      if (isFirstUser) {
        // First user gets administrator role
        const adminRole = await prisma.role.findUnique({
          where: { name: 'administrator' },
        });
        if (adminRole) {
          roleId = adminRole.id;
          await permissionService.assignRole(user.id, adminRole.id, null, user.id);
        }
      } else {
        // Other users get "New User" role
        const newUserRole = await prisma.role.findUnique({
          where: { name: 'new_user' },
        });
        if (newUserRole) {
          roleId = newUserRole.id;
          await permissionService.assignRole(user.id, newUserRole.id, null, user.id);
        }
      }

      // Publish events
      if (roleId) {
        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (role) {
          await eventBus.publish({
            type: 'role.assigned',
            entityId: user.id,
            entityType: 'User',
            userId: user.id,
            companyId: finalCompanyId,
            timestamp: new Date(),
            roleId,
            roleName: role.name,
            projectId: null,
          } as RoleAssignedEvent);
        }
      }

      await eventBus.publish({
        type: 'user.created',
        entityId: user.id,
        entityType: 'User',
        userId: user.id,
        companyId: finalCompanyId,
        timestamp: new Date(),
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        defaultRoleId: roleId,
      } as UserCreatedEvent);

      const tokenPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      };

      const token = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          companyId: user.companyId,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      const payload = verifyToken(refreshToken);

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      const tokenPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      };

      const token = generateAccessToken(tokenPayload);

      res.json({ token });
    } catch (error) {
      next(new UnauthorizedError('Invalid refresh token'));
    }
  }

  async logout(_req: Request, res: Response): Promise<void> {
    // In a more complete implementation, you would invalidate the token
    // by adding it to a blacklist or removing from a whitelist
    res.json({ message: 'Logged out successfully' });
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: { company: true },
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId,
        company: user.company,
      });
    } catch (error) {
      next(error);
    }
  }
}
