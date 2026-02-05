/**
 * Audit Service
 *
 * Phase 9: Comprehensive audit logging for every write operation.
 * Provides automatic change detection and logging for compliance,
 * debugging, and change tracking.
 */

import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface AuditLogParams {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  userId: string;
  companyId: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Audit Service
// ============================================================================

export class AuditService {
  /**
   * Log a change to the audit log
   */
  async logChange(params: AuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          userId: params.userId,
          companyId: params.companyId,
          changes: params.changes as unknown,
          metadata: (params.metadata || {}) as unknown,
        },
      });
    } catch (error) {
      // Don't fail the request if audit logging fails
      logger.error('Failed to log audit entry:', error);
      // Log to console as fallback
      console.error('Audit log error:', error);
    }
  }

  /**
   * Detect changes between old and new objects
   * Returns a record of field changes with old and new values
   */
  detectChanges<T extends Record<string, unknown>>(
    oldValue: T | null,
    newValue: T
  ): Record<string, { old: unknown; new: unknown }> {
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    if (!oldValue) {
      // Create: all fields are new
      Object.keys(newValue).forEach((key) => {
        // Skip internal fields that shouldn't be logged
        if (this.shouldSkipField(key)) {
          return;
        }
        changes[key] = { old: null, new: newValue[key] };
      });
      return changes;
    }

    // Update: compare fields
    const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    allKeys.forEach((key) => {
      // Skip internal fields
      if (this.shouldSkipField(key)) {
        return;
      }

      const oldVal = oldValue[key];
      const newVal = newValue[key];

      // Deep comparison for objects/arrays
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes[key] = { old: oldVal, new: newVal };
      }
    });

    return changes;
  }

  /**
   * Check if a field should be skipped in audit logging
   * (e.g., timestamps, internal IDs, etc.)
   */
  private shouldSkipField(fieldName: string): boolean {
    const skipFields = [
      'createdAt',
      'created_at',
      'updatedAt',
      'updated_at',
      'id',
      'passwordHash',
      'password_hash',
    ];
    return skipFields.includes(fieldName);
  }

  /**
   * Query audit logs with filters
   */
  async queryAuditLogs(filters: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    companyId?: string;
    action?: 'create' | 'update' | 'delete';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }
    if (filters.entityId) {
      where.entityId = filters.entityId;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.companyId) {
      where.companyId = filters.companyId;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate && { gte: filters.startDate }),
        ...(filters.endDate && { lte: filters.endDate }),
      } as { gte?: Date; lte?: Date };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: filters.limit || 100,
        skip: filters.offset || 0,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      limit: filters.limit || 100,
      offset: filters.offset || 0,
    };
  }

  /**
   * Get audit trail for a specific entity
   */
  async getEntityAuditTrail(entityType: string, entityId: string) {
    return this.queryAuditLogs({
      entityType,
      entityId,
    });
  }
}

export const auditService = new AuditService();
