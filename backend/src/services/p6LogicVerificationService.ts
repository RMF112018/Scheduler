/**
 * P6 Logic Verification Service
 * 
 * Verifies that our Retained Logic CPM calculations match Primavera P6 benchmark results.
 * This service is critical for ensuring user trust in the scheduling engine.
 * 
 * Process:
 * 1. Parse benchmark XER file to extract P6 Early Finish (EF) and Late Finish (LF) dates
 * 2. Import the XER into our system
 * 3. Calculate CPM using our Retained Logic algorithm
 * 4. Compare dates activity-by-activity using internal_guid mapping
 * 5. Generate detailed verification report
 */

import { readFileSync } from 'fs';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { ActivityService } from '../modules/core/services/activityService.js';
import { importMappingService, ExternalActivity, ExternalRelationship } from './importMappingService.js';
import { BadRequestError } from '../utils/errors.js';

// ============================================================================
// Types
// ============================================================================

export interface P6DateComparison {
  activityId: string;
  activityName: string;
  persistentInternalGuid: string;
  externalId: string;
  p6EarlyFinish: Date | null;
  ourEarlyFinish: Date | null;
  p6LateFinish: Date | null;
  ourLateFinish: Date | null;
  earlyFinishDifferenceDays: number | null;
  lateFinishDifferenceDays: number | null;
  tolerance: number;
  status: 'match' | 'within_tolerance' | 'mismatch';
  isCritical: boolean;
}

export interface P6VerificationResult {
  totalActivities: number;
  matchingDates: number;
  withinTolerance: number;
  mismatches: number;
  dateDifferences: P6DateComparison[];
  overallMatch: boolean;
  matchPercentage: number;
  criticalPathMatches: number;
  criticalPathMismatches: number;
  summary: {
    earlyFinishMatches: number;
    lateFinishMatches: number;
    earlyFinishWithinTolerance: number;
    lateFinishWithinTolerance: number;
  };
}

// ============================================================================
// XER Parsing Utilities (reused from importController)
// ============================================================================

interface XerTable {
  fields: string[];
  rows: Record<string, string>[];
}

const parseXerTables = (content: string): Map<string, XerTable> => {
  const tables = new Map<string, XerTable>();
  let currentTable: XerTable | null = null;
  let currentTableName: string | null = null;

  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (const rawLine of lines) {
    if (!rawLine.trim()) {
      continue;
    }

    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith('%T')) {
      const [, tableName] = line.split('\t');
      if (!tableName) {
        continue;
      }
      currentTableName = tableName.trim();
      currentTable = { fields: [], rows: [] };
      tables.set(currentTableName, currentTable);
      continue;
    }

    if (line.startsWith('%F')) {
      if (!currentTable) {
        continue;
      }
      const parts = line.split('\t').slice(1);
      currentTable.fields = parts.map((field) => field.trim());
      continue;
    }

    if (line.startsWith('%R')) {
      if (!currentTable || !currentTableName) {
        continue;
      }
      const values = line.split('\t').slice(1);
      const row: Record<string, string> = {};
      currentTable.fields.forEach((field, index) => {
        row[field] = values[index] ?? '';
      });
      currentTable.rows.push(row);
    }
  }

  return tables;
};

const parseDate = (value?: string): Date | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

// ============================================================================
// P6 Logic Verification Service
// ============================================================================

export class P6LogicVerificationService {
  private activityService: ActivityService;
  private defaultToleranceDays: number = 1; // ±1 day tolerance for rounding differences

  constructor() {
    this.activityService = new ActivityService();
  }

