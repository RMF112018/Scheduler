/**
 * User Factory for E2E Tests
 * 
 * Creates test users with various roles for RBAC and security testing.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { User, UserRole } from '../../../../shared/src/index.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://user:password@localhost:5432/scheduler_test',
    },
  },
});

export interface TestUser extends User {
  password: string;
  token: string;
}

export interface UserFactoryOptions {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole | 'new_user';
  companyId: string;
}

/**
 * Create a test user with authentication token
 */
export async function createTestUser(options: UserFactoryOptions): Promise<TestUser> {
  const {
    email = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@e2e.test`,
    password = 'TestPassword123!',
    firstName = 'Test',
    lastName = 'User',
    role = 'user',
    companyId,
  } = options;

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: role === 'new_user' ? 'new_user' : role,
      companyId,
    },
  });

  const tokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  };

  const token = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET || 'test-jwt-secret-key',
    { expiresIn: '15m' }
  );

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as UserRole,
    companyId: user.companyId,
    password,
    token,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Create a new_user role for testing pending assignment screen
 */
export async function createNewUser(companyId: string): Promise<TestUser> {
  return createTestUser({
    companyId,
    role: 'new_user',
    firstName: 'New',
    lastName: 'User',
  });
}

/**
 * Create a field crew user (subcontractor)
 */
export async function createFieldCrewUser(companyId: string): Promise<TestUser> {
  return createTestUser({
    companyId,
    role: 'subcontractor',
    firstName: 'Field',
    lastName: 'Crew',
  });
}

/**
 * Create a scheduler user
 */
export async function createSchedulerUser(companyId: string): Promise<TestUser> {
  return createTestUser({
    companyId,
    role: 'pm', // Project Manager / Scheduler
    firstName: 'Scheduler',
    lastName: 'User',
  });
}

/**
 * Create a superintendent user
 */
export async function createSuperintendentUser(companyId: string): Promise<TestUser> {
  return createTestUser({
    companyId,
    role: 'superintendent',
    firstName: 'Super',
    lastName: 'Intendent',
  });
}

/**
 * Create an admin user
 */
export async function createAdminUser(companyId: string): Promise<TestUser> {
  return createTestUser({
    companyId,
    role: 'admin',
    firstName: 'Admin',
    lastName: 'User',
  });
}
