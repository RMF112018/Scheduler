/**
 * Audit Controller
 *
 * Phase 9: API endpoints for querying audit logs.
 */

import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/auditService.js';
import { BadRequestError } from '../utils/errors.js';

export class AuditController {
  /**
   * Query audit logs with filters
   * GET /api/v1/audit
   */
  async queryAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        entityType,
        entityId,
        userId,
        action,
        startDate,
        endDate,
        limit,
        offset,
      } = req.query;

      // Parse dates
      let startDateParsed: Date | undefined;
      let endDateParsed: Date | undefined;

      if (startDate) {
        startDateParsed = new Date(startDate as string);
        if (isNaN(startDateParsed.getTime())) {
          throw new BadRequestError('Invalid startDate format');
        }
      }

      if (endDate) {
        endDateParsed = new Date(endDate as string);
        if (isNaN(endDateParsed.getTime())) {
          throw new BadRequestError('Invalid endDate format');
        }
      }

      // Parse pagination
      const limitNum = limit ? parseInt(limit as string, 10) : 100;
      const offsetNum = offset ? parseInt(offset as string, 10) : 0;

      if (limitNum < 1 || limitNum > 1000) {
        throw new BadRequestError('Limit must be between 1 and 1000');
      }

      if (offsetNum < 0) {
        throw new BadRequestError('Offset must be >= 0');
      }

      // Only allow users to query their own company's audit logs
      const result = await auditService.queryAuditLogs({
        entityType: entityType as string | undefined,
        entityId: entityId as string | undefined,
        userId: userId as string | undefined,
        companyId: req.user!.companyId, // Enforce company scope
        action: action as 'create' | 'update' | 'delete' | undefined,
        startDate: startDateParsed,
        endDate: endDateParsed,
        limit: limitNum,
        offset: offsetNum,
      });

      res.json({
        success: true,
        data: result.logs,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get audit trail for a specific entity
   * GET /api/v1/audit/entity/:entityType/:entityId
   */
  async getEntityAuditTrail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entityType, entityId } = req.params;

      const result = await auditService.getEntityAuditTrail(entityType, entityId);

      // Filter by company to ensure security
      const filteredLogs = result.logs.filter(
        (log) => log.companyId === req.user!.companyId
      );

      res.json({
        success: true,
        data: filteredLogs,
        total: filteredLogs.length,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
