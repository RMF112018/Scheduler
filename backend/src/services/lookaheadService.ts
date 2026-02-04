import { prisma } from '../config/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  Prisma,
  LookaheadSchedule,
  LookaheadActivity,
  WorkflowApproval,
  ScheduleActivity,
} from '@prisma/client';

// Types
export interface CreateLookaheadDto {
  masterScheduleId: string;
  projectId: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface UpdateLookaheadActivityDto {
  startDate?: Date;
  finishDate?: Date;
  duration?: number;
  percentComplete?: number;
  plannerStatus?: 'should_do' | 'will_do';
  metadata?: Prisma.JsonValue;
}

export interface Conflict {
  type: 'zero_float_violation' | 'resource_conflict' | 'date_conflict' | 'predecessor_conflict';
  activityId: string;
  activityName: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  details?: Record<string, unknown>;
}

export interface MergeResult {
  added: number;
  updated: number;
  unchanged: number;
  conflicts: Conflict[];
}

export interface CommitResult {
  approvalId: string;
  activitiesCommitted: number;
  hasConflicts: boolean;
  conflicts: Conflict[];
}

export interface LookaheadWithActivities extends LookaheadSchedule {
  activities: LookaheadActivity[];
}

/**
 * LookaheadService - Handles lookahead schedule operations with Last Planner methodology
 * 
 * Key Features:
 * - One-way pull from master schedule (preserves master integrity)
 * - "Should Do" / "Will Do" status tracking (Last Planner methodology)
 * - Commit lock mechanism with immutable snapshots
 * - Post-commit tweak tracking
 * - Conflict detection (zero-float violations, resource conflicts)
 */
export class LookaheadService {
  /**
   * Create a new lookahead schedule
   */
  async create(data: CreateLookaheadDto): Promise<LookaheadSchedule> {
    // Verify master schedule exists
    const masterSchedule = await prisma.schedule.findUnique({
      where: { id: data.masterScheduleId },
    });

    if (!masterSchedule) {
      throw new NotFoundError('Master schedule not found');
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Validate date range
    if (data.startDate >= data.endDate) {
      throw new BadRequestError('Start date must be before end date');
    }

    const lookahead = await prisma.lookaheadSchedule.create({
      data: {
        masterScheduleId: data.masterScheduleId,
        projectId: data.projectId,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'active',
      },
    });

    logger.info(`Lookahead schedule created: ${lookahead.id} for master schedule ${data.masterScheduleId}`);
    return lookahead;
  }

  /**
   * Get a lookahead schedule by ID with optional includes
   */
  async findById(
    lookaheadId: string,
    options: { includeActivities?: boolean } = {}
  ): Promise<LookaheadWithActivities> {
    const lookahead = await prisma.lookaheadSchedule.findUnique({
      where: { id: lookaheadId },
      include: {
        activities: options.includeActivities ?? true,
      },
    });

    if (!lookahead) {
      throw new NotFoundError('Lookahead schedule not found');
    }

    return lookahead as LookaheadWithActivities;
  }

  /**
   * Pull activities from master schedule into lookahead
   * One-way pull: copies activities from master to lookahead while preserving local edits
   */
  async pullFromMaster(lookaheadId: string): Promise<MergeResult> {
    const lookahead = await this.findById(lookaheadId, { includeActivities: true });

    // Get master schedule activities within lookahead date range
    const masterActivities = await prisma.scheduleActivity.findMany({
      where: {
        scheduleId: lookahead.masterScheduleId,
        OR: [
          // Activities that start within the lookahead period
          {
            startDate: { gte: lookahead.startDate, lte: lookahead.endDate },
          },
          // Activities that end within the lookahead period
          {
            finishDate: { gte: lookahead.startDate, lte: lookahead.endDate },
          },
          // Activities that span the entire lookahead period
          {
            AND: [
              { startDate: { lte: lookahead.startDate } },
              { finishDate: { gte: lookahead.endDate } },
            ],
          },
        ],
      },
    });

    // Merge activities
    const result = await this.mergeActivities(lookahead, masterActivities);

    // Update last synced timestamp
    await prisma.lookaheadSchedule.update({
      where: { id: lookaheadId },
      data: { lastSyncedAt: new Date() },
    });

    logger.info(
      `Pulled from master for lookahead ${lookaheadId}: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged`
    );

    return result;
  }

  /**
   * Merge master activities into lookahead
   * Preserves local edits that haven't been committed or are marked as "will_do"
   */
  async mergeActivities(
    lookahead: LookaheadWithActivities,
    masterActivities: ScheduleActivity[]
  ): Promise<MergeResult> {
    const result: MergeResult = {
      added: 0,
      updated: 0,
      unchanged: 0,
      conflicts: [],
    };

    // Create a map of existing lookahead activities by persistent GUID
    const existingActivities = new Map(
      lookahead.activities.map((a) => [a.persistentInternalGuid, a])
    );

    for (const masterActivity of masterActivities) {
      const existingActivity = existingActivities.get(masterActivity.persistentInternalGuid);

      if (!existingActivity) {
        // New activity - add to lookahead
        await prisma.lookaheadActivity.create({
          data: {
            lookaheadScheduleId: lookahead.id,
            persistentInternalGuid: masterActivity.persistentInternalGuid,
            name: masterActivity.name,
            startDate: masterActivity.startDate,
            finishDate: masterActivity.finishDate,
            duration: masterActivity.duration,
            percentComplete: masterActivity.percentComplete,
            plannerStatus: null,
            hasConflict: false,
            isCommitted: false,
            hasPostCommitTweaks: false,
          },
        });
        result.added++;
      } else {
        // Existing activity - check if we should update
        const shouldUpdate = this.shouldUpdateFromMaster(existingActivity, masterActivity);

        if (shouldUpdate) {
          // Check for conflicts before updating
          const conflicts = await this.detectActivityConflicts(
            existingActivity,
            masterActivity,
            lookahead.masterScheduleId
          );

          if (conflicts.length > 0) {
            result.conflicts.push(...conflicts);
            // Flag the activity as having conflicts
            await prisma.lookaheadActivity.update({
              where: { id: existingActivity.id },
              data: { hasConflict: true },
            });
          } else {
            // Safe to update
            await prisma.lookaheadActivity.update({
              where: { id: existingActivity.id },
              data: {
                name: masterActivity.name,
                startDate: masterActivity.startDate,
                finishDate: masterActivity.finishDate,
                duration: masterActivity.duration,
                // Don't overwrite local progress if it's higher
                percentComplete: Math.max(
                  existingActivity.percentComplete,
                  masterActivity.percentComplete
                ),
              },
            });
            result.updated++;
          }
        } else {
          result.unchanged++;
        }
      }
    }

    return result;
  }

  /**
   * Determine if a lookahead activity should be updated from master
   * Preserves local edits for committed activities or those marked as "will_do"
   */
  private shouldUpdateFromMaster(
    lookaheadActivity: LookaheadActivity,
    _masterActivity: ScheduleActivity
  ): boolean {
    // Don't update if the activity is committed (waiting for approval)
    if (lookaheadActivity.isCommitted) {
      return false;
    }

    // Don't update if the user has marked it as "will_do" (active commitment)
    if (lookaheadActivity.plannerStatus === 'will_do') {
      return false;
    }

    // Update for all other cases
    return true;
  }

  /**
   * Mark task status using Last Planner methodology
   * "should_do" - Task is planned but not committed
   * "will_do" - Subcontractor commits to completing the task
   */
  async markTaskStatus(
    lookaheadId: string,
    activityId: string,
    status: 'should_do' | 'will_do',
    userId: string
  ): Promise<LookaheadActivity> {
    const activity = await prisma.lookaheadActivity.findFirst({
      where: {
        id: activityId,
        lookaheadScheduleId: lookaheadId,
      },
    });

    if (!activity) {
      throw new NotFoundError('Lookahead activity not found');
    }

    // Check for conflicts when marking as "will_do"
    let conflicts: Conflict[] = [];
    if (status === 'will_do') {
      const lookahead = await this.findById(lookaheadId);
      conflicts = await this.detectConflicts(lookaheadId, activityId);

      if (conflicts.length > 0) {
        // Flag the activity but still allow the status change
        await prisma.lookaheadActivity.update({
          where: { id: activityId },
          data: { hasConflict: true },
        });
      }
    }

    const updatedActivity = await prisma.lookaheadActivity.update({
      where: { id: activityId },
      data: {
        plannerStatus: status,
        plannerUpdatedBy: userId,
        plannerUpdatedAt: new Date(),
      },
    });

    logger.info(
      `Activity ${activityId} marked as "${status}" by user ${userId}${
        conflicts.length > 0 ? ` (${conflicts.length} conflicts detected)` : ''
      }`
    );

    return updatedActivity;
  }

  /**
   * Update a lookahead activity
   * Tracks post-commit tweaks if activity is already committed
   */
  async updateActivity(
    lookaheadId: string,
    activityId: string,
    data: UpdateLookaheadActivityDto
  ): Promise<LookaheadActivity> {
    const activity = await prisma.lookaheadActivity.findFirst({
      where: {
        id: activityId,
        lookaheadScheduleId: lookaheadId,
      },
    });

    if (!activity) {
      throw new NotFoundError('Lookahead activity not found');
    }

    // Check if this is a post-commit tweak
    const isPostCommitTweak = activity.isCommitted;

    const updatedActivity = await prisma.lookaheadActivity.update({
      where: { id: activityId },
      data: {
        startDate: data.startDate,
        finishDate: data.finishDate,
        duration: data.duration,
        percentComplete: data.percentComplete,
        plannerStatus: data.plannerStatus,
        metadata: data.metadata,
        hasPostCommitTweaks: isPostCommitTweak ? true : activity.hasPostCommitTweaks,
        updatedAt: new Date(),
      },
    });

    // If post-commit tweak, also flag the approval
    if (isPostCommitTweak) {
      await this.flagPostCommitTweak(lookaheadId, activityId);
    }

    return updatedActivity;
  }

  /**
   * Commit changes in the lookahead for approval
   * Creates an immutable snapshot that will be reviewed by PM/Superintendent
   */
  async commitChanges(lookaheadId: string, userId: string): Promise<CommitResult> {
    const lookahead = await this.findById(lookaheadId, { includeActivities: true });

    if (lookahead.status === 'submitted') {
      throw new BadRequestError('Lookahead is already submitted for approval');
    }

    // Get uncommitted changes (activities that have been modified)
    const uncommittedActivities = lookahead.activities.filter(
      (a) => a.plannerStatus === 'will_do' && !a.isCommitted
    );

    if (uncommittedActivities.length === 0) {
      throw new BadRequestError('No uncommitted changes to commit');
    }

    // Detect conflicts before committing
    const allConflicts: Conflict[] = [];
    for (const activity of uncommittedActivities) {
      const conflicts = await this.detectConflicts(lookaheadId, activity.id);
      allConflicts.push(...conflicts);
    }

    // Create commit snapshot
    const commitSnapshot = {
      createdAt: new Date().toISOString(),
      lookaheadId,
      totalActivities: uncommittedActivities.length,
      activities: uncommittedActivities.map((a) => ({
        id: a.id,
        persistentInternalGuid: a.persistentInternalGuid,
        name: a.name,
        startDate: a.startDate.toISOString(),
        finishDate: a.finishDate.toISOString(),
        duration: a.duration,
        percentComplete: a.percentComplete,
        plannerStatus: a.plannerStatus,
      })),
      conflicts: allConflicts,
    };

    // Create workflow approval
    const approval = await prisma.workflowApproval.create({
      data: {
        lookaheadScheduleId: lookaheadId,
        submittedBy: userId,
        status: 'pending',
        commitSnapshot,
        hasPostCommitTweaks: false,
      },
    });

    // Mark activities as committed
    await prisma.lookaheadActivity.updateMany({
      where: {
        id: { in: uncommittedActivities.map((a) => a.id) },
      },
      data: {
        isCommitted: true,
        hasPostCommitTweaks: false,
      },
    });

    // Update lookahead status
    await prisma.lookaheadSchedule.update({
      where: { id: lookaheadId },
      data: { status: 'submitted' },
    });

    // Record in workflow history
    await prisma.workflowHistory.create({
      data: {
        approvalId: approval.id,
        action: 'submitted',
        performedBy: userId,
        details: {
          activitiesCount: uncommittedActivities.length,
          conflictsCount: allConflicts.length,
        },
      },
    });

    logger.info(
      `Lookahead ${lookaheadId} committed by user ${userId}: ${uncommittedActivities.length} activities, ${allConflicts.length} conflicts`
    );

    return {
      approvalId: approval.id,
      activitiesCommitted: uncommittedActivities.length,
      hasConflicts: allConflicts.length > 0,
      conflicts: allConflicts,
    };
  }

  /**
   * Detect conflicts for a lookahead activity
   * Checks for zero-float violations, resource conflicts, and date conflicts
   */
  async detectConflicts(lookaheadId: string, activityId?: string): Promise<Conflict[]> {
    const lookahead = await this.findById(lookaheadId, { includeActivities: true });
    const conflicts: Conflict[] = [];

    // Get master schedule activities for comparison
    const masterActivities = await prisma.scheduleActivity.findMany({
      where: { scheduleId: lookahead.masterScheduleId },
    });

    const masterActivityMap = new Map(
      masterActivities.map((a) => [a.persistentInternalGuid, a])
    );

    // Determine which activities to check
    const activitiesToCheck = activityId
      ? lookahead.activities.filter((a) => a.id === activityId)
      : lookahead.activities;

    for (const lookaheadActivity of activitiesToCheck) {
      const masterActivity = masterActivityMap.get(lookaheadActivity.persistentInternalGuid);

      if (!masterActivity) continue;

      // Check for zero-float violations
      const zeroFloatConflicts = this.checkZeroFloatViolation(lookaheadActivity, masterActivity);
      conflicts.push(...zeroFloatConflicts);

      // Check for date conflicts (finish date after master)
      const dateConflicts = this.checkDateConflicts(lookaheadActivity, masterActivity);
      conflicts.push(...dateConflicts);

      // Check for predecessor conflicts
      const predecessorConflicts = await this.checkPredecessorConflicts(
        lookaheadActivity,
        masterActivity,
        lookahead.activities,
        masterActivityMap
      );
      conflicts.push(...predecessorConflicts);
    }

    return conflicts;
  }

  /**
   * Check for zero-float violations
   * Critical path activities with zero float cannot be delayed
   */
  private checkZeroFloatViolation(
    lookaheadActivity: LookaheadActivity,
    masterActivity: ScheduleActivity
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    // Check if master activity is on critical path (zero float)
    if (masterActivity.totalFloat === 0 || masterActivity.isCritical) {
      const lookaheadFinish = new Date(lookaheadActivity.finishDate);
      const masterFinish = new Date(masterActivity.finishDate);

      // If lookahead finish is later than master finish, it's a violation
      if (lookaheadFinish > masterFinish) {
        const delayDays = Math.ceil(
          (lookaheadFinish.getTime() - masterFinish.getTime()) / (1000 * 60 * 60 * 24)
        );

        conflicts.push({
          type: 'zero_float_violation',
          activityId: lookaheadActivity.id,
          activityName: lookaheadActivity.name,
          severity: 'high',
          message: `Adding ${delayDays} day(s) to zero-float task will delay critical path`,
          details: {
            masterFinishDate: masterFinish.toISOString(),
            lookaheadFinishDate: lookaheadFinish.toISOString(),
            delayDays,
            totalFloat: masterActivity.totalFloat,
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * Check for date conflicts
   */
  private checkDateConflicts(
    lookaheadActivity: LookaheadActivity,
    masterActivity: ScheduleActivity
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    const lookaheadStart = new Date(lookaheadActivity.startDate);
    const masterStart = new Date(masterActivity.startDate);

    // Check if lookahead start is significantly earlier than master
    // This could indicate unrealistic planning
    const daysDiff = Math.ceil(
      (masterStart.getTime() - lookaheadStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > 7) {
      conflicts.push({
        type: 'date_conflict',
        activityId: lookaheadActivity.id,
        activityName: lookaheadActivity.name,
        severity: 'medium',
        message: `Activity scheduled ${daysDiff} days earlier than master schedule`,
        details: {
          masterStartDate: masterStart.toISOString(),
          lookaheadStartDate: lookaheadStart.toISOString(),
          daysDifference: daysDiff,
        },
      });
    }

    return conflicts;
  }

  /**
   * Check for predecessor conflicts
   * Ensures activity doesn't start before its predecessors finish
   */
  private async checkPredecessorConflicts(
    lookaheadActivity: LookaheadActivity,
    masterActivity: ScheduleActivity,
    allLookaheadActivities: LookaheadActivity[],
    masterActivityMap: Map<string, ScheduleActivity>
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Get predecessor IDs from master activity
    const predecessorIds = masterActivity.predecessorIds;

    for (const predId of predecessorIds) {
      // Find the predecessor in master
      const masterPredecessor = Array.from(masterActivityMap.values()).find(
        (a) => a.id === predId
      );

      if (!masterPredecessor) continue;

      // Find corresponding lookahead predecessor
      const lookaheadPredecessor = allLookaheadActivities.find(
        (a) => a.persistentInternalGuid === masterPredecessor.persistentInternalGuid
      );

      if (!lookaheadPredecessor) continue;

      const predFinish = new Date(lookaheadPredecessor.finishDate);
      const actStart = new Date(lookaheadActivity.startDate);

      // Check if activity starts before predecessor finishes
      if (actStart < predFinish) {
        const overlapDays = Math.ceil(
          (predFinish.getTime() - actStart.getTime()) / (1000 * 60 * 60 * 24)
        );

        conflicts.push({
          type: 'predecessor_conflict',
          activityId: lookaheadActivity.id,
          activityName: lookaheadActivity.name,
          severity: 'high',
          message: `Activity starts ${overlapDays} day(s) before predecessor "${lookaheadPredecessor.name}" finishes`,
          details: {
            predecessorId: lookaheadPredecessor.id,
            predecessorName: lookaheadPredecessor.name,
            predecessorFinishDate: predFinish.toISOString(),
            activityStartDate: actStart.toISOString(),
            overlapDays,
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect conflicts for a specific activity (used during merge)
   */
  private async detectActivityConflicts(
    lookaheadActivity: LookaheadActivity,
    masterActivity: ScheduleActivity,
    masterScheduleId: string
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Check for zero-float violations
    const zeroFloatConflicts = this.checkZeroFloatViolation(lookaheadActivity, masterActivity);
    conflicts.push(...zeroFloatConflicts);

    return conflicts;
  }

  /**
   * Flag post-commit tweaks on the approval
   */
  private async flagPostCommitTweak(lookaheadId: string, activityId: string): Promise<void> {
    // Find pending approval for this lookahead
    const approval = await prisma.workflowApproval.findFirst({
      where: {
        lookaheadScheduleId: lookaheadId,
        status: 'pending',
      },
    });

    if (approval) {
      await prisma.workflowApproval.update({
        where: { id: approval.id },
        data: { hasPostCommitTweaks: true },
      });

      logger.info(`Post-commit tweak flagged for approval ${approval.id}, activity ${activityId}`);
    }
  }

  /**
   * Get uncommitted changes for a lookahead
   */
  async getUncommittedChanges(lookaheadId: string): Promise<LookaheadActivity[]> {
    return prisma.lookaheadActivity.findMany({
      where: {
        lookaheadScheduleId: lookaheadId,
        isCommitted: false,
        plannerStatus: 'will_do',
      },
    });
  }

  /**
   * Get pending approval for a lookahead
   */
  async getPendingApproval(lookaheadId: string): Promise<WorkflowApproval | null> {
    return prisma.workflowApproval.findFirst({
      where: {
        lookaheadScheduleId: lookaheadId,
        status: 'pending',
      },
    });
  }

  /**
   * Merge approved lookahead changes to master schedule
   * Called after approval is granted
   */
  async mergeToMaster(approvalId: string): Promise<void> {
    const approval = await prisma.workflowApproval.findUnique({
      where: { id: approvalId },
      include: {
        lookaheadSchedule: {
          include: { activities: true },
        },
      },
    });

    if (!approval) {
      throw new NotFoundError('Approval not found');
    }

    if (approval.status !== 'approved') {
      throw new BadRequestError('Can only merge approved changes');
    }

    const lookahead = approval.lookaheadSchedule;
    const committedActivities = lookahead.activities.filter((a) => a.isCommitted);

    // Update master schedule activities with lookahead data
    for (const lookaheadActivity of committedActivities) {
      await prisma.scheduleActivity.updateMany({
        where: {
          scheduleId: lookahead.masterScheduleId,
          persistentInternalGuid: lookaheadActivity.persistentInternalGuid,
        },
        data: {
          startDate: lookaheadActivity.startDate,
          finishDate: lookaheadActivity.finishDate,
          duration: lookaheadActivity.duration,
          percentComplete: lookaheadActivity.percentComplete,
          updatedAt: new Date(),
        },
      });
    }

    // Create a version history entry
    const latestVersion = await prisma.lookaheadVersion.findFirst({
      where: { lookaheadScheduleId: lookahead.id },
      orderBy: { versionNumber: 'desc' },
    });

    await prisma.lookaheadVersion.create({
      data: {
        lookaheadScheduleId: lookahead.id,
        versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
        approvedBy: approval.approvedBy,
        snapshotData: approval.commitSnapshot ?? {},
      },
    });

    // Reset committed flags on lookahead activities
    await prisma.lookaheadActivity.updateMany({
      where: {
        lookaheadScheduleId: lookahead.id,
        isCommitted: true,
      },
      data: {
        isCommitted: false,
        hasPostCommitTweaks: false,
      },
    });

    // Update lookahead status
    await prisma.lookaheadSchedule.update({
      where: { id: lookahead.id },
      data: { status: 'active' },
    });

    logger.info(
      `Merged ${committedActivities.length} activities from lookahead ${lookahead.id} to master schedule ${lookahead.masterScheduleId}`
    );
  }

  /**
   * Get lookahead schedules for a project
   */
  async findByProject(projectId: string): Promise<LookaheadSchedule[]> {
    return prisma.lookaheadSchedule.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get lookahead schedules for a master schedule
   */
  async findByMasterSchedule(masterScheduleId: string): Promise<LookaheadSchedule[]> {
    return prisma.lookaheadSchedule.findMany({
      where: { masterScheduleId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a lookahead schedule
   */
  async delete(lookaheadId: string): Promise<void> {
    const lookahead = await prisma.lookaheadSchedule.findUnique({
      where: { id: lookaheadId },
    });

    if (!lookahead) {
      throw new NotFoundError('Lookahead schedule not found');
    }

    if (lookahead.status === 'submitted') {
      throw new BadRequestError('Cannot delete lookahead with pending approval');
    }

    await prisma.lookaheadSchedule.delete({
      where: { id: lookaheadId },
    });

    logger.info(`Lookahead schedule deleted: ${lookaheadId}`);
  }
}

// Export singleton instance
export const lookaheadService = new LookaheadService();
