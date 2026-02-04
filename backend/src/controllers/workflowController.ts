import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { lookaheadService } from '../services/index.js';
import { notifyApprovalStatus, notifyLookaheadUpdate } from '../services/socketService.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class WorkflowController {
  /**
   * Get all pending approvals
   * Optionally filter by project
   */
  async getPendingApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.query;

      const whereClause: Record<string, unknown> = { status: 'pending' };

      if (projectId) {
        whereClause.lookaheadSchedule = {
          projectId: projectId as string,
        };
      }

      const approvals = await prisma.workflowApproval.findMany({
        where: whereClause,
        include: {
          lookaheadSchedule: {
            include: {
              project: {
                select: { id: true, name: true },
              },
              masterSchedule: {
                select: { id: true, name: true },
              },
            },
          },
          submitter: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(approvals);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific approval by ID
   */
  async getApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { approvalId } = req.params;

      const approval = await prisma.workflowApproval.findUnique({
        where: { id: approvalId },
        include: {
          lookaheadSchedule: {
            include: {
              activities: true,
              project: {
                select: { id: true, name: true },
              },
              masterSchedule: {
                select: { id: true, name: true },
              },
            },
          },
          submitter: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          approver: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          history: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!approval) {
        throw new NotFoundError('Approval not found');
      }

      res.json(approval);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve a workflow request
   * Merges approved changes to master schedule
   */
  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { approvalId } = req.params;
      const { notes } = req.body;
      const userId = req.user!.id;

      // Get the approval
      const approval = await prisma.workflowApproval.findUnique({
        where: { id: approvalId },
        include: {
          lookaheadSchedule: true,
        },
      });

      if (!approval) {
        throw new NotFoundError('Approval not found');
      }

      if (approval.status !== 'pending') {
        throw new BadRequestError(`Cannot approve: approval is already ${approval.status}`);
      }

      // Update approval status
      const updatedApproval = await prisma.workflowApproval.update({
        where: { id: approvalId },
        data: {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });

      // Record in workflow history
      await prisma.workflowHistory.create({
        data: {
          approvalId,
          action: 'approved',
          performedBy: userId,
          details: { notes },
        },
      });

      // Merge approved changes to master schedule
      await lookaheadService.mergeToMaster(approvalId);

      // Notify connected clients
      notifyApprovalStatus(approval.lookaheadScheduleId, {
        status: 'approved',
        approvalId,
        approvedBy: userId,
      });

      notifyLookaheadUpdate(approval.lookaheadScheduleId, {
        type: 'approval_granted',
        approvalId,
      });

      logger.info(`Approval ${approvalId} approved by user ${userId}`);

      res.json({
        message: 'Approval granted and changes merged to master schedule',
        approval: updatedApproval,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject a workflow request
   * Returns lookahead to active status for revision
   */
  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { approvalId } = req.params;
      const { reason, category } = req.body;
      const userId = req.user!.id;

      if (!reason) {
        throw new BadRequestError('Rejection reason is required');
      }

      // Get the approval
      const approval = await prisma.workflowApproval.findUnique({
        where: { id: approvalId },
        include: {
          lookaheadSchedule: true,
        },
      });

      if (!approval) {
        throw new NotFoundError('Approval not found');
      }

      if (approval.status !== 'pending') {
        throw new BadRequestError(`Cannot reject: approval is already ${approval.status}`);
      }

      // Update approval status
      const updatedApproval = await prisma.workflowApproval.update({
        where: { id: approvalId },
        data: {
          status: 'rejected',
          rejectionReason: reason,
          rejectionCategory: category,
        },
      });

      // Record in workflow history
      await prisma.workflowHistory.create({
        data: {
          approvalId,
          action: 'rejected',
          performedBy: userId,
          details: { reason, category },
        },
      });

      // Update lookahead status back to active
      await prisma.lookaheadSchedule.update({
        where: { id: approval.lookaheadScheduleId },
        data: { status: 'active' },
      });

      // Reset committed flags on activities so they can be edited again
      await prisma.lookaheadActivity.updateMany({
        where: {
          lookaheadScheduleId: approval.lookaheadScheduleId,
          isCommitted: true,
        },
        data: {
          isCommitted: false,
          hasPostCommitTweaks: false,
        },
      });

      // Notify connected clients
      notifyApprovalStatus(approval.lookaheadScheduleId, {
        status: 'rejected',
        approvalId,
        rejectedBy: userId,
        reason,
        category,
      });

      notifyLookaheadUpdate(approval.lookaheadScheduleId, {
        type: 'approval_rejected',
        approvalId,
        reason,
      });

      logger.info(`Approval ${approvalId} rejected by user ${userId}: ${reason}`);

      res.json({
        message: 'Approval rejected',
        approval: updatedApproval,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get workflow history for an approval
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { approvalId } = req.params;

      const history = await prisma.workflowHistory.findMany({
        where: { approvalId },
        orderBy: { createdAt: 'desc' },
      });

      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get approval statistics for a project
   */
  async getStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      const [pending, approved, rejected, total] = await Promise.all([
        prisma.workflowApproval.count({
          where: {
            status: 'pending',
            lookaheadSchedule: { projectId },
          },
        }),
        prisma.workflowApproval.count({
          where: {
            status: 'approved',
            lookaheadSchedule: { projectId },
          },
        }),
        prisma.workflowApproval.count({
          where: {
            status: 'rejected',
            lookaheadSchedule: { projectId },
          },
        }),
        prisma.workflowApproval.count({
          where: {
            lookaheadSchedule: { projectId },
          },
        }),
      ]);

      // Get average approval time
      const approvedWithTime = await prisma.workflowApproval.findMany({
        where: {
          status: 'approved',
          lookaheadSchedule: { projectId },
          approvedAt: { not: null },
        },
        select: {
          createdAt: true,
          approvedAt: true,
        },
      });

      let averageApprovalTimeHours = 0;
      if (approvedWithTime.length > 0) {
        const totalTime = approvedWithTime.reduce((sum, a) => {
          const created = new Date(a.createdAt).getTime();
          const approved = new Date(a.approvedAt!).getTime();
          return sum + (approved - created);
        }, 0);
        averageApprovalTimeHours = totalTime / approvedWithTime.length / (1000 * 60 * 60);
      }

      res.json({
        pending,
        approved,
        rejected,
        total,
        approvalRate: total > 0 ? (approved / total) * 100 : 0,
        rejectionRate: total > 0 ? (rejected / total) * 100 : 0,
        averageApprovalTimeHours: Math.round(averageApprovalTimeHours * 10) / 10,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get recent approvals for a user
   */
  async getMyApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { status, limit = 10 } = req.query;

      const whereClause: Record<string, unknown> = {
        submittedBy: userId,
      };

      if (status) {
        whereClause.status = status as string;
      }

      const approvals = await prisma.workflowApproval.findMany({
        where: whereClause,
        include: {
          lookaheadSchedule: {
            select: { id: true, name: true, projectId: true },
          },
          approver: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
      });

      res.json(approvals);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get approvals requiring my review
   */
  async getApprovalsToReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId, limit = 20 } = req.query;

      const whereClause: Record<string, unknown> = {
        status: 'pending',
      };

      if (projectId) {
        whereClause.lookaheadSchedule = {
          projectId: projectId as string,
        };
      }

      const approvals = await prisma.workflowApproval.findMany({
        where: whereClause,
        include: {
          lookaheadSchedule: {
            include: {
              project: {
                select: { id: true, name: true },
              },
            },
          },
          submitter: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'asc' }, // Oldest first
        take: Number(limit),
      });

      res.json({
        approvals,
        count: approvals.length,
      });
    } catch (error) {
      next(error);
    }
  }
}
