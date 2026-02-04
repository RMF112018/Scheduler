import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export class LookaheadController {
  async getLookahead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId } = req.params;

      const lookahead = await prisma.lookaheadSchedule.findUnique({
        where: { id: lookaheadId },
        include: {
          activities: true,
        },
      });

      if (!lookahead) {
        throw new NotFoundError('Lookahead schedule not found');
      }

      res.json(lookahead);
    } catch (error) {
      next(error);
    }
  }

  async createLookahead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { masterScheduleId, projectId, name, startDate, endDate } = req.body;

      const lookahead = await prisma.lookaheadSchedule.create({
        data: {
          masterScheduleId,
          projectId,
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: 'active',
        },
      });

      res.status(201).json(lookahead);
    } catch (error) {
      next(error);
    }
  }

  async pullFromMaster(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId } = req.params;

      const lookahead = await prisma.lookaheadSchedule.findUnique({
        where: { id: lookaheadId },
      });

      if (!lookahead) {
        throw new NotFoundError('Lookahead schedule not found');
      }

      // Get master schedule activities within lookahead date range
      const masterActivities = await prisma.scheduleActivity.findMany({
        where: {
          scheduleId: lookahead.masterScheduleId,
          startDate: { gte: lookahead.startDate },
          finishDate: { lte: lookahead.endDate },
        },
      });

      // TODO: Implement proper merge logic
      // For now, just update lastSyncedAt
      await prisma.lookaheadSchedule.update({
        where: { id: lookaheadId },
        data: { lastSyncedAt: new Date() },
      });

      res.json({
        message: 'Pulled from master schedule',
        activitiesCount: masterActivities.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async markTaskStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId, activityId } = req.params;
      const { status } = req.body;

      const activity = await prisma.lookaheadActivity.update({
        where: {
          id: activityId,
          lookaheadScheduleId: lookaheadId,
        },
        data: {
          plannerStatus: status,
          plannerUpdatedBy: req.user!.id,
          plannerUpdatedAt: new Date(),
        },
      });

      res.json(activity);
    } catch (error) {
      next(error);
    }
  }

  async updateActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId, activityId } = req.params;
      const { startDate, finishDate, duration, percentComplete } = req.body;

      const activity = await prisma.lookaheadActivity.update({
        where: {
          id: activityId,
          lookaheadScheduleId: lookaheadId,
        },
        data: {
          startDate: startDate ? new Date(startDate) : undefined,
          finishDate: finishDate ? new Date(finishDate) : undefined,
          duration,
          percentComplete,
          updatedAt: new Date(),
        },
      });

      res.json(activity);
    } catch (error) {
      next(error);
    }
  }

  async commitChanges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId } = req.params;

      // Get lookahead with activities
      const lookahead = await prisma.lookaheadSchedule.findUnique({
        where: { id: lookaheadId },
        include: { activities: true },
      });

      if (!lookahead) {
        throw new NotFoundError('Lookahead schedule not found');
      }

      // Create workflow approval with commit snapshot
      const approval = await prisma.workflowApproval.create({
        data: {
          lookaheadScheduleId: lookaheadId,
          submittedBy: req.user!.id,
          status: 'pending',
          commitSnapshot: lookahead.activities as unknown as object,
        },
      });

      // Update lookahead status
      await prisma.lookaheadSchedule.update({
        where: { id: lookaheadId },
        data: { status: 'submitted' },
      });

      res.json({
        message: 'Changes committed for approval',
        approvalId: approval.id,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkConflicts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId } = req.params;
      const { activityId } = req.query;

      // TODO: Implement proper conflict detection
      // For now, return empty array
      res.json([]);
    } catch (error) {
      next(error);
    }
  }
}
