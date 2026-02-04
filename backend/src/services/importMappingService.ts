import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { ImportMapping, ScheduleActivity } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Types
export interface ExternalActivity {
  externalId: string;
  activityCode?: string;
  name: string;
  startDate: Date;
  finishDate: Date;
  duration: number;
  percentComplete?: number;
  metadata?: Record<string, unknown>;
}

export interface ExternalRelationship {
  predecessorExternalId: string;
  successorExternalId: string;
  type: 'FS' | 'SS' | 'FF' | 'SF'; // Finish-Start, Start-Start, Finish-Finish, Start-Finish
  lag?: number; // Lag in days
}

export interface ImportDiffActivity {
  persistentInternalGuid: string;
  externalId: string;
  activityName: string;
  changes: ImportChange[];
  hasFieldAttachments: boolean;
  hasLookaheadEdits: boolean;
}

export interface ImportChange {
  field: string;
  oldValue: string | number | Date | null;
  newValue: string | number | Date | null;
}

export interface ImportDiff {
  newActivities: ExternalActivity[];
  updatedActivities: ImportDiffActivity[];
  deletedActivities: {
    persistentInternalGuid: string;
    name: string;
    hasFieldData: boolean;
  }[];
  preservedFieldData: {
    persistentInternalGuid: string;
    activityName: string;
    attachmentsCount: number;
    lookaheadEditsCount: number;
  }[];
  summary: {
    totalNew: number;
    totalUpdated: number;
    totalDeleted: number;
    totalWithFieldData: number;
  };
}

export interface DiffApproval {
  approvedChanges: string[]; // List of persistent GUIDs approved for update
  preserveFieldData: boolean; // Whether to preserve field data for updated activities
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: string[];
}

export interface FieldTiesResult {
  attachments: {
    id: string;
    attachmentType: string;
    fileName: string | null;
  }[];
  lookaheadEdits: {
    id: string;
    lookaheadScheduleId: string;
    plannerStatus: string | null;
  }[];
  preserved: boolean;
}

/**
 * ImportMappingService - Handles GUID mapping for import resilience
 * 
 * Key Features:
 * - Persistent Internal GUID mapping (preserves field ties across re-imports)
 * - Diff preview before import (PM approval for field data preservation)
 * - External ID to Internal GUID mapping
 * - Relationship preservation during imports
 */
export class ImportMappingService {
  /**
   * Map an external ID to a persistent internal GUID
   * Creates a new mapping if one doesn't exist
   */
  async mapExternalGUIDToPersistent(
    externalId: string,
    projectId: string,
    scheduleId: string
  ): Promise<string> {
    // Check if external ID already mapped to persistent internal GUID
    const existing = await prisma.importMapping.findUnique({
      where: {
        projectId_externalId: {
          projectId,
          externalId,
        },
      },
    });

    if (existing) {
      // Update last imported timestamp
      await prisma.importMapping.update({
        where: { id: existing.id },
        data: {
          lastImportedAt: new Date(),
          scheduleId, // Update schedule reference if changed
        },
      });

      return existing.persistentInternalGuid;
    }

    // Create new persistent internal GUID
    const persistentGuid = uuidv4();

    // Create mapping: external_id + project_id → persistent_internal_guid
    await prisma.importMapping.create({
      data: {
        externalId,
        projectId,
        persistentInternalGuid: persistentGuid,
        scheduleId,
        firstImportedAt: new Date(),
        lastImportedAt: new Date(),
      },
    });

    logger.info(
      `Created new import mapping: ${externalId} -> ${persistentGuid} for project ${projectId}`
    );

    return persistentGuid;
  }

  /**
   * Get the persistent internal GUID for an external ID
   * Returns null if no mapping exists
   */
  async getPersistentGuid(externalId: string, projectId: string): Promise<string | null> {
    const mapping = await prisma.importMapping.findUnique({
      where: {
        projectId_externalId: {
          projectId,
          externalId,
        },
      },
    });

    return mapping?.persistentInternalGuid ?? null;
  }

