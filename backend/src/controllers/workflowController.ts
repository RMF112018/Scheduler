import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export class WorkflowController {
  async getPendingApprovals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const approvals = await prisma.workflowApproval.findMany({
        where: { status: 'pending' },
        include: {
          lookaheadSchedule: true,
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

  async getApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { approvalId } = req.params;

      const approval = await prisma.workflowApproval.findUnique({
        where: { id: approvalId },
        include: {
          lookaheadSchedule: {
            include: { activities: true },
          },
          submitter: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          approver: {
            select: { id: true, firstName: true, lastName: true, email: true },
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

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { approvalId } = req.params;

      const approval = await prisma.workflowApproval.update({
        where: { id: approvalId },
        data: {
          status: 'approved',
          approvedBy: req.user!.id,
          approvedAt: new Date(),
        },
      });

      // Update lookahead status
      await prisma.lookaheadSchedule.update({
        where: { id: approval.lookaheadScheduleId },
        data: { status: 'approved' },
      });

      // TODO: Merge approved changes to master schedule

      res.json({
        message: 'Approval granted',
        approval,
      });
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { approvalId } = req.params;
      const { reason, category } = req.body;

      const approval = await prisma.workflowApproval.update({
        where: { id: approvalId },
        data: {
          status: 'rejected',
          rejectionReason: reason,
          rejectionCategory: category,
        },
      });

      // Update lookahead status back to active
      await prisma.lookaheadSchedule.update({
        where: { id: approval.lookaheadScheduleId },
        data: { status: 'active' },
      });

      res.json({
        message: 'Approval rejected',
        approval,
      });
    } catch (error) {
      next(error);
    }
  }

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
}
