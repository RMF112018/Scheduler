import { Request, Response, NextFunction } from 'express';
import { lookaheadService } from '../services/index.js';
import { notifyLookaheadUpdate, notifyApprovalStatus } from '../services/socketService.js';

export class LookaheadController {
  /**
   * Get a lookahead schedule by ID
   */
  async getLookahead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId } = req.params;
      const lookahead = await lookaheadService.findById(lookaheadId, { includeActivities: true });
      res.json(lookahead);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all lookahead schedules for a project
   */
  async getLookaheadsByProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const lookaheads = await lookaheadService.findByProject(projectId);
      res.json(lookaheads);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all lookahead schedules for a master schedule
   */
  async getLookaheadsBySchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scheduleId } = req.params;
      const lookaheads = await lookaheadService.findByMasterSchedule(scheduleId);
      res.json(lookaheads);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new lookahead schedule
   */
  async createLookahead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { masterScheduleId, projectId, name, startDate, endDate } = req.body;

      const lookahead = await lookaheadService.create({
        masterScheduleId,
        projectId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      res.status(201).json(lookahead);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Pull activities from master schedule into lookahead
   * One-way pull that preserves local edits
   */
  async pullFromMaster(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId } = req.params;

      const result = await lookaheadService.pullFromMaster(lookaheadId);

      // Notify connected clients of the update
      notifyLookaheadUpdate(lookaheadId, {
        type: 'pull_from_master',
        result,
      });

      res.json({
        message: 'Successfully pulled from master schedule',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark task status using Last Planner methodology
   * Status: "should_do" or "will_do"
   */
  async markTaskStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId, activityId } = req.params;
      const { status } = req.body;
      const userId = req.user!.id;

      const activity = await lookaheadService.markTaskStatus(
        lookaheadId,
        activityId,
        status,
        userId
      );

      // Check for conflicts if marking as "will_do"
      let conflicts = [];
      if (status === 'will_do') {
        conflicts = await lookaheadService.detectConflicts(lookaheadId, activityId);
      }

      // Notify connected clients
      notifyLookaheadUpdate(lookaheadId, {
        type: 'task_status_changed',
        activityId,
        status,
        conflicts,
      });

      res.json({
        activity,
        conflicts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a lookahead activity
   * Tracks post-commit tweaks if activity is already committed
   */
  async updateActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId, activityId } = req.params;
      const { startDate, finishDate, duration, percentComplete, plannerStatus, metadata } = req.body;

      const activity = await lookaheadService.updateActivity(lookaheadId, activityId, {
        startDate: startDate ? new Date(startDate) : undefined,
        finishDate: finishDate ? new Date(finishDate) : undefined,
        duration,
        percentComplete,
        plannerStatus,
        metadata,
      });

      // Notify connected clients
      notifyLookaheadUpdate(lookaheadId, {
        type: 'activity_updated',
        activity,
      });

      res.json(activity);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Commit changes for approval
   * Creates an immutable snapshot that will be reviewed by PM/Superintendent
   */
  async commitChanges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId } = req.params;
      const userId = req.user!.id;

      const result = await lookaheadService.commitChanges(lookaheadId, userId);

      // Notify connected clients
      notifyLookaheadUpdate(lookaheadId, {
        type: 'changes_committed',
        approvalId: result.approvalId,
        activitiesCommitted: result.activitiesCommitted,
      });

      // Notify approval status
      notifyApprovalStatus(lookaheadId, {
        status: 'pending',
        approvalId: result.approvalId,
        submittedBy: userId,
      });

      res.json({
        message: 'Changes committed for approval',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check for conflicts in the lookahead
   * Can check all activities or a specific activity
   */
  async checkConflicts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId } = req.params;
      const { activityId } = req.query;

      const conflicts = await lookaheadService.detectConflicts(
        lookaheadId,
        activityId as string | undefined
      );

      res.json({
        conflicts,
        hasConflicts: conflicts.length > 0,
        summary: {
          total: conflicts.length,
          high: conflicts.filter((c) => c.severity === 'high').length,
          medium: conflicts.filter((c) => c.severity === 'medium').length,
          low: conflicts.filter((c) => c.severity === 'low').length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get uncommitted changes in the lookahead
   */
  async getUncommittedChanges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId } = req.params;

      const activities = await lookaheadService.getUncommittedChanges(lookaheadId);

      res.json({
        activities,
        count: activities.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get pending approval for a lookahead
   */
  async getPendingApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId } = req.params;

      const approval = await lookaheadService.getPendingApproval(lookaheadId);

      if (!approval) {
        res.json({ hasPendingApproval: false });
        return;
      }

      res.json({
        hasPendingApproval: true,
        approval,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a lookahead schedule
   */
  async deleteLookahead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { lookaheadId } = req.params;

      await lookaheadService.delete(lookaheadId);

      res.json({ message: 'Lookahead schedule deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