  /**
   * Get the mapping for an external ID
   */
  async getMapping(externalId: string, projectId: string): Promise<ImportMapping | null> {
    return prisma.importMapping.findUnique({
      where: {
        projectId_externalId: {
          projectId,
          externalId,
        },
      },
    });
  }

  /**
   * Preserve field ties for an activity
   * Returns all attachments and lookahead edits associated with the persistent GUID
   */
  async preserveFieldTies(persistentGuid: string): Promise<FieldTiesResult> {
    // Get attachments
    const attachments = await prisma.activityAttachment.findMany({
      where: { persistentInternalGuid: persistentGuid },
      select: {
        id: true,
        attachmentType: true,
        fileName: true,
      },
    });

    // Get lookahead edits
    const lookaheadEdits = await prisma.lookaheadActivity.findMany({
      where: { persistentInternalGuid: persistentGuid },
      select: {
        id: true,
        lookaheadScheduleId: true,
        plannerStatus: true,
      },
    });

    return {
      attachments,
      lookaheadEdits,
      preserved: attachments.length + lookaheadEdits.length > 0,
    };
  }

  /**
   * Check if an activity has field data (attachments or lookahead edits)
   */
  async hasFieldData(persistentGuid: string): Promise<boolean> {
    const [attachmentsCount, lookaheadCount] = await Promise.all([
      prisma.activityAttachment.count({
        where: { persistentInternalGuid: persistentGuid },
      }),
      prisma.lookaheadActivity.count({
        where: { persistentInternalGuid: persistentGuid },
      }),
    ]);

    return attachmentsCount > 0 || lookaheadCount > 0;
  }

  /**
   * Preserve relationships during import
   * Maps external relationship IDs to internal GUIDs
   */
  async preserveRelationships(
    externalRelationships: ExternalRelationship[],
    projectId: string,
    scheduleId: string
  ): Promise<void> {
    for (const rel of externalRelationships) {
      // Get internal GUIDs for predecessor and successor
      const predecessorGuid = await this.getPersistentGuid(rel.predecessorExternalId, projectId);
      const successorGuid = await this.getPersistentGuid(rel.successorExternalId, projectId);

      if (!predecessorGuid || !successorGuid) {
        logger.warn(
          `Skipping relationship: predecessor or successor not found for ${rel.predecessorExternalId} -> ${rel.successorExternalId}`
        );
        continue;
      }

      // Find the actual activities
      const [predecessor, successor] = await Promise.all([
        prisma.scheduleActivity.findFirst({
          where: {
            scheduleId,
            persistentInternalGuid: predecessorGuid,
          },
        }),
        prisma.scheduleActivity.findFirst({
          where: {
            scheduleId,
            persistentInternalGuid: successorGuid,
          },
        }),
      ]);

      if (!predecessor || !successor) {
        logger.warn(
          `Skipping relationship: activities not found for GUIDs ${predecessorGuid} -> ${successorGuid}`
        );
        continue;
      }

      // Update successor's predecessor list
      if (!successor.predecessorIds.includes(predecessor.id)) {
        await prisma.scheduleActivity.update({
          where: { id: successor.id },
          data: {
            predecessorIds: [...successor.predecessorIds, predecessor.id],
          },
        });
      }

      // Update predecessor's successor list
      if (!predecessor.successorIds.includes(successor.id)) {
        await prisma.scheduleActivity.update({
          where: { id: predecessor.id },
          data: {
            successorIds: [...predecessor.successorIds, successor.id],
          },
        });
      }
    }

    logger.info(
      `Preserved ${externalRelationships.length} relationships for schedule ${scheduleId}`
    );
  }

