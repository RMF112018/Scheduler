/**
 * Schedule Factory for E2E Tests
 * 
 * Creates test schedules with activities, relationships, and baselines
 * for comprehensive E2E testing scenarios.
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import type { Schedule, ScheduleActivity } from '../../../../shared/src/index.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://user:password@localhost:5432/scheduler_test',
    },
  },
});

export interface ScheduleFactoryOptions {
  name?: string;
  projectId: string;
  createdBy: string;
  activityCount?: number;
  includeRelationships?: boolean;
  includeBaseline?: boolean;
  useRetainedLogic?: boolean;
  startDate?: Date;
}

export interface CreatedSchedule {
  schedule: Schedule;
  activities: ScheduleActivity[];
  baselineId?: string;
}

/**
 * Create a schedule with activities for E2E testing
 */
export async function createScheduleWithActivities(
  options: ScheduleFactoryOptions
): Promise<CreatedSchedule> {
  const {
    name = `E2E Schedule ${Date.now()}`,
    projectId,
    createdBy,
    activityCount = 10,
    includeRelationships = true,
    includeBaseline = false,
    useRetainedLogic = true,
    startDate = new Date(),
  } = options;

  // Ensure project has retained logic enabled
  await prisma.projectSettings.upsert({
    where: { projectId },
    create: {
      projectId,
      useRetainedLogic,
    },
    update: {
      useRetainedLogic,
    },
  });

  // Create schedule
  const schedule = await prisma.schedule.create({
    data: {
      name,
      projectId,
      createdBy,
      status: 'active',
    },
  });

  // Create activities with relationships
  const activities: ScheduleActivity[] = [];
  const activityIds: string[] = [];

  for (let i = 0; i < activityCount; i++) {
    const activityStartDate = new Date(startDate);
    activityStartDate.setDate(activityStartDate.getDate() + i * 5); // 5 days apart
    const activityFinishDate = new Date(activityStartDate);
    activityFinishDate.setDate(activityFinishDate.getDate() + 10); // 10 days duration

    const persistentGuid = uuidv4();

    const activity = await prisma.scheduleActivity.create({
      data: {
        scheduleId: schedule.id,
        persistentInternalGuid: persistentGuid,
        externalGuid: `EXT-${i + 1}`,
        activityCode: `ACT-${String(i + 1).padStart(3, '0')}`,
        name: `Activity ${i + 1}`,
        startDate: activityStartDate,
        finishDate: activityFinishDate,
        duration: 10,
        percentComplete: i % 3 === 0 ? 50 : 0, // Some activities in progress
        predecessorIds: includeRelationships && i > 0 ? [activityIds[i - 1]] : [],
        successorIds: [],
        resourceIds: [],
        totalFloat: null,
        isCritical: false,
      },
    });

    activityIds.push(activity.id);
    activities.push({
      id: activity.id,
      scheduleId: activity.scheduleId,
      persistentInternalGuid: activity.persistentInternalGuid,
      externalGuid: activity.externalGuid || undefined,
      activityCode: activity.activityCode || undefined,
      name: activity.name,
      startDate: activity.startDate.toISOString(),
      finishDate: activity.finishDate.toISOString(),
      duration: activity.duration,
      percentComplete: activity.percentComplete,
      predecessorIds: activity.predecessorIds,
      successorIds: activity.successorIds,
      resourceIds: activity.resourceIds,
      totalFloat: activity.totalFloat ?? undefined,
      isCritical: activity.isCritical,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
    });

    // Update previous activity's successorIds
    if (includeRelationships && i > 0) {
      await prisma.scheduleActivity.update({
        where: { id: activityIds[i - 1] },
        data: {
          successorIds: [activity.id],
        },
      });
    }
  }

  // Create baseline if requested
  let baselineId: string | undefined;
  if (includeBaseline) {
    const baseline = await prisma.scheduleBaseline.create({
      data: {
        scheduleId: schedule.id,
        version: 1,
        snapshotData: {
          activities: activities.map((a) => ({
            id: a.id,
            name: a.name,
            startDate: a.startDate,
            finishDate: a.finishDate,
            duration: a.duration,
          })),
        },
      },
    });
    baselineId = baseline.id;
  }

  return {
    schedule: {
      id: schedule.id,
      projectId: schedule.projectId,
      name: schedule.name,
      status: schedule.status as 'draft' | 'active' | 'archived',
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
      createdBy: schedule.createdBy,
    },
    activities,
    baselineId,
  };
}

