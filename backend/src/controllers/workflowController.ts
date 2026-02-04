import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { lookaheadService } from '../services/index.js';
import { notifyApprovalStatus, notifyLookaheadUpdate } from '../services/socketService.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Types for attachment approval
interface AttachmentApprovalDto {
  attachmentId: string;
  notes?: string;
}

interface AttachmentRejectionDto {
  attachmentId: string;
  reason: string;
}

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

  // ============================================================================
  // Attachment Approval Workflow
  // ============================================================================

  /**
   * Get pending attachments for a lookahead approval
   * Returns attachments that came from lookahead commits and need review
   */
  async getPendingAttachments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { approvalId } = req.params;
      const { status = 'pending' } = req.query;

      // Get the approval to find the lookahead
      const approval = await prisma.workflowApproval.findUnique({
        where: { id: approvalId },
        include: {
          lookaheadSchedule: {
            include: {
              activities: true,
            },
          },
        },
      });

      if (!approval) {
        throw new NotFoundError('Approval not found');
      }

      // Get all activity GUIDs from the lookahead
      const activityGuids = approval.lookaheadSchedule.activities.map(
        (a) => a.persistentInternalGuid
      );

      // Find attachments for these activities from lookahead source
      const attachments = await prisma.activityAttachment.findMany({
        where: {
          persistentInternalGuid: { in: activityGuids },
          sourceType: 'lookahead',
          lookaheadApprovalId: approvalId,
          ...(status !== 'all' && { status: status as string }),
        },
        include: {
          uploader: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          activity: {
            select: { id: true, name: true, activityCode: true },
          },
        },
        orderBy: { uploadedAt: 'desc' },
      });

      res.json({
        attachments,
        counts: {
          pending: attachments.filter((a) => a.status === 'pending').length,
          approved: attachments.filter((a) => a.status === 'approved').length,
          rejected: attachments.filter((a) => a.status === 'rejected').length,
          total: attachments.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve an attachment from lookahead
   * Promotes the attachment to the master activity
   */
  async approveAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;
      const { notes } = req.body;
      const userId = req.user!.id;

      const attachment = await prisma.activityAttachment.findUnique({
        where: { id: attachmentId },
        include: {
          activity: true,
        },
      });

      if (!attachment) {
        throw new NotFoundError('Attachment not found');
      }

      if (attachment.status !== 'pending') {
        throw new BadRequestError(`Cannot approve: attachment is already ${attachment.status}`);
      }

      if (attachment.sourceType !== 'lookahead') {
        throw new BadRequestError('Only lookahead attachments require approval');
      }

      // Update attachment status
      const updatedAttachment = await prisma.activityAttachment.update({
        where: { id: attachmentId },
        data: {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
          // Change source type to master since it's now promoted
          sourceType: 'master',
          metadata: {
            ...(attachment.metadata as Record<string, unknown> || {}),
            approvalNotes: notes,
            promotedAt: new Date().toISOString(),
            promotedBy: userId,
          },
        },
      });

      logger.info(`Attachment ${attachmentId} approved by user ${userId}`);

      res.json({
        message: 'Attachment approved and promoted to master',
        attachment: updatedAttachment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject an attachment from lookahead
   * Keeps attachment in lookahead with rejection reason
   */
  async rejectAttachment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attachmentId } = req.params;
      const { reason } = req.body;
      const userId = req.user!.id;

      if (!reason || reason.trim().length === 0) {
        throw new BadRequestError('Rejection reason is required');
      }

      const attachment = await prisma.activityAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment) {
        throw new NotFoundError('Attachment not found');
      }

      if (attachment.status !== 'pending') {
        throw new BadRequestError(`Cannot reject: attachment is already ${attachment.status}`);
      }

      if (attachment.sourceType !== 'lookahead') {
        throw new BadRequestError('Only lookahead attachments require approval');
      }

      // Update attachment status - keep sourceType as lookahead
      const updatedAttachment = await prisma.activityAttachment.update({
        where: { id: attachmentId },
        data: {
          status: 'rejected',
          rejectionReason: reason,
          metadata: {
            ...(attachment.metadata as Record<string, unknown> || {}),
            rejectedBy: userId,
            rejectedAt: new Date().toISOString(),
          },
        },
      });

      logger.info(`Attachment ${attachmentId} rejected by user ${userId}: ${reason}`);

      res.json({
        message: 'Attachment rejected',
        attachment: updatedAttachment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk approve/reject attachments
   */
  async bulkAttachmentAction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, attachmentIds, reason } = req.body;
      const userId = req.user!.id;

      if (!attachmentIds || !Array.isArray(attachmentIds) || attachmentIds.length === 0) {
        throw new BadRequestError('Attachment IDs are required');
      }

      if (!['approve', 'reject'].includes(action)) {
        throw new BadRequestError('Action must be "approve" or "reject"');
      }

      if (action === 'reject' && (!reason || reason.trim().length === 0)) {
        throw new BadRequestError('Rejection reason is required');
      }

      // Get all attachments
      const attachments = await prisma.activityAttachment.findMany({
        where: {
          id: { in: attachmentIds },
          status: 'pending',
          sourceType: 'lookahead',
        },
      });

      if (attachments.length === 0) {
        throw new BadRequestError('No valid pending attachments found');
      }

      // Perform bulk update
      const updateData = action === 'approve'
        ? {
            status: 'approved',
            approvedBy: userId,
            approvedAt: new Date(),
            sourceType: 'master',
          }
        : {
            status: 'rejected',
            rejectionReason: reason,
          };

      const result = await prisma.activityAttachment.updateMany({
        where: {
          id: { in: attachments.map((a) => a.id) },
        },
        data: updateData,
      });

      logger.info(
        `Bulk ${action} for ${result.count} attachments by user ${userId}`
      );

      res.json({
        message: `${result.count} attachments ${action}d`,
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get attachment approval statistics for a project
   */
  async getAttachmentStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      // Get all approvals for this project
      const approvals = await prisma.workflowApproval.findMany({
        where: {
          lookaheadSchedule: { projectId },
        },
        select: { id: true },
      });

      const approvalIds = approvals.map((a) => a.id);

      // Count attachments by status
      const [pending, approved, rejected] = await Promise.all([
        prisma.activityAttachment.count({
          where: {
            lookaheadApprovalId: { in: approvalIds },
            sourceType: 'lookahead',
            status: 'pending',
          },
        }),
        prisma.activityAttachment.count({
          where: {
            lookaheadApprovalId: { in: approvalIds },
            status: 'approved',
          },
        }),
        prisma.activityAttachment.count({
          where: {
            lookaheadApprovalId: { in: approvalIds },
            sourceType: 'lookahead',
            status: 'rejected',
          },
        }),
      ]);

      res.json({
        pending,
        approved,
        rejected,
        total: pending + approved + rejected,
        approvalRate: (pending + approved + rejected) > 0
          ? (approved / (pending + approved + rejected)) * 100
          : 0,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get review data for an approval (schedule changes + pending attachments)
   * Used by PM/Superintendent review screen
   */
  async getReviewData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { approvalId } = req.params;

      // Get approval with full details
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
          history: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!approval) {
        throw new NotFoundError('Approval not found');
      }

      // Get activity GUIDs
      const activityGuids = approval.lookaheadSchedule.activities.map(
        (a) => a.persistentInternalGuid
      );

      // Get pending attachments
      const pendingAttachments = await prisma.activityAttachment.findMany({
        where: {
          persistentInternalGuid: { in: activityGuids },
          sourceType: 'lookahead',
          lookaheadApprovalId: approvalId,
          status: 'pending',
        },
        include: {
          uploader: {
            select: { id: true, firstName: true, lastName: true },
          },
          activity: {
            select: { id: true, name: true, activityCode: true },
          },
        },
      });

      // Get committed activities (schedule changes)
      const committedActivities = approval.lookaheadSchedule.activities.filter(
        (a) => a.isCommitted
      );

      // Get master schedule activities for comparison
      const masterActivities = await prisma.scheduleActivity.findMany({
        where: {
          scheduleId: approval.lookaheadSchedule.masterScheduleId,
          persistentInternalGuid: {
            in: committedActivities.map((a) => a.persistentInternalGuid),
          },
        },
      });

      const masterActivityMap = new Map(
        masterActivities.map((a) => [a.persistentInternalGuid, a])
      );

      // Build schedule changes with diff
      const scheduleChanges = committedActivities.map((lookaheadActivity) => {
        const masterActivity = masterActivityMap.get(lookaheadActivity.persistentInternalGuid);

        return {
          id: lookaheadActivity.id,
          persistentInternalGuid: lookaheadActivity.persistentInternalGuid,
          name: lookaheadActivity.name,
          plannerStatus: lookaheadActivity.plannerStatus,
          hasPostCommitTweaks: lookaheadActivity.hasPostCommitTweaks,
          changes: masterActivity
            ? {
                startDate: {
                  from: masterActivity.startDate,
                  to: lookaheadActivity.startDate,
                  changed: masterActivity.startDate.getTime() !== lookaheadActivity.startDate.getTime(),
                },
                finishDate: {
                  from: masterActivity.finishDate,
                  to: lookaheadActivity.finishDate,
                  changed: masterActivity.finishDate.getTime() !== lookaheadActivity.finishDate.getTime(),
                },
                duration: {
                  from: masterActivity.duration,
                  to: lookaheadActivity.duration,
                  changed: masterActivity.duration !== lookaheadActivity.duration,
                },
                percentComplete: {
                  from: masterActivity.percentComplete,
                  to: lookaheadActivity.percentComplete,
                  changed: masterActivity.percentComplete !== lookaheadActivity.percentComplete,
                },
              }
            : null,
        };
      });

      res.json({
        approval: {
          id: approval.id,
          status: approval.status,
          submittedBy: approval.submitter,
          createdAt: approval.createdAt,
          hasPostCommitTweaks: approval.hasPostCommitTweaks,
          commitSnapshot: approval.commitSnapshot,
        },
        lookahead: {
          id: approval.lookaheadSchedule.id,
          name: approval.lookaheadSchedule.name,
          project: approval.lookaheadSchedule.project,
          masterSchedule: approval.lookaheadSchedule.masterSchedule,
        },
        scheduleChanges,
        pendingAttachments,
        history: approval.history,
        summary: {
          totalChanges: scheduleChanges.length,
          changesWithDiff: scheduleChanges.filter((c) => c.changes !== null).length,
          pendingAttachmentsCount: pendingAttachments.length,
          hasPostCommitTweaks: approval.hasPostCommitTweaks,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
