import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Mock environment variables for testing - MUST be done before PrismaClient instantiation
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('DATABASE_URL', process.env.DATABASE_URL || 'postgresql://scheduler:scheduler_dev_password@localhost:5432/scheduler');
vi.stubEnv('JWT_SECRET', 'test-jwt-secret-key-for-testing-purposes-only');
vi.stubEnv('JWT_EXPIRES_IN', '15m');
vi.stubEnv('JWT_REFRESH_SECRET', 'test-jwt-refresh-secret-key-for-testing');
vi.stubEnv('JWT_REFRESH_EXPIRES_IN', '7d');

// Create a test-specific Prisma client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://scheduler:scheduler_dev_password@localhost:5432/scheduler',
    },
  },
});

beforeAll(async () => {
  // Connect to the test database
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect from the test database
  await prisma.$disconnect();
});

/**
 * Clean up all test data from the database
 * Order matters due to foreign key constraints - delete children before parents
 */
async function cleanDatabase() {
  // Use a transaction for atomic cleanup
  await prisma.$transaction(async (tx) => {
    // First level: Tables with no dependents or only self-references
    await tx.auditLog.deleteMany();
    await tx.notification.deleteMany();
    await tx.workflowHistory.deleteMany();
    
    // Second level: Tables that depend on first level
    await tx.activityAttachment.deleteMany();
    await tx.resourceAssignment.deleteMany();
    await tx.workflowApproval.deleteMany();
    await tx.lookaheadVersion.deleteMany();
    await tx.lookaheadActivity.deleteMany();
    await tx.scheduleBaseline.deleteMany();
    await tx.importMapping.deleteMany();
    
    // Staff assignment tables
    await tx.staffAssignmentMonthlyAllocation.deleteMany();
    await tx.staffAssignment.deleteMany();
    await tx.projectRoleRate.deleteMany();
    
    // Third level: Tables that depend on second level
    await tx.scheduleActivity.deleteMany();
    await tx.lookaheadSchedule.deleteMany();
    
    // Fourth level: Schedule depends on project and user
    await tx.schedule.deleteMany();
    
    // Fifth level: Project-related tables
    await tx.projectMember.deleteMany();
    await tx.projectSettings.deleteMany();
    await tx.project.deleteMany();
    
    // Sixth level: User-related tables
    await tx.staffMember.deleteMany();
    await tx.userPermission.deleteMany();
    await tx.user.deleteMany();
    
    // Seventh level: Role and permission tables
    await tx.rolePermission.deleteMany();
    await tx.permission.deleteMany();
    await tx.role.deleteMany();
    await tx.staffRole.deleteMany();
    
    // Eighth level: Company (root level)
    await tx.company.deleteMany();
  });
}

// Clean up after each test to ensure isolation
afterEach(async () => {
  await cleanDatabase();
});

export { prisma, cleanDatabase };
