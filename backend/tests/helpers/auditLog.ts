/**
 * Audit Log Test Utilities
 *
 * Phase 9: Test helpers for audit log verification.
 */

import { prisma } from '../setup.js';
import type { AuditLog } from '@prisma/client';

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditLogs(
  entityType: string,
  entityId: string
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get the most recent audit log for an entity
 */
export async function getLatestAuditLog(
  entityType: string,
  entityId: string
): Promise<AuditLog | null> {
  const logs = await getEntityAuditLogs(entityType, entityId);
  return logs.length > 0 ? logs[0] : null;
}

/**
 * Verify that an audit log exists for a specific action
 */
export async function verifyAuditLog(
  entityType: string,
  entityId: string,
  action: 'create' | 'update' | 'delete',
  options: {
    userId?: string;
    timeout?: number;
  } = {}
): Promise<AuditLog | null> {
  const { userId, timeout = 5000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
        action,
        ...(userId && { userId }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (logs.length > 0) {
      return logs[0];
    }

    // Wait a bit before checking again
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return null;
}

/**
 * Verify that changes are logged in audit log
 */
export async function verifyAuditLogChanges(
  entityType: string,
  entityId: string,
  expectedChanges: Record<string, unknown>
): Promise<boolean> {
  const log = await getLatestAuditLog(entityType, entityId);
  
  if (!log || !log.changes) {
    return false;
  }

  const changes = log.changes as Record<string, { old: unknown; new: unknown }>;
  
  for (const [field, expectedValue] of Object.entries(expectedChanges)) {
    if (!changes[field]) {
      return false;
    }
    
    // Check if the new value matches (allowing for type coercion)
    const actualNewValue = changes[field].new;
    if (JSON.stringify(actualNewValue) !== JSON.stringify(expectedValue)) {
      return false;
    }
  }

  return true;
}

/**
 * Get audit log count for a user
 */
export async function getAuditLogCount(
  userId: string,
  options: {
    entityType?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<number> {
  return prisma.auditLog.count({
    where: {
      userId,
      ...(options.entityType && { entityType: options.entityType }),
      ...(options.action && { action: options.action }),
      ...(options.startDate || options.endDate
        ? {
            createdAt: {
              ...(options.startDate && { gte: options.startDate }),
              ...(options.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    },
  });
}

/**
 * Clear all audit logs (for test cleanup)
 */
export async function clearAuditLogs(): Promise<void> {
  await prisma.auditLog.deleteMany({});
}