  /**
   * Generate a diff preview before import
   * Shows what will be added, updated, or deleted
   */
  async previewImportDiff(
    externalActivities: ExternalActivity[],
    scheduleId: string,
    projectId: string
  ): Promise<ImportDiff> {
    const diff: ImportDiff = {
      newActivities: [],
      updatedActivities: [],
      deletedActivities: [],
      preservedFieldData: [],
      summary: {
        totalNew: 0,
        totalUpdated: 0,
        totalDeleted: 0,
        totalWithFieldData: 0,
      },
    };

    // Get existing activities
    const existingActivities = await prisma.scheduleActivity.findMany({
      where: { scheduleId },
    });

    const existingByGuid = new Map(
      existingActivities.map((a) => [a.persistentInternalGuid, a])
    );

    // Get all import mappings for this project
    const mappings = await prisma.importMapping.findMany({
      where: { projectId },
    });

    const mappingByExternalId = new Map(mappings.map((m) => [m.externalId, m]));

    // Track which existing activities are still in the import
    const seenGuids = new Set<string>();

    for (const extActivity of externalActivities) {
      const mapping = mappingByExternalId.get(extActivity.externalId);

      if (!mapping) {
        // New activity
        diff.newActivities.push(extActivity);
        diff.summary.totalNew++;
      } else {
        seenGuids.add(mapping.persistentInternalGuid);

        const existingActivity = existingByGuid.get(mapping.persistentInternalGuid);

        if (existingActivity) {
          // Check for changes
          const changes = this.detectChanges(existingActivity, extActivity);

          if (changes.length > 0) {
            // Check for field data
            const [attachmentsCount, lookaheadCount] = await Promise.all([
              prisma.activityAttachment.count({
                where: { persistentInternalGuid: mapping.persistentInternalGuid },
              }),
              prisma.lookaheadActivity.count({
                where: { persistentInternalGuid: mapping.persistentInternalGuid },
              }),
            ]);

            diff.updatedActivities.push({
              persistentInternalGuid: mapping.persistentInternalGuid,
              externalId: extActivity.externalId,
              activityName: existingActivity.name,
              changes,
              hasFieldAttachments: attachmentsCount > 0,
              hasLookaheadEdits: lookaheadCount > 0,
            });

            diff.summary.totalUpdated++;

            if (attachmentsCount > 0 || lookaheadCount > 0) {
              diff.preservedFieldData.push({
                persistentInternalGuid: mapping.persistentInternalGuid,
                activityName: existingActivity.name,
                attachmentsCount,
                lookaheadEditsCount: lookaheadCount,
              });
              diff.summary.totalWithFieldData++;
            }
          }
        }
      }
    }

    // Find deleted activities (in existing but not in import)
    for (const [guid, activity] of existingByGuid) {
      if (!seenGuids.has(guid)) {
        const hasFieldData = await this.hasFieldData(guid);

        diff.deletedActivities.push({
          persistentInternalGuid: guid,
          name: activity.name,
          hasFieldData,
        });

        diff.summary.totalDeleted++;
      }
    }

    return diff;
  }

  /**
   * Detect changes between existing and incoming activity
   */
  private detectChanges(
    existing: ScheduleActivity,
    incoming: ExternalActivity
  ): ImportChange[] {
    const changes: ImportChange[] = [];

    if (existing.name !== incoming.name) {
      changes.push({ field: 'name', oldValue: existing.name, newValue: incoming.name });
    }

    const existingStart = existing.startDate.toISOString().split('T')[0];
    const incomingStart = incoming.startDate.toISOString().split('T')[0];
    if (existingStart !== incomingStart) {
      changes.push({
        field: 'startDate',
        oldValue: existingStart,
        newValue: incomingStart,
      });
    }

    const existingFinish = existing.finishDate.toISOString().split('T')[0];
    const incomingFinish = incoming.finishDate.toISOString().split('T')[0];
    if (existingFinish !== incomingFinish) {
      changes.push({
        field: 'finishDate',
        oldValue: existingFinish,
        newValue: incomingFinish,
      });
    }

    if (existing.duration !== incoming.duration) {
      changes.push({
        field: 'duration',
        oldValue: existing.duration,
        newValue: incoming.duration,
      });
    }

    if (existing.activityCode !== incoming.activityCode) {
      changes.push({
        field: 'activityCode',
        oldValue: existing.activityCode,
        newValue: incoming.activityCode ?? null,
      });
    }

    return changes;
  }

