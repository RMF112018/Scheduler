import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  token: string;
  refreshToken: string;
}

export interface TestCompany {
  id: string;
  name: string;
}

export interface TestProject {
  id: string;
  name: string;
  companyId: string;
  createdBy: string;
}

export interface TestSchedule {
  id: string;
  name: string;
  projectId: string;
  createdBy: string;
}

/**
 * Create a test company
 */
export async function createTestCompany(name: string = 'Test Company'): Promise<TestCompany> {
  const company = await prisma.company.create({
    data: { name },
  });
  return { id: company.id, name: company.name };
}

/**
 * Create a test user with authentication tokens
 */
export async function createTestUser(
  companyId: string,
  options: {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  } = {}
): Promise<TestUser> {
  const {
    email = `test-${Date.now()}@example.com`,
    password = 'TestPassword123!',
    firstName = 'Test',
    lastName = 'User',
    role = 'user',
  } = options;

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role,
      companyId,
    },
  });

  const tokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  };

  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '15m',
  });

  const refreshToken = jwt.sign(tokenPayload, process.env.JWT_REFRESH_SECRET || 'test-refresh-secret', {
    expiresIn: '7d',
  });

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    companyId: user.companyId,
    token,
    refreshToken,
  };
}

/**
 * Create a test project
 */
export async function createTestProject(
  companyId: string,
  createdBy: string,
  options: {
    name?: string;
    description?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<TestProject> {
  const {
    name = 'Test Project',
    description = 'A test project for testing',
    status = 'active',
    startDate,
    endDate,
  } = options;

  const project = await prisma.project.create({
    data: {
      companyId,
      name,
      description,
      status,
      startDate,
      endDate,
      createdBy,
    },
  });

  return {
    id: project.id,
    name: project.name,
    companyId: project.companyId,
    createdBy: project.createdBy,
  };
}

/**
 * Create a test schedule
 */
export async function createTestSchedule(
  projectId: string,
  createdBy: string,
  options: {
    name?: string;
    description?: string;
    status?: string;
  } = {}
): Promise<TestSchedule> {
  const {
    name = 'Test Schedule',
    description = 'A test schedule for testing',
    status = 'active',
  } = options;

  const schedule = await prisma.schedule.create({
    data: {
      projectId,
      name,
      description,
      status,
      createdBy,
    },
  });

  return {
    id: schedule.id,
    name: schedule.name,
    projectId: schedule.projectId,
    createdBy: schedule.createdBy,
  };
}

/**
 * Create test activities for a schedule
 */
export async function createTestActivities(
  scheduleId: string,
  count: number = 5
): Promise<string[]> {
  const activityIds: string[] = [];
  const baseDate = new Date();

  for (let i = 0; i < count; i++) {
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() + i * 7);
    const finishDate = new Date(startDate);
    finishDate.setDate(finishDate.getDate() + 5);

    const activity = await prisma.scheduleActivity.create({
      data: {
        scheduleId,
        activityCode: `A${1000 + i}`,
        name: `Test Activity ${i + 1}`,
        startDate,
        finishDate,
        duration: 5,
        percentComplete: i < 2 ? 100 : 0,
        predecessorIds: activityIds.length > 0 ? [activityIds[activityIds.length - 1]] : [],
        successorIds: [],
        totalFloat: i === 0 ? 0 : 5,
        isCritical: i === 0,
      },
    });

    activityIds.push(activity.id);
  }

  return activityIds;
}

/**
 * Generate an authorization header for testing
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Clean up all test data from the database
 * This should be called in afterEach to ensure a clean state
 */
export async function cleanupTestData(): Promise<void> {
  // Delete in order to respect foreign key constraints
  await prisma.staffAssignmentMonthlyAllocation.deleteMany({});
  await prisma.staffAssignment.deleteMany({});
  await prisma.projectRoleRate.deleteMany({});
  await prisma.resourceAssignment.deleteMany({});
  await prisma.staffMember.deleteMany({});
  await prisma.staffRole.deleteMany({});
  await prisma.activityAttachment.deleteMany({});
  await prisma.workflowHistory.deleteMany({});
  await prisma.workflowApproval.deleteMany({});
  await prisma.lookaheadActivity.deleteMany({});
  await prisma.lookaheadVersion.deleteMany({});
  await prisma.lookaheadSchedule.deleteMany({});
  await prisma.scheduleBaseline.deleteMany({});
  await prisma.scheduleActivity.deleteMany({});
  await prisma.schedule.deleteMany({});
  await prisma.importMapping.deleteMany({});
  await prisma.projectSettings.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.userPermission.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});
}

export { prisma };
