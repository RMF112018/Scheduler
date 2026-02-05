import { prisma } from '../../../config/database.js';
import { NotFoundError, BadRequestError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { Prisma, ScheduleActivity } from '@prisma/client';

// Types
export interface CreateActivityDto {
  scheduleId: string;
  activityCode?: string;
  name: string;
  startDate: Date;
  finishDate: Date;
  duration: number;
  percentComplete?: number;
  predecessorIds?: string[];
  successorIds?: string[];
  resourceIds?: string[];
  metadata?: Prisma.JsonValue;
}

export interface UpdateActivityDto {
  activityCode?: string;
  name?: string;
  startDate?: Date;
  finishDate?: Date;
  duration?: number;
  percentComplete?: number;
  predecessorIds?: string[];
  successorIds?: string[];
  resourceIds?: string[];
  totalFloat?: number;
  isCritical?: boolean;
  metadata?: Prisma.JsonValue;
}

export interface ActivityNode {
  id: string;
  name: string;
  duration: number;
  remainingDuration: number; // Remaining duration after progress (for retained logic)
  percentComplete: number;
  predecessorIds: string[];
  successorIds: string[];
  earlyStart: number; // ES - earliest start (days from project start)
  earlyFinish: number; // EF - earliest finish
  lateStart: number; // LS - latest start
  lateFinish: number; // LF - latest finish
  totalFloat: number; // TF = LS - ES or LF - EF
  freeFloat: number; // FF - free float
  isCritical: boolean;
}

export interface CriticalPathResult {
  criticalPath: string[]; // Activity IDs in order
  projectDuration: number; // Total project duration in days
  activities: ActivityNode[];
  useRetainedLogic: boolean; // Whether retained logic was used in calculation
}

export interface CriticalPathOptions {
  useRetainedLogic?: boolean; // If undefined, will use project settings
}

/**
 * ActivityService - Handles all activity-related business logic including critical path calculation
 */
export class ActivityService {
  /**
   * Create a new activity
   */
  async create(data: CreateActivityDto): Promise<ScheduleActivity> {
    // Verify schedule exists
    const schedule = await prisma.schedule.findUnique({
      where: { id: data.scheduleId },
    });

    if (!schedule) {
      throw new NotFoundError('Schedule not found');
    }

    // Validate dates
    if (data.startDate >= data.finishDate) {
      throw new BadRequestError('Start date must be before finish date');
    }

    const activity = await prisma.scheduleActivity.create({
      data: {
        scheduleId: data.scheduleId,
        activityCode: data.activityCode,
        name: data.name,
        startDate: data.startDate,
        finishDate: data.finishDate,
        duration: data.duration,
        percentComplete: data.percentComplete ?? 0,
        predecessorIds: data.predecessorIds ?? [],
        successorIds: data.successorIds ?? [],
        resourceIds: data.resourceIds ?? [],
        totalFloat: 0,
        isCritical: false,
        metadata: data.metadata,
      },
    });

    // Update successor IDs for predecessors
    if (data.predecessorIds && data.predecessorIds.length > 0) {
      await this.updatePredecessorSuccessors(data.predecessorIds, activity.id);
    }

    logger.info(`Activity created: ${activity.id} in schedule ${data.scheduleId}`);
    return activity;
  }

  /**
   * Get an activity by ID
   */
  async findById(activityId: string): Promise<ScheduleActivity> {
    const activity = await prisma.scheduleActivity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundError('Activity not found');
    }

    return activity;
  }

  /**
   * Get all activities for a schedule
   */
  async findBySchedule(
    scheduleId: string,
    options: {
      orderBy?: 'startDate' | 'finishDate' | 'name' | 'activityCode';
      order?: 'asc' | 'desc';
    } = {}
  ): Promise<ScheduleActivity[]> {
    const { orderBy = 'startDate', order = 'asc' } = options;

    return prisma.scheduleActivity.findMany({
      where: { scheduleId },
      orderBy: { [orderBy]: order },
    });
  }

  /**
   * Update an activity
   */
  async update(activityId: string, data: UpdateActivityDto): Promise<ScheduleActivity> {
    const existing = await prisma.scheduleActivity.findUnique({
      where: { id: activityId },
    });

    if (!existing) {
      throw new NotFoundError('Activity not found');
    }

    // Validate dates if both are provided
    const startDate = data.startDate ?? existing.startDate;
    const finishDate = data.finishDate ?? existing.finishDate;
    if (startDate >= finishDate) {
      throw new BadRequestError('Start date must be before finish date');
    }

    const activity = await prisma.scheduleActivity.update({
      where: { id: activityId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    logger.info(`Activity updated: ${activityId}`);
    return activity;
  }

  /**
   * Delete an activity
   */
  async delete(activityId: string): Promise<void> {
    const existing = await prisma.scheduleActivity.findUnique({
      where: { id: activityId },
    });

    if (!existing) {
      throw new NotFoundError('Activity not found');
    }

    // Remove this activity from predecessor's successor lists
    await this.removeFromPredecessorSuccessors(existing.predecessorIds, activityId);

    // Remove this activity from successor's predecessor lists
    await this.removeFromSuccessorPredecessors(existing.successorIds, activityId);

    await prisma.scheduleActivity.delete({
      where: { id: activityId },
    });

    logger.info(`Activity deleted: ${activityId}`);
  }

  /**
   * Add a predecessor relationship
   */
  async addPredecessor(activityId: string, predecessorId: string): Promise<ScheduleActivity> {
    const [activity, predecessor] = await Promise.all([
      prisma.scheduleActivity.findUnique({ where: { id: activityId } }),
      prisma.scheduleActivity.findUnique({ where: { id: predecessorId } }),
    ]);

    if (!activity || !predecessor) {
      throw new NotFoundError('Activity or predecessor not found');
    }

    if (activity.scheduleId !== predecessor.scheduleId) {
      throw new BadRequestError('Activities must belong to the same schedule');
    }

    // Check for circular dependency
    if (await this.wouldCreateCycle(activityId, predecessorId)) {
      throw new BadRequestError('Adding this predecessor would create a circular dependency');
    }

    // Update both activities
    const [updatedActivity] = await Promise.all([
      prisma.scheduleActivity.update({
        where: { id: activityId },
        data: {
          predecessorIds: [...activity.predecessorIds, predecessorId],
        },
      }),
      prisma.scheduleActivity.update({
        where: { id: predecessorId },
        data: {
          successorIds: [...predecessor.successorIds, activityId],
        },
      }),
    ]);

    return updatedActivity;
  }

  /**
   * Remove a predecessor relationship
   */
  async removePredecessor(activityId: string, predecessorId: string): Promise<ScheduleActivity> {
    const [activity, predecessor] = await Promise.all([
      prisma.scheduleActivity.findUnique({ where: { id: activityId } }),
      prisma.scheduleActivity.findUnique({ where: { id: predecessorId } }),
    ]);

    if (!activity || !predecessor) {
      throw new NotFoundError('Activity or predecessor not found');
    }

    const [updatedActivity] = await Promise.all([
      prisma.scheduleActivity.update({
        where: { id: activityId },
        data: {
          predecessorIds: activity.predecessorIds.filter((id) => id !== predecessorId),
        },
      }),
      prisma.scheduleActivity.update({
        where: { id: predecessorId },
        data: {
          successorIds: predecessor.successorIds.filter((id) => id !== activityId),
        },
      }),
    ]);

    return updatedActivity;
  }

  /**
   * Calculate critical path for a schedule using CPM (Critical Path Method)
   * Uses forward and backward pass to calculate ES, EF, LS, LF, and float
   * 
   * Retained Logic (P6-style):
   * - For in-progress activities (0 < percentComplete < 100), uses remaining duration
   * - remainingDuration = duration * (1 - percentComplete / 100)
   * - Completed activities (percentComplete = 100) have remainingDuration = 0
   * - Not-started activities (percentComplete = 0) use full duration
   */
  async calculateCriticalPath(
    scheduleId: string,
    options: CriticalPathOptions = {}
  ): Promise<CriticalPathResult> {
    const activities = await prisma.scheduleActivity.findMany({
      where: { scheduleId },
      include: {
        schedule: {
          include: {
            project: {
              include: {
                settings: true,
              },
            },
          },
        },
      },
    });

    if (activities.length === 0) {
      return {
        criticalPath: [],
        projectDuration: 0,
        activities: [],
        useRetainedLogic: false,
      };
    }

    // Determine whether to use retained logic
    // Priority: explicit option > project settings > default (true)
    const projectSettings = activities[0]?.schedule?.project?.settings;
    const useRetainedLogic = options.useRetainedLogic ?? projectSettings?.useRetainedLogic ?? true;

    // Build activity nodes map
    const nodes = new Map<string, ActivityNode>();
    for (const activity of activities) {
      // Calculate remaining duration for retained logic
      let remainingDuration = activity.duration;
      
      if (useRetainedLogic) {
        if (activity.percentComplete >= 100) {
          // Completed activities have no remaining duration
          remainingDuration = 0;
        } else if (activity.percentComplete > 0) {
          // In-progress: remaining = duration * (1 - percentComplete/100)
          remainingDuration = Math.ceil(activity.duration * (1 - activity.percentComplete / 100));
        }
        // Not started (percentComplete = 0): use full duration
      }

      nodes.set(activity.id, {
        id: activity.id,
        name: activity.name,
        duration: activity.duration,
        remainingDuration,
        percentComplete: activity.percentComplete,
        predecessorIds: activity.predecessorIds,
        successorIds: activity.successorIds,
        earlyStart: 0,
        earlyFinish: 0,
        lateStart: 0,
        lateFinish: 0,
        totalFloat: 0,
        freeFloat: 0,
        isCritical: false,
      });
    }

    // Topological sort for forward pass
    const sortedIds = this.topologicalSort(nodes);

    // Forward Pass - Calculate Early Start (ES) and Early Finish (EF)
    // When using retained logic, EF = ES + remainingDuration
    for (const id of sortedIds) {
      const node = nodes.get(id)!;
      
      // ES = max(EF of all predecessors), or 0 if no predecessors
      if (node.predecessorIds.length === 0) {
        node.earlyStart = 0;
      } else {
        node.earlyStart = Math.max(
          ...node.predecessorIds.map((predId) => {
            const pred = nodes.get(predId);
            return pred ? pred.earlyFinish : 0;
          })
        );
      }
      
      // EF = ES + Duration (or remainingDuration for retained logic)
      const effectiveDuration = useRetainedLogic ? node.remainingDuration : node.duration;
      node.earlyFinish = node.earlyStart + effectiveDuration;
    }

    // Find project duration (max EF)
    const projectDuration = Math.max(...Array.from(nodes.values()).map((n) => n.earlyFinish));

    // Backward Pass - Calculate Late Start (LS) and Late Finish (LF)
    const reversedIds = [...sortedIds].reverse();
    for (const id of reversedIds) {
      const node = nodes.get(id)!;
      
      // LF = min(LS of all successors), or project duration if no successors
      if (node.successorIds.length === 0) {
        node.lateFinish = projectDuration;
      } else {
        node.lateFinish = Math.min(
          ...node.successorIds.map((succId) => {
            const succ = nodes.get(succId);
            return succ ? succ.lateStart : projectDuration;
          })
        );
      }
      
      // LS = LF - Duration (or remainingDuration for retained logic)
      const effectiveDuration = useRetainedLogic ? node.remainingDuration : node.duration;
      node.lateStart = node.lateFinish - effectiveDuration;
    }

    // Calculate Float and identify critical path
    const criticalPath: string[] = [];
    for (const node of nodes.values()) {
      // Total Float = LS - ES (or LF - EF)
      node.totalFloat = node.lateStart - node.earlyStart;
      
      // Free Float = min(ES of successors) - EF
      if (node.successorIds.length > 0) {
        const minSuccessorES = Math.min(
          ...node.successorIds.map((succId) => {
            const succ = nodes.get(succId);
            return succ ? succ.earlyStart : projectDuration;
          })
        );
        node.freeFloat = minSuccessorES - node.earlyFinish;
      } else {
        node.freeFloat = 0;
      }
      
      // Activity is critical if total float is 0
      // Note: Completed activities (remainingDuration = 0) are not on the critical path
      // unless they have successors that depend on them
      node.isCritical = node.totalFloat === 0 && (useRetainedLogic ? node.remainingDuration > 0 : true);
      
      if (node.isCritical) {
        criticalPath.push(node.id);
      }
    }

    // Sort critical path by early start
    criticalPath.sort((a, b) => {
      const nodeA = nodes.get(a)!;
      const nodeB = nodes.get(b)!;
      return nodeA.earlyStart - nodeB.earlyStart;
    });

    // Update activities in database with calculated values
    await this.updateActivitiesWithCriticalPath(nodes);

    logger.info(
      `Critical path calculated for schedule ${scheduleId}: ${criticalPath.length} critical activities, ${projectDuration} days duration (retained logic: ${useRetainedLogic})`
    );

    return {
      criticalPath,
      projectDuration,
      activities: Array.from(nodes.values()),
      useRetainedLogic,
    };
  }

  /**
   * Perform topological sort on activity nodes
   */
  private topologicalSort(nodes: Map<string, ActivityNode>): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new BadRequestError('Circular dependency detected in activity relationships');
      }

      visiting.add(id);
      const node = nodes.get(id);
      if (node) {
        for (const predId of node.predecessorIds) {
          if (nodes.has(predId)) {
            visit(predId);
          }
        }
      }
      visiting.delete(id);
      visited.add(id);
      sorted.push(id);
    };

    for (const id of nodes.keys()) {
      if (!visited.has(id)) {
        visit(id);
      }
    }

    return sorted;
  }

  /**
   * Check if adding a predecessor would create a cycle
   */
  private async wouldCreateCycle(activityId: string, predecessorId: string): Promise<boolean> {
    // If predecessor is same as activity, it's a cycle
    if (activityId === predecessorId) return true;

    // Get all activities in the schedule
    const activity = await prisma.scheduleActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity) return false;

    const activities = await prisma.scheduleActivity.findMany({
      where: { scheduleId: activity.scheduleId },
    });

    // Build adjacency list
    const successors = new Map<string, string[]>();
    for (const act of activities) {
      successors.set(act.id, act.successorIds);
    }

    // Add the proposed relationship temporarily
    const currentSuccessors = successors.get(predecessorId) || [];
    successors.set(predecessorId, [...currentSuccessors, activityId]);

    // DFS to check for cycle starting from predecessorId
    const visited = new Set<string>();
    const stack = [predecessorId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const succs = successors.get(current) || [];
      for (const succ of succs) {
        if (succ === predecessorId) return true; // Cycle detected
        stack.push(succ);
      }
    }

    return false;
  }

  /**
   * Update activities in database with critical path calculation results
   */
  private async updateActivitiesWithCriticalPath(nodes: Map<string, ActivityNode>): Promise<void> {
    const updates = Array.from(nodes.values()).map((node) =>
      prisma.scheduleActivity.update({
        where: { id: node.id },
        data: {
          totalFloat: node.totalFloat,
          isCritical: node.isCritical,
        },
      })
    );

    await Promise.all(updates);
  }

  /**
   * Update predecessor's successor lists when a new activity is created
   */
  private async updatePredecessorSuccessors(
    predecessorIds: string[],
    newActivityId: string
  ): Promise<void> {
    for (const predId of predecessorIds) {
      const pred = await prisma.scheduleActivity.findUnique({
        where: { id: predId },
      });
      if (pred) {
        await prisma.scheduleActivity.update({
          where: { id: predId },
          data: {
            successorIds: [...pred.successorIds, newActivityId],
          },
        });
      }
    }
  }

  /**
   * Remove activity from predecessor's successor lists
   */
  private async removeFromPredecessorSuccessors(
    predecessorIds: string[],
    activityId: string
  ): Promise<void> {
    for (const predId of predecessorIds) {
      const pred = await prisma.scheduleActivity.findUnique({
        where: { id: predId },
      });
      if (pred) {
        await prisma.scheduleActivity.update({
          where: { id: predId },
          data: {
            successorIds: pred.successorIds.filter((id) => id !== activityId),
          },
        });
      }
    }
  }

  /**
   * Remove activity from successor's predecessor lists
   */
  private async removeFromSuccessorPredecessors(
    successorIds: string[],
    activityId: string
  ): Promise<void> {
    for (const succId of successorIds) {
      const succ = await prisma.scheduleActivity.findUnique({
        where: { id: succId },
      });
      if (succ) {
        await prisma.scheduleActivity.update({
          where: { id: succId },
          data: {
            predecessorIds: succ.predecessorIds.filter((id) => id !== activityId),
          },
        });
      }
    }
  }

  /**
   * Get activities by date range
   */
  async findByDateRange(
    scheduleId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScheduleActivity[]> {
    return prisma.scheduleActivity.findMany({
      where: {
        scheduleId,
        OR: [
          {
            startDate: { gte: startDate, lte: endDate },
          },
          {
            finishDate: { gte: startDate, lte: endDate },
          },
          {
            AND: [
              { startDate: { lte: startDate } },
              { finishDate: { gte: endDate } },
            ],
          },
        ],
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Get critical activities for a schedule
   */
  async getCriticalActivities(scheduleId: string): Promise<ScheduleActivity[]> {
    return prisma.scheduleActivity.findMany({
      where: {
        scheduleId,
        isCritical: true,
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Update activity progress
   */
  async updateProgress(activityId: string, percentComplete: number): Promise<ScheduleActivity> {
    if (percentComplete < 0 || percentComplete > 100) {
      throw new BadRequestError('Percent complete must be between 0 and 100');
    }

    return prisma.scheduleActivity.update({
      where: { id: activityId },
      data: {
        percentComplete,
        updatedAt: new Date(),
      },
    });
  }
}

// Export singleton instance
export const activityService = new ActivityService();
