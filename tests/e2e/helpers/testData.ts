import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://user:password@localhost:5432/scheduler_test',
    },
  },
});

export interface E2ETestUser {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  token: string;
}

export interface E2ETestCompany {
  id: string;
  name: string;
}

export interface E2ETestProject {
  id: string;
  name: string;
  companyId: string;
}

export interface E2ETestSchedule {
  id: string;
  name: string;
  projectId: string;
}

/**
 * Create a test company for E2E tests
 */
export async function createE2ECompany(name: string = 'E2E Test Company'): Promise<E2ETestCompany> {
  const company = await prisma.company.create({
    data: { name },
  });
  return { id: company.id, name: company.name };
}

/**
 * Create a test user for E2E tests with authentication
 */
export async function createE2EUser(
  companyId: string,
  options: {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  } = {}
): Promise<E2ETestUser> {
  const {
    email = `e2e-${Date.now()}@test.com`,
    password = 'TestPassword123!',
    firstName = 'E2E',
    lastName = 'Test',
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

  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'test-jwt-secret-key', {
    expiresIn: '15m',
  });

  return {
    id: user.id,
    email: user.email,
    password,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    companyId: user.companyId,
    token,
  };
}

/**
 * Create a test project for E2E tests
 */
export async function createE2EProject(
  companyId: string,
  createdBy: string,
  options: {
    name?: string;
    description?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<E2ETestProject> {
  const {
    name = 'E2E Test Project',
    description = 'E2E test project description',
    status = 'active',
    startDate = new Date(),
    endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
  } = options;

  const project = await prisma.project.create({
    data: {
      name,
      description,
      status,
      startDate,
      endDate,
      companyId,
      createdBy,
    },
  });

  return {
    id: project.id,
    name: project.name,
    companyId: project.companyId,
  };
}

/**
 * Create a test schedule for E2E tests
 */
export async function createE2ESchedule(
  projectId: string,
  createdBy: string,
  options: {
    name?: string;
    status?: string;
  } = {}
): Promise<E2ETestSchedule> {
  const {
    name = 'E2E Test Schedule',
    status = 'active',
  } = options;

  const schedule = await prisma.schedule.create({
    data: {
      name,
      status,
      projectId,
      createdBy,
    },
  });

  return {
    id: schedule.id,
    name: schedule.name,
    projectId: schedule.projectId,
  };
}

/**
 * Create test activities for a schedule
 */
export async function createE2EActivities(
  scheduleId: string,
  count: number = 5
): Promise<string[]> {
  const activities = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const startDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000); // i days from now
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days duration

    const activity = await prisma.scheduleActivity.create({
      data: {
        scheduleId,
        name: `E2E Test Activity ${i + 1}`,
        description: `E2E test activity ${i + 1} description`,
        startDate,
        endDate,
        duration: 7,
        percentComplete: 0,
        status: 'not_started',
      },
    });

    activities.push(activity.id);
  }

  return activities;
}

/**
 * Clean up all E2E test data
 */
export async function cleanE2EDatabase() {
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany();
    await tx.notification.deleteMany();
    await tx.workflowHistory.deleteMany();
    await tx.activityAttachment.deleteMany();
    await tx.resourceAssignment.deleteMany();
    await tx.workflowApproval.deleteMany();
    await tx.lookaheadVersion.deleteMany();
    await tx.lookaheadActivity.deleteMany();
    await tx.scheduleBaseline.deleteMany();
    await tx.importMapping.deleteMany();
    await tx.staffAssignmentMonthlyAllocation.deleteMany();
    await tx.staffAssignment.deleteMany();
    await tx.projectRoleRate.deleteMany();
    await tx.scheduleActivity.deleteMany();
    await tx.lookaheadSchedule.deleteMany();
    await tx.schedule.deleteMany();
    await tx.projectMember.deleteMany();
    await tx.projectSettings.deleteMany();
    await tx.project.deleteMany();
    await tx.staffMember.deleteMany();
    await tx.userPermission.deleteMany();
    await tx.user.deleteMany();
    await tx.rolePermission.deleteMany();
    await tx.permission.deleteMany();
    await tx.role.deleteMany();
    await tx.staffRole.deleteMany();
    await tx.company.deleteMany();
  });
}

/**
 * Initialize database connection
 */
export async function initE2EDatabase() {
  await prisma.$connect();
}

/**
 * Close database connection
 */
export async function closeE2EDatabase() {
  await prisma.$disconnect();
}