  /**
   * Map activities with persistent GUIDs during import
   * Creates or updates activities while preserving field ties
   */
  async mapActivitiesWithPersistentGUID(
    externalActivities: ExternalActivity[],
    scheduleId: string,
    projectId: string,
    diffApproval?: DiffApproval
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      importedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    for (const extActivity of externalActivities) {
      try {
        // Get or create persistent GUID
        const persistentGuid = await this.mapExternalGUIDToPersistent(
          extActivity.externalId,
          projectId,
          scheduleId
        );

        // Check if activity already exists
        const existingActivity = await prisma.scheduleActivity.findFirst({
          where: {
            scheduleId,
            persistentInternalGuid: persistentGuid,
          },
        });

        if (existingActivity) {
          // Check if update is approved (if diffApproval provided)
          if (diffApproval && !diffApproval.approvedChanges.includes(persistentGuid)) {
            result.skippedCount++;
            continue;
          }

          // Update existing activity
          await prisma.scheduleActivity.update({
            where: { id: existingActivity.id },
            data: {
              externalGuid: extActivity.externalId,
              activityCode: extActivity.activityCode,
              name: extActivity.name,
              startDate: extActivity.startDate,
              finishDate: extActivity.finishDate,
              duration: extActivity.duration,
              percentComplete: extActivity.percentComplete ?? existingActivity.percentComplete,
              metadata: extActivity.metadata ? JSON.parse(JSON.stringify(extActivity.metadata)) : undefined,
              updatedAt: new Date(),
            },
          });

          result.updatedCount++;
        } else {
          // Create new activity
          await prisma.scheduleActivity.create({
            data: {
              scheduleId,
              persistentInternalGuid: persistentGuid,
              externalGuid: extActivity.externalId,
              activityCode: extActivity.activityCode,
              name: extActivity.name,
              startDate: extActivity.startDate,
              finishDate: extActivity.finishDate,
              duration: extActivity.duration,
              percentComplete: extActivity.percentComplete ?? 0,
              predecessorIds: [],
              successorIds: [],
              resourceIds: [],
              totalFloat: 0,
              isCritical: false,
              metadata: extActivity.metadata ? JSON.parse(JSON.stringify(extActivity.metadata)) : undefined,
            },
          });

          result.importedCount++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(
          `Failed to import activity ${extActivity.externalId}: ${errorMessage}`
        );
        result.success = false;
      }
    }

    logger.info(
      `Import completed: ${result.importedCount} new, ${result.updatedCount} updated, ${result.skippedCount} skipped, ${result.errors.length} errors`
    );

    return result;
  }

  /**
   * Get all mappings for a project
   */
  async getMappingsByProject(projectId: string): Promise<ImportMapping[]> {
    return prisma.importMapping.findMany({
      where: { projectId },
      orderBy: { lastImportedAt: 'desc' },
    });
  }

  /**
   * Get all mappings for a schedule
   */
  async getMappingsBySchedule(scheduleId: string): Promise<ImportMapping[]> {
    return prisma.importMapping.findMany({
      where: { scheduleId },
      orderBy: { lastImportedAt: 'desc' },
    });
  }

  /**
   * Delete a mapping
   */
  async deleteMapping(mappingId: string): Promise<void> {
    await prisma.importMapping.delete({
      where: { id: mappingId },
    });
  }

  /**
   * Delete all mappings for a project
   */
  async deleteMappingsByProject(projectId: string): Promise<number> {
    const result = await prisma.importMapping.deleteMany({
      where: { projectId },
    });

    return result.count;
  }
}

// Export singleton instance
export const importMappingService = new ImportMappingService();
