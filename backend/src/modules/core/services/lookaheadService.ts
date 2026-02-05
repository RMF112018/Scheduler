import { prisma } from '../../../config/database.js';
import { NotFoundError, BadRequestError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
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
  type: 
    | 'zero_float_violation' 
    | 'resource_conflict' 
    | 'resource_over_allocation'
    | 'date_conflict' 
    | 'predecessor_conflict'
    | 'out_of_sequence_risk'
    | 'near_critical_path';
  activityId: string;
  activityName: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  details?: Record<string, unknown>;
}

// Configuration for conflict detection thresholds
export interface ConflictDetectionConfig {
  nearCriticalFloatThreshold?: number; // Default: 5 days
  resourceOverAllocationThreshold?: number; // Default: 100% (1.0)
  enableResourceConflicts?: boolean;
  enableOutOfSequenceRisk?: boolean;
  enableNearCriticalWarnings?: boolean;
}

const DEFAULT_CONFLICT_CONFIG: Required<ConflictDetectionConfig> = {
  nearCriticalFloatThreshold: 5,
  resourceOverAllocationThreshold: 1.0,
  enableResourceConflicts: true,
  enableOutOfSequenceRisk: true,
  enableNearCriticalWarnings: true,
};

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
   * Checks for zero-float violations, resource conflicts, date conflicts,
   * out-of-sequence risks, and near-critical path warnings
   */
  async detectConflicts(
    lookaheadId: string, 
    activityId?: string,
    config: ConflictDetectionConfig = {}
  ): Promise<Conflict[]> {
    const mergedConfig = { ...DEFAULT_CONFLICT_CONFIG, ...config };
    const lookahead = await this.findById(lookaheadId, { includeActivities: true });
    const conflicts: Conflict[] = [];

    // Get master schedule activities for comparison
    const masterActivities = await prisma.scheduleActivity.findMany({
      where: { scheduleId: lookahead.masterScheduleId },
      include: {
        resourceAssignments: {
          include: {
            staffMember: true,
          },
        },
      },
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

      // Check for near-critical path warnings
      if (mergedConfig.enableNearCriticalWarnings) {
        const nearCriticalConflicts = this.checkNearCriticalPath(
          lookaheadActivity,
          masterActivity,
          mergedConfig.nearCriticalFloatThreshold
        );
        conflicts.push(...nearCriticalConflicts);
      }

      // Check for out-of-sequence risk
      if (mergedConfig.enableOutOfSequenceRisk) {
        const oosRiskConflicts = await this.checkOutOfSequenceRisk(
          lookaheadActivity,
          masterActivity,
          lookahead.activities,
          masterActivityMap
        );
        conflicts.push(...oosRiskConflicts);
      }
    }

    // Check for resource over-allocation across all activities in the lookahead period
    if (mergedConfig.enableResourceConflicts) {
      const resourceConflicts = await this.checkResourceOverAllocation(
        lookahead,
        activitiesToCheck,
        masterActivityMap,
        mergedConfig.resourceOverAllocationThreshold
      );
      conflicts.push(...resourceConflicts);
    }

    return conflicts;
  }

  /**
   * Check for near-critical path activities (float < threshold)
   * These activities are at risk of becoming critical if delayed
   */
  private checkNearCriticalPath(
    lookaheadActivity: LookaheadActivity,
    masterActivity: ScheduleActivity,
    floatThreshold: number
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    // Check if activity has low float (near-critical)
    if (
      masterActivity.totalFloat !== null &&
      masterActivity.totalFloat > 0 &&
      masterActivity.totalFloat <= floatThreshold &&
      !masterActivity.isCritical
    ) {
      // Calculate if lookahead changes would consume the remaining float
      const lookaheadFinish = new Date(lookaheadActivity.finishDate);
      const masterFinish = new Date(masterActivity.finishDate);
      const delayDays = Math.ceil(
        (lookaheadFinish.getTime() - masterFinish.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (delayDays > 0) {
        const remainingFloat = masterActivity.totalFloat - delayDays;
        
        conflicts.push({
          type: 'near_critical_path',
          activityId: lookaheadActivity.id,
          activityName: lookaheadActivity.name,
          severity: remainingFloat <= 0 ? 'high' : 'medium',
          message: remainingFloat <= 0
            ? `Activity "${lookaheadActivity.name}" will become critical path (${masterActivity.totalFloat} days float consumed by ${delayDays} day delay)`
            : `Activity "${lookaheadActivity.name}" has only ${remainingFloat} days float remaining after ${delayDays} day delay`,
          details: {
            originalFloat: masterActivity.totalFloat,
            delayDays,
            remainingFloat: Math.max(0, remainingFloat),
            willBecomeCritical: remainingFloat <= 0,
            masterFinishDate: masterFinish.toISOString(),
            lookaheadFinishDate: lookaheadFinish.toISOString(),
          },
        });
      } else if (masterActivity.totalFloat <= 2) {
        // Warn about very low float even without delay
        conflicts.push({
          type: 'near_critical_path',
          activityId: lookaheadActivity.id,
          activityName: lookaheadActivity.name,
          severity: 'low',
          message: `Activity "${lookaheadActivity.name}" has very low float (${masterActivity.totalFloat} days) - monitor closely`,
          details: {
            totalFloat: masterActivity.totalFloat,
            floatThreshold,
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * Check for out-of-sequence risk
   * Flags when lookahead dates suggest activity might start before predecessors complete
   */
  private async checkOutOfSequenceRisk(
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

      // Find corresponding lookahead predecessor (if it exists)
      const lookaheadPredecessor = allLookaheadActivities.find(
        (a) => a.persistentInternalGuid === masterPredecessor.persistentInternalGuid
      );

      // Determine predecessor finish date (use lookahead if available, else master)
      const predFinishDate = lookaheadPredecessor
        ? new Date(lookaheadPredecessor.finishDate)
        : new Date(masterPredecessor.finishDate);

      const actStartDate = new Date(lookaheadActivity.startDate);

      // Check if lookahead start is before predecessor finish
      if (actStartDate < predFinishDate) {
        const overlapDays = Math.ceil(
          (predFinishDate.getTime() - actStartDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        conflicts.push({
          type: 'out_of_sequence_risk',
          activityId: lookaheadActivity.id,
          activityName: lookaheadActivity.name,
          severity: overlapDays > 5 ? 'high' : overlapDays > 2 ? 'medium' : 'low',
          message: `Risk: "${lookaheadActivity.name}" is scheduled to start ${overlapDays} day(s) before predecessor "${masterPredecessor.name}" finishes`,
          details: {
            predecessorId: masterPredecessor.id,
            predecessorName: masterPredecessor.name,
            predecessorGuid: masterPredecessor.persistentInternalGuid,
            activityStartDate: actStartDate.toISOString(),
            predecessorFinishDate: predFinishDate.toISOString(),
            overlapDays,
            usingLookaheadPredecessorDates: !!lookaheadPredecessor,
          },
        });
      }
    }

    return conflicts;
  }

  /**
   * Check for resource over-allocation across activities in the lookahead period
   * Detects when resources are assigned to multiple activities on the same days
   */
  private async checkResourceOverAllocation(
    lookahead: LookaheadWithActivities,
    activitiesToCheck: LookaheadActivity[],
    masterActivityMap: Map<string, ScheduleActivity>,
    threshold: number
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];

    // Build a map of resource allocations by day
    type DayAllocation = {
      date: string;
      activities: Array<{
        activityId: string;
        activityName: string;
        hoursAllocated: number;
      }>;
      totalHours: number;
    };

    const resourceDayMap = new Map<string, Map<string, DayAllocation>>();

    // Get all resource assignments for activities in the lookahead
    for (const lookaheadActivity of activitiesToCheck) {
      const masterActivity = masterActivityMap.get(lookaheadActivity.persistentInternalGuid);
      if (!masterActivity) continue;

      // Get resource assignments from master activity
      const assignments = await prisma.resourceAssignment.findMany({
        where: {
          scheduleActivityId: masterActivity.id,
        },
        include: {
          staffMember: true,
        },
      });

      // Calculate daily allocation for each resource
      const startDate = new Date(lookaheadActivity.startDate);
      const finishDate = new Date(lookaheadActivity.finishDate);
      const durationDays = Math.max(1, lookaheadActivity.duration);

      for (const assignment of assignments) {
        const resourceId = assignment.staffMemberId;
        const resourceName = `${assignment.staffMember.firstName} ${assignment.staffMember.lastName}`;
        const totalHours = assignment.hoursAllocated ? Number(assignment.hoursAllocated) : 8 * durationDays;
        const dailyHours = totalHours / durationDays;

        if (!resourceDayMap.has(resourceId)) {
          resourceDayMap.set(resourceId, new Map());
        }

        const resourceDays = resourceDayMap.get(resourceId)!;

        // Add allocation for each day of the activity
        const currentDate = new Date(startDate);
        while (currentDate <= finishDate) {
          const dateKey = currentDate.toISOString().split('T')[0];

          if (!resourceDays.has(dateKey)) {
            resourceDays.set(dateKey, {
              date: dateKey,
              activities: [],
              totalHours: 0,
            });
          }

          const dayAllocation = resourceDays.get(dateKey)!;
          dayAllocation.activities.push({
            activityId: lookaheadActivity.id,
            activityName: lookaheadActivity.name,
            hoursAllocated: dailyHours,
          });
          dayAllocation.totalHours += dailyHours;

          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }

    // Check for over-allocations (more than 8 hours per day per resource)
    const standardDailyHours = 8;

    for (const [resourceId, resourceDays] of resourceDayMap) {
      for (const [dateKey, dayAllocation] of resourceDays) {
        const allocationRatio = dayAllocation.totalHours / standardDailyHours;

        if (allocationRatio > threshold && dayAllocation.activities.length > 1) {
          // Get resource name from first activity's assignment
          const staffMember = await prisma.staffMember.findUnique({
            where: { id: resourceId },
          });

          const resourceName = staffMember
            ? `${staffMember.firstName} ${staffMember.lastName}`
            : 'Unknown Resource';

          // Create conflict for each activity involved
          for (const activity of dayAllocation.activities) {
            conflicts.push({
              type: 'resource_over_allocation',
              activityId: activity.activityId,
              activityName: activity.activityName,
              severity: allocationRatio > 1.5 ? 'high' : 'medium',
              message: `Resource "${resourceName}" is over-allocated on ${dateKey} (${dayAllocation.totalHours.toFixed(1)}h / ${standardDailyHours}h = ${(allocationRatio * 100).toFixed(0)}%)`,
              details: {
                resourceId,
                resourceName,
                date: dateKey,
                totalHoursAllocated: dayAllocation.totalHours,
                standardDailyHours,
                allocationRatio,
                conflictingActivities: dayAllocation.activities.map((a) => ({
                  id: a.activityId,
                  name: a.activityName,
                  hours: a.hoursAllocated,
                })),
              },
            });
          }
        }
      }
    }

    // Deduplicate conflicts (same activity might appear multiple times for different days)
    const uniqueConflicts = conflicts.filter((conflict, index, self) => {
      const key = `${conflict.activityId}-${conflict.type}-${(conflict.details as Record<string, unknown>)?.date}`;
      return index === self.findIndex((c) => {
        const cKey = `${c.activityId}-${c.type}-${(c.details as Record<string, unknown>)?.date}`;
        return cKey === key;
      });
    });

    return uniqueConflicts;
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