  /**
   * Verify our CPM logic against a P6 benchmark XER file
   * 
   * @param scheduleId - The schedule ID to import and verify
   * @param benchmarkXerPath - Path to the P6 benchmark XER file
   * @param toleranceDays - Tolerance in days for acceptable differences (default: 1)
   * @returns Detailed verification report
   */
  async verifyAgainstBenchmark(
    scheduleId: string,
    benchmarkXerPath: string,
    toleranceDays: number = this.defaultToleranceDays
  ): Promise<P6VerificationResult> {
    logger.info(`Starting P6 logic verification for schedule ${scheduleId} against ${benchmarkXerPath}`);

    // 1. Read and parse benchmark XER file
    const xerContent = readFileSync(benchmarkXerPath, 'utf8');
    const tables = parseXerTables(xerContent);
    
    // 2. Extract P6 dates from TASK table
    const p6Dates = this.extractP6Dates(tables);
    
    // 3. Import XER into our system (if not already imported)
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        activities: {
          include: {
            importMapping: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new BadRequestError(`Schedule ${scheduleId} not found`);
    }

    // Import activities if needed
    if (schedule.activities.length === 0) {
      await this.importBenchmarkXER(scheduleId, schedule.projectId, xerContent);
    }

    // 4. Calculate CPM using our Retained Logic algorithm
    const cpmResult = await this.activityService.calculateCriticalPath(scheduleId, {
      useRetainedLogic: true,
    });

    // 5. Get project start date for date calculations
    const projectStartDate = schedule.startDate || new Date();
    
    // 6. Compare dates activity-by-activity
    const comparisons = await this.compareDates(
      scheduleId,
      p6Dates,
      cpmResult,
      projectStartDate,
      toleranceDays
    );

    // 7. Generate verification report
    const result = this.generateReport(comparisons, toleranceDays);

    logger.info(
      `P6 verification complete: ${result.matchPercentage.toFixed(2)}% match ` +
      `(${result.matchingDates}/${result.totalActivities} activities)`
    );

    return result;
  }

  /**
   * Extract P6 Early Finish and Late Finish dates from XER TASK table
   */
  private extractP6Dates(tables: Map<string, XerTable>): Map<string, { earlyFinish: Date | null; lateFinish: Date | null }> {
    const taskTable = tables.get('TASK');
    if (!taskTable) {
      throw new BadRequestError('XER file missing TASK table');
    }

    const dates = new Map<string, { earlyFinish: Date | null; lateFinish: Date | null }>();

    for (const row of taskTable.rows) {
      const externalId = row.task_id?.trim();
      if (!externalId) {
        continue;
      }

      // P6 stores dates in various fields - try early_end_date, late_end_date, target_end_date
      const earlyFinish =
        parseDate(row.early_end_date) ??
        parseDate(row.early_finish_date) ??
        parseDate(row.target_end_date) ??
        null;

      const lateFinish =
        parseDate(row.late_end_date) ??
        parseDate(row.late_finish_date) ??
        null;

      dates.set(externalId, { earlyFinish, lateFinish });
    }

    return dates;
  }

  /**
   * Import benchmark XER into our system
   */
  private async importBenchmarkXER(
    scheduleId: string,
    projectId: string,
    xerContent: string
  ): Promise<void> {
    const tables = parseXerTables(xerContent);
    
    // Build external activities
    const externalActivities = this.buildExternalActivities(tables);
    
    // Build external relationships
    const externalRelationships = this.buildExternalRelationships(tables);

    // Import activities
    await importMappingService.mapActivitiesWithPersistentGUID(
      externalActivities,
      scheduleId,
      projectId
    );

    // Import relationships
    if (externalRelationships.length > 0) {
      await importMappingService.preserveRelationships(
        externalRelationships,
        projectId,
        scheduleId
      );
    }
  }

  /**
   * Build external activities from XER tables (similar to importController)
   */
  private buildExternalActivities(tables: Map<string, XerTable>): ExternalActivity[] {
    const taskTable = tables.get('TASK');
    if (!taskTable) {
      throw new BadRequestError('XER file missing TASK table');
    }

    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    return taskTable.rows.map((row) => {
      const externalId = row.task_id?.trim();
      if (!externalId) {
        throw new BadRequestError('XER TASK row missing task_id');
      }

      const startDate =
        parseDate(row.target_start_date) ??
        parseDate(row.act_start_date) ??
        parseDate(row.early_start_date) ??
        parseDate(row.start_date);

      const finishDate =
        parseDate(row.target_end_date) ??
        parseDate(row.act_end_date) ??
        parseDate(row.early_end_date) ??
        parseDate(row.finish_date);

      if (!startDate || !finishDate) {
        throw new BadRequestError(`XER TASK row ${externalId} missing start/finish dates`);
      }

      const duration = Math.ceil((finishDate.getTime() - startDate.getTime()) / MS_PER_DAY);
      const percentComplete = row.phys_complete_pct
        ? Math.round(Number(row.phys_complete_pct))
        : undefined;

      return {
        externalId,
        activityCode: row.task_code?.trim() || undefined,
        name: row.task_name?.trim() || row.task_code?.trim() || externalId,
        startDate,
        finishDate,
        duration,
        percentComplete,
        metadata: { xer: row },
      };
    });
  }

  /**
   * Build external relationships from XER tables
   */
  private buildExternalRelationships(tables: Map<string, XerTable>): ExternalRelationship[] {
    const predTable = tables.get('TASKPRED');
    if (!predTable) {
      return [];
    }

    const relationships: ExternalRelationship[] = [];

    for (const row of predTable.rows) {
      const predecessorId = row.pred_task_id?.trim();
      const successorId = row.task_id?.trim();
      const predType = (row.pred_type?.trim() || 'FS').toUpperCase() as 'FS' | 'SS' | 'FF' | 'SF';
      const lagHours = row.lag_hr_cnt ? Number(row.lag_hr_cnt) : 0;
      const lagDays = Math.round(lagHours / 8); // Convert hours to days

      if (predecessorId && successorId) {
        relationships.push({
          predecessorExternalId: predecessorId,
          successorExternalId: successorId,
          type: predType,
          lag: lagDays > 0 ? lagDays : undefined,
        });
      }
    }

    return relationships;
  }

  /**
   * Compare P6 dates with our calculated dates
   */
  private async compareDates(
    scheduleId: string,
    p6Dates: Map<string, { earlyFinish: Date | null; lateFinish: Date | null }>,
    cpmResult: { activities: Array<{ id: string; earlyFinish: number; lateFinish: number; isCritical: boolean }> },
    projectStartDate: Date,
    toleranceDays: number
  ): Promise<P6DateComparison[]> {
    // Get all activities with their import mappings
    const activities = await prisma.scheduleActivity.findMany({
      where: { scheduleId },
      include: {
        importMapping: true,
      },
    });

    const comparisons: P6DateComparison[] = [];

    // Create a map of activity ID to CPM result
    const cpmMap = new Map(
      cpmResult.activities.map((a) => [a.id, a])
    );

    for (const activity of activities) {
      const externalId = activity.externalGuid || activity.importMapping?.externalId;
      if (!externalId) {
        continue; // Skip activities without external ID mapping
      }

      const p6Date = p6Dates.get(externalId);
      if (!p6Date) {
        continue; // Skip if P6 date not found
      }

      const cpmActivity = cpmMap.get(activity.id);
      if (!cpmActivity) {
        continue; // Skip if not in CPM result
      }

      // Convert our CPM dates (days from project start) to actual dates
      const ourEarlyFinish = new Date(projectStartDate);
      ourEarlyFinish.setDate(ourEarlyFinish.getDate() + cpmActivity.earlyFinish);

      const ourLateFinish = new Date(projectStartDate);
      ourLateFinish.setDate(ourLateFinish.getDate() + cpmActivity.lateFinish);

      // Calculate differences
      const earlyFinishDiff = p6Date.earlyFinish
        ? Math.round((ourEarlyFinish.getTime() - p6Date.earlyFinish.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const lateFinishDiff = p6Date.lateFinish
        ? Math.round((ourLateFinish.getTime() - p6Date.lateFinish.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Determine status
      const earlyMatch = earlyFinishDiff === null || Math.abs(earlyFinishDiff) <= toleranceDays;
      const lateMatch = lateFinishDiff === null || Math.abs(lateFinishDiff) <= toleranceDays;
      
      let status: 'match' | 'within_tolerance' | 'mismatch';
      if (earlyMatch && lateMatch) {
        status = earlyFinishDiff === 0 && lateFinishDiff === 0 ? 'match' : 'within_tolerance';
      } else {
        status = 'mismatch';
      }

      comparisons.push({
        activityId: activity.id,
        activityName: activity.name,
        persistentInternalGuid: activity.persistentInternalGuid,
        externalId,
        p6EarlyFinish: p6Date.earlyFinish,
        ourEarlyFinish,
        p6LateFinish: p6Date.lateFinish,
        ourLateFinish,
        earlyFinishDifferenceDays: earlyFinishDiff,
        lateFinishDifferenceDays: lateFinishDiff,
        tolerance: toleranceDays,
        status,
        isCritical: cpmActivity.isCritical,
      });
    }

    return comparisons;
  }

  /**
   * Generate verification report from comparisons
   */
  private generateReport(
    comparisons: P6DateComparison[],
    toleranceDays: number
  ): P6VerificationResult {
    const totalActivities = comparisons.length;
    let matchingDates = 0;
    let withinTolerance = 0;
    let mismatches = 0;
    let criticalPathMatches = 0;
    let criticalPathMismatches = 0;
    let earlyFinishMatches = 0;
    let lateFinishMatches = 0;
    let earlyFinishWithinTolerance = 0;
    let lateFinishWithinTolerance = 0;

    for (const comp of comparisons) {
      if (comp.status === 'match') {
        matchingDates++;
        if (comp.earlyFinishDifferenceDays === 0) earlyFinishMatches++;
        if (comp.lateFinishDifferenceDays === 0) lateFinishMatches++;
        if (comp.isCritical) criticalPathMatches++;
      } else if (comp.status === 'within_tolerance') {
        withinTolerance++;
        if (comp.earlyFinishDifferenceDays !== null && Math.abs(comp.earlyFinishDifferenceDays) <= toleranceDays) {
          earlyFinishWithinTolerance++;
        }
        if (comp.lateFinishDifferenceDays !== null && Math.abs(comp.lateFinishDifferenceDays) <= toleranceDays) {
          lateFinishWithinTolerance++;
        }
        if (comp.isCritical) criticalPathMatches++;
      } else {
        mismatches++;
        if (comp.isCritical) criticalPathMismatches++;
      }
    }

    const matchPercentage = totalActivities > 0
      ? ((matchingDates + withinTolerance) / totalActivities) * 100
      : 0;

    return {
      totalActivities,
      matchingDates,
      withinTolerance,
      mismatches,
      dateDifferences: comparisons,
      overallMatch: mismatches === 0,
      matchPercentage,
      criticalPathMatches,
      criticalPathMismatches,
      summary: {
        earlyFinishMatches,
        lateFinishMatches,
        earlyFinishWithinTolerance,
        lateFinishWithinTolerance,
      },
    };
  }
}

// Export singleton instance
export const p6LogicVerificationService = new P6LogicVerificationService();
