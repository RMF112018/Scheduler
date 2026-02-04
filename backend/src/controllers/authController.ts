import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt.js';
import { BadRequestError, UnauthorizedError } from '../utils/errors.js';

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
      const { email, password, firstName, lastName, companyId } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        throw new BadRequestError('Email already registered');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          role: 'user',
          companyId,
        },
      });

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
