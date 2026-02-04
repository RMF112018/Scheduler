import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Create a test-specific Prisma client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://scheduler:scheduler_dev_password@localhost:5432/scheduler_test?schema=public',
    },
  },
});

// Mock environment variables for testing
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('JWT_SECRET', 'test-jwt-secret-key-for-testing-purposes-only');
vi.stubEnv('JWT_EXPIRES_IN', '15m');
vi.stubEnv('JWT_REFRESH_SECRET', 'test-jwt-refresh-secret-key-for-testing');
vi.stubEnv('JWT_REFRESH_EXPIRES_IN', '7d');

beforeAll(async () => {
  // Connect to the test database
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect from the test database
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean up test data before each test
  // This ensures test isolation
  // Order matters due to foreign key constraints
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityAttachment.deleteMany();
  await prisma.resourceAssignment.deleteMany();
  await prisma.importMapping.deleteMany();
  await prisma.workflowHistory.deleteMany();
  await prisma.workflowApproval.deleteMany();
  await prisma.lookaheadVersion.deleteMany();
  await prisma.lookaheadActivity.deleteMany();
  await prisma.lookaheadSchedule.deleteMany();
  await prisma.scheduleBaseline.deleteMany();
  await prisma.scheduleActivity.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.projectSettings.deleteMany();
  await prisma.project.deleteMany();
  await prisma.staffMember.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
});

export { prisma };
