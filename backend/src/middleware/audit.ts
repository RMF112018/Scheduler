/**
 * Audit Middleware
 *
 * Phase 9: Middleware for automatic audit logging of write operations.
 * Intercepts responses and logs changes to the audit log.
 */

import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface AuditConfig {
  entityType: string;
  getEntityId: (req: Request) => string;
  getOldValue?: (req: Request) => unknown;
  getNewValue?: (req: Request, res: Response) => unknown;
}

// ============================================================================
// Audit Middleware Factory
// ============================================================================

/**
 * Create audit middleware for a specific entity type
 * 
 * @param config Configuration for the audit middleware
 * @returns Express middleware function
 */
export function auditMiddleware(config: AuditConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original response methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Determine action from HTTP method
    const action = 
      req.method === 'POST' ? 'create' :
      req.method === 'PUT' || req.method === 'PATCH' ? 'update' :
      req.method === 'DELETE' ? 'delete' : null;

    // Only audit write operations
    if (!action || !req.user) {
      return next();
    }

    // Get old value if available (for updates/deletes)
    let oldValue: unknown = null;
    if (config.getOldValue) {
      try {
        oldValue = config.getOldValue(req);
      } catch (error) {
        logger.warn('Failed to get old value for audit:', error);
      }
    }

    // Override response methods to capture response data
    res.json = function(data: unknown) {
      // Log audit entry after successful operation
      if (res.statusCode < 400 && req.user) {
        const entityId = config.getEntityId(req);
        const newValue = config.getNewValue ? config.getNewValue(req, res) : data;

        // Detect changes
        const changes = auditService.detectChanges(
          oldValue as Record<string, unknown> | null,
          newValue as Record<string, unknown>
        );

        // Only log if there are actual changes (or it's a create/delete)
        if (Object.keys(changes).length > 0 || action === 'create' || action === 'delete') {
          auditService.logChange({
            entityType: config.entityType,
            entityId,
            action,
            userId: req.user.id,
            companyId: req.user.companyId,
            changes,
            metadata: {
              ip: req.ip || req.socket.remoteAddress,
              userAgent: req.get('user-agent'),
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
            },
          }).catch((err) => {
            // Don't fail the request if audit logging fails
            logger.error('Failed to log audit entry:', err);
          });
        }
      }

      return originalJson(data);
    };

    res.send = function(data: unknown) {
      // Similar logic for res.send
      if (res.statusCode < 400 && req.user) {
        const entityId = config.getEntityId(req);
        const newValue = config.getNewValue ? config.getNewValue(req, res) : data;

        const changes = auditService.detectChanges(
          oldValue as Record<string, unknown> | null,
          newValue as Record<string, unknown>
        );

        if (Object.keys(changes).length > 0 || action === 'create' || action === 'delete') {
          auditService.logChange({
            entityType: config.entityType,
            entityId,
            action,
            userId: req.user.id,
            companyId: req.user.companyId,
            changes,
            metadata: {
              ip: req.ip || req.socket.remoteAddress,
              userAgent: req.get('user-agent'),
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
            },
          }).catch((err) => {
            logger.error('Failed to log audit entry:', err);
          });
        }
      }

      return originalSend(data);
    };

    next();
  };
}

/**
 * Simple audit middleware that logs based on request params/body
 * Use this when you don't need to capture old values
 */
export function simpleAuditMiddleware(entityType: string, getIdFromRequest: (req: Request) => string) {
  return auditMiddleware({
    entityType,
    getEntityId: getIdFromRequest,
  });
}
