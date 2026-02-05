import { prisma } from '../../../config/database.js';
import { NotFoundError, BadRequestError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { Prisma, Schedule, ScheduleActivity, ScheduleBaseline } from '@prisma/client';

// Constants
const MAX_BASELINES = 5;

// Types
export interface CreateScheduleDto {
  projectId: string;
  name: string;
  description?: string;
  metadata?: Prisma.JsonValue;
  createdBy: string;
}

export interface UpdateScheduleDto {
  name?: string;
  description?: string;
  status?: string;
  metadata?: Prisma.JsonValue;
}

export interface BaselineVariance {
  activityId: string;
  activityCode: string | null;
  activityName: string;
  startDateVariance: number; // days
  finishDateVariance: number; // days
  durationVariance: number; // days
  progressVariance: number; // percentage points
  isCriticalPathChange: boolean;
  floatChange: number;
}

export interface BaselineComparison {
  baseline1: ScheduleBaseline;
  baseline2: ScheduleBaseline;
  summary: {
    totalActivitiesCompared: number;
    activitiesWithChanges: number;
    averageStartVariance: number;
    averageFinishVariance: number;
    criticalPathChanges: number;
  };
  variances: BaselineVariance[];
}

export interface ScheduleWithDetails extends Schedule {
  activities?: ScheduleActivity[];
  baselines?: ScheduleBaseline[];
  project?: {
    id: string;
    name: string;
    companyId: string;
  };
}

/**
 * ScheduleService - Handles all schedule-related business logic
 */
export class ScheduleService {
  /**
   * Create a new schedule
   */
  async create(data: CreateScheduleDto): Promise<Schedule> {
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const schedule = await prisma.schedule.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        metadata: data.metadata,
        status: 'draft',
        createdBy: data.createdBy,
      },
    });

    logger.info(`Schedule created: ${schedule.id} for project ${data.projectId}`);
    return schedule;
  }

  /**
   * Get a schedule by ID with optional includes
   */
  async findById(
    scheduleId: string,
    options: {
      includeActivities?: boolean;
      includeBaselines?: boolean;
      includeProject?: boolean;
    } = {}
  ): Promise<ScheduleWithDetails> {
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        activities: options.includeActivities ? {
          orderBy: { startDate: 'asc' },
        } : false,
        baselines: options.includeBaselines ? {
          orderBy: { createdAt: 'desc' },
          take: MAX_BASELINES,
        } : false,
        project: options.includeProject ? {
          select: { id: true, name: true, companyId: true },
        } : false,
      },
    });

    if (!schedule) {
      throw new NotFoundError('Schedule not found');
    }

    return schedule as ScheduleWithDetails;
  }

  /**
   * Get all schedules for a project
   */
  async findByProject(projectId: string): Promise<Schedule[]> {
    return prisma.schedule.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update a schedule
   */
  async update(scheduleId: string, data: UpdateScheduleDto): Promise<Schedule> {
    const existing = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!existing) {
      throw new NotFoundError('Schedule not found');
    }

    const schedule = await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    logger.info(`Schedule updated: ${scheduleId}`);
    return schedule;
  }

  /**
   * Delete a schedule
   */
  async delete(scheduleId: string): Promise<void> {
    const existing = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!existing) {
      throw new NotFoundError('Schedule not found');
    }

    await prisma.schedule.delete({
      where: { id: scheduleId },
    });

    logger.info(`Schedule deleted: ${scheduleId}`);
  }

  /**
   * Create a baseline snapshot of the current schedule state
   * Automatically enforces the 5-baseline retention limit
   */
  async createBaseline(scheduleId: string): Promise<ScheduleBaseline> {
    // Verify schedule exists
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new NotFoundError('Schedule not found');
    }

    // Get current activities for the snapshot
    const activities = await prisma.scheduleActivity.findMany({
      where: { scheduleId },
      orderBy: { startDate: 'asc' },
    });

    if (activities.length === 0) {
      throw new BadRequestError('Cannot create baseline for schedule with no activities');
    }

    // Get the next version number
    const latestBaseline = await prisma.scheduleBaseline.findFirst({
      where: { scheduleId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latestBaseline?.version ?? 0) + 1;

    // Create the baseline snapshot
    const snapshotData = {
      createdAt: new Date().toISOString(),
      scheduleId,
      totalActivities: activities.length,
      activities: activities.map((a) => ({
        id: a.id,
        persistentInternalGuid: a.persistentInternalGuid,
        activityCode: a.activityCode,
        name: a.name,
        startDate: a.startDate.toISOString(),
        finishDate: a.finishDate.toISOString(),
        duration: a.duration,
        percentComplete: a.percentComplete,
        totalFloat: a.totalFloat,
        isCritical: a.isCritical,
        predecessorIds: a.predecessorIds,
        successorIds: a.successorIds,
      })),
    };

    const baseline = await prisma.scheduleBaseline.create({
      data: {
        scheduleId,
        version: nextVersion,
        snapshotData,
      },
    });

    // Enforce retention limit - delete oldest baselines beyond MAX_BASELINES
    await this.enforceBaselineRetention(scheduleId);

    logger.info(`Baseline created: ${baseline.id} (version ${nextVersion}) for schedule ${scheduleId}`);
    return baseline;
  }

  /**
   * Get all baselines for a schedule (limited to MAX_BASELINES)
   */
  async getBaselines(scheduleId: string): Promise<ScheduleBaseline[]> {
    return prisma.scheduleBaseline.findMany({
      where: { scheduleId },
      orderBy: { createdAt: 'desc' },
      take: MAX_BASELINES,
    });
  }

  /**
   * Get a specific baseline by ID
   */
  async getBaseline(baselineId: string): Promise<ScheduleBaseline> {
    const baseline = await prisma.scheduleBaseline.findUnique({
      where: { id: baselineId },
    });

    if (!baseline) {
      throw new NotFoundError('Baseline not found');
    }

    return baseline;
  }

  /**
   * Compare two baselines and calculate variances
   */
  async compareBaselines(
    scheduleId: string,
    baseline1Id: string,
    baseline2Id: string
  ): Promise<BaselineComparison> {
    const [baseline1, baseline2] = await Promise.all([
      prisma.scheduleBaseline.findFirst({
        where: { id: baseline1Id, scheduleId },
      }),
      prisma.scheduleBaseline.findFirst({
        where: { id: baseline2Id, scheduleId },
      }),
    ]);

    if (!baseline1 || !baseline2) {
      throw new NotFoundError('One or both baselines not found');
    }

    // Extract activities from snapshots
    const snapshot1 = baseline1.snapshotData as { activities: BaselineActivity[] };
    const snapshot2 = baseline2.snapshotData as { activities: BaselineActivity[] };

    const activities1 = new Map(
      snapshot1.activities.map((a) => [a.persistentInternalGuid || a.id, a])
    );
    const activities2 = new Map(
      snapshot2.activities.map((a) => [a.persistentInternalGuid || a.id, a])
    );

    // Calculate variances
    const variances: BaselineVariance[] = [];
    let totalStartVariance = 0;
    let totalFinishVariance = 0;
    let criticalPathChanges = 0;

    for (const [guid, act1] of activities1) {
      const act2 = activities2.get(guid);
      if (!act2) continue; // Activity doesn't exist in baseline2

      const startDate1 = new Date(act1.startDate);
      const startDate2 = new Date(act2.startDate);
      const finishDate1 = new Date(act1.finishDate);
      const finishDate2 = new Date(act2.finishDate);

      const startVariance = this.daysDifference(startDate1, startDate2);
      const finishVariance = this.daysDifference(finishDate1, finishDate2);
      const durationVariance = act2.duration - act1.duration;
      const progressVariance = act2.percentComplete - act1.percentComplete;
      const isCriticalPathChange = act1.isCritical !== act2.isCritical;
      const floatChange = (act2.totalFloat ?? 0) - (act1.totalFloat ?? 0);

      if (
        startVariance !== 0 ||
        finishVariance !== 0 ||
        durationVariance !== 0 ||
        isCriticalPathChange
      ) {
        variances.push({
          activityId: act1.id,
          activityCode: act1.activityCode,
          activityName: act1.name,
          startDateVariance: startVariance,
          finishDateVariance: finishVariance,
          durationVariance,
          progressVariance,
          isCriticalPathChange,
          floatChange,
        });
      }

      totalStartVariance += Math.abs(startVariance);
      totalFinishVariance += Math.abs(finishVariance);
      if (isCriticalPathChange) criticalPathChanges++;
    }

    const totalCompared = Math.min(activities1.size, activities2.size);

    return {
      baseline1,
      baseline2,
      summary: {
        totalActivitiesCompared: totalCompared,
        activitiesWithChanges: variances.length,
        averageStartVariance: totalCompared > 0 ? totalStartVariance / totalCompared : 0,
        averageFinishVariance: totalCompared > 0 ? totalFinishVariance / totalCompared : 0,
        criticalPathChanges,
      },
      variances,
    };
  }

  /**
   * Enforce the baseline retention limit (keep only MAX_BASELINES)
   */
  private async enforceBaselineRetention(scheduleId: string): Promise<void> {
    const allBaselines = await prisma.scheduleBaseline.findMany({
      where: { scheduleId },
      orderBy: { createdAt: 'desc' },
    });

    if (allBaselines.length > MAX_BASELINES) {
      const toDelete = allBaselines.slice(MAX_BASELINES);
      await prisma.scheduleBaseline.deleteMany({
        where: {
          id: { in: toDelete.map((b) => b.id) },
        },
      });

      logger.info(
        `Deleted ${toDelete.length} old baselines for schedule ${scheduleId} (retention limit: ${MAX_BASELINES})`
      );
    }
  }

  /**
   * Calculate the difference in days between two dates
   */
  private daysDifference(date1: Date, date2: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((date2.getTime() - date1.getTime()) / msPerDay);
  }

  /**
   * Get schedule statistics
   */
  async getStatistics(scheduleId: string): Promise<ScheduleStatistics> {
    const activities = await prisma.scheduleActivity.findMany({
      where: { scheduleId },
    });

    if (activities.length === 0) {
      return {
        totalActivities: 0,
        completedActivities: 0,
        inProgressActivities: 0,
        notStartedActivities: 0,
        criticalPathActivities: 0,
        overallProgress: 0,
        earliestStart: null,
        latestFinish: null,
      };
    }

    const completed = activities.filter((a) => a.percentComplete === 100);
    const inProgress = activities.filter((a) => a.percentComplete > 0 && a.percentComplete < 100);
    const notStarted = activities.filter((a) => a.percentComplete === 0);
    const critical = activities.filter((a) => a.isCritical);

    const dates = activities.map((a) => ({
      start: new Date(a.startDate),
      finish: new Date(a.finishDate),
    }));

    const earliestStart = new Date(Math.min(...dates.map((d) => d.start.getTime())));
    const latestFinish = new Date(Math.max(...dates.map((d) => d.finish.getTime())));

    // Calculate weighted progress based on duration
    const totalDuration = activities.reduce((sum, a) => sum + a.duration, 0);
    const weightedProgress = activities.reduce(
      (sum, a) => sum + (a.duration / totalDuration) * a.percentComplete,
      0
    );

    return {
      totalActivities: activities.length,
      completedActivities: completed.length,
      inProgressActivities: inProgress.length,
      notStartedActivities: notStarted.length,
      criticalPathActivities: critical.length,
      overallProgress: Math.round(weightedProgress * 100) / 100,
      earliestStart,
      latestFinish,
    };
  }
}

// Helper types
interface BaselineActivity {
  id: string;
  persistentInternalGuid?: string;
  activityCode: string | null;
  name: string;
  startDate: string;
  finishDate: string;
  duration: number;
  percentComplete: number;
  totalFloat: number | null;
  isCritical: boolean;
}

interface ScheduleStatistics {
  totalActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  notStartedActivities: number;
  criticalPathActivities: number;
  overallProgress: number;
  earliestStart: Date | null;
  latestFinish: Date | null;
}

// Export singleton instance
export const scheduleService = new ScheduleService();