/**
 * Create a large schedule for performance testing (1000+ activities)
 */
export async function createLargeSchedule(
  projectId: string,
  createdBy: string,
  activityCount: number = 1000
): Promise<CreatedSchedule> {
  return createScheduleWithActivities({
    projectId,
    createdBy,
    activityCount,
    includeRelationships: true,
    includeBaseline: false,
    useRetainedLogic: true,
  });
}

/**
 * Create a schedule from XER import simulation
 */
export async function createScheduleFromXER(
  projectId: string,
  createdBy: string,
  xerActivities: Array<{
    externalId: string;
    name: string;
    startDate: Date;
    finishDate: Date;
    duration: number;
    predecessors?: string[];
  }>
): Promise<CreatedSchedule> {
  const schedule = await prisma.schedule.create({
    data: {
      name: `Imported Schedule ${Date.now()}`,
      projectId,
      createdBy,
      status: 'active',
    },
  });

  const activities: ScheduleActivity[] = [];
  const externalIdToInternalId = new Map<string, string>();

  // First pass: create all activities
  for (const xerActivity of xerActivities) {
    const persistentGuid = uuidv4();
    const activity = await prisma.scheduleActivity.create({
      data: {
        scheduleId: schedule.id,
        persistentInternalGuid: persistentGuid,
        externalGuid: xerActivity.externalId,
        name: xerActivity.name,
        startDate: xerActivity.startDate,
        finishDate: xerActivity.finishDate,
        duration: xerActivity.duration,
        percentComplete: 0,
        predecessorIds: [],
        successorIds: [],
        resourceIds: [],
      },
    });

    externalIdToInternalId.set(xerActivity.externalId, activity.id);
    activities.push({
      id: activity.id,
      scheduleId: activity.scheduleId,
      persistentInternalGuid: activity.persistentInternalGuid,
      externalGuid: activity.externalGuid || undefined,
      name: activity.name,
      startDate: activity.startDate.toISOString(),
      finishDate: activity.finishDate.toISOString(),
      duration: activity.duration,
      percentComplete: activity.percentComplete,
      predecessorIds: [],
      successorIds: [],
      resourceIds: [],
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
    });
  }

  // Second pass: establish relationships
  for (let i = 0; i < xerActivities.length; i++) {
    const xerActivity = xerActivities[i];
    const activityId = externalIdToInternalId.get(xerActivity.externalId);
    
    if (activityId && xerActivity.predecessors) {
      const predecessorIds = xerActivity.predecessors
        .map((extId) => externalIdToInternalId.get(extId))
        .filter((id): id is string => id !== undefined);

      await prisma.scheduleActivity.update({
        where: { id: activityId },
        data: { predecessorIds },
      });

      // Update successorIds on predecessors
      for (const predId of predecessorIds) {
        const pred = await prisma.scheduleActivity.findUnique({
          where: { id: predId },
        });
        if (pred) {
          await prisma.scheduleActivity.update({
            where: { id: predId },
            data: {
              successorIds: [...pred.successorIds, activityId],
            },
          });
        }
      }
    }
  }

  return {
    schedule: {
      id: schedule.id,
      projectId: schedule.projectId,
      name: schedule.name,
      status: schedule.status as 'draft' | 'active' | 'archived',
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
      createdBy: schedule.createdBy,
    },
    activities,
  };
}
