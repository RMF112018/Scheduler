import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { ScheduleActivity, Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export type OutOfSequenceStatus = 'detected' | 'acknowledged' | 'resolved';

export type ValidationRuleSeverity = 'error' | 'warning' | 'info';

export type ValidationRuleType =
  | 'missing_logic'
  | 'negative_float'
  | 'high_duration'
  | 'high_float'
  | 'invalid_constraint'
  | 'dangling_activity'
  | 'out_of_sequence'
  | 'circular_dependency';

export interface OutOfSequenceViolation {
  activityId: string;
  activityName: string;
  persistentInternalGuid: string;
  violationType: 'actual_start_before_predecessor' | 'actual_finish_before_predecessor';
  predecessorId: string;
  predecessorName: string;
  activityActualDate: Date;
  predecessorActualFinish: Date | null;
  message: string;
}

export interface ValidationIssue {
  ruleType: ValidationRuleType;
  severity: ValidationRuleSeverity;
  activityId: string;
  activityName: string;
  persistentInternalGuid: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  scheduleId: string;
  isValid: boolean;
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: ValidationIssue[];
  outOfSequenceViolations: OutOfSequenceViolation[];
  validatedAt: Date;
}

export interface ResolveOutOfSequenceDto {
  activityId: string;
  reason: string;
  resolvedBy: string;
  attachmentId?: string;
}

export interface DCMA14Config {
  highDurationThreshold?: number; // Default: 20 days
  highFloatThreshold?: number; // Default: 44 days
  enableMissingLogic?: boolean;
  enableNegativeFloat?: boolean;
  enableHighDuration?: boolean;
  enableHighFloat?: boolean;
  enableDanglingActivities?: boolean;
}

const DEFAULT_DCMA14_CONFIG: Required<DCMA14Config> = {
  highDurationThreshold: 20,
  highFloatThreshold: 44,
  enableMissingLogic: true,
  enableNegativeFloat: true,
  enableHighDuration: true,
  enableHighFloat: true,
  enableDanglingActivities: true,
};

// ============================================================================
// ScheduleValidationService
// ============================================================================

export class ScheduleValidationService {
  /**
   * Detect out-of-sequence activities in a schedule
   * 
   * Out-of-sequence occurs when:
   * - An activity's actual start is before any predecessor's actual finish
   * - An activity's actual finish is before any predecessor's actual finish
   */
  async detectOutOfSequence(scheduleId: string): Promise<OutOfSequenceViolation[]> {
    const activities = await prisma.scheduleActivity.findMany({
      where: { scheduleId },
    });

    const violations: OutOfSequenceViolation[] = [];
    const activityMap = new Map(activities.map((a) => [a.id, a]));

    for (const activity of activities) {
      // Skip activities without actual dates
      if (!activity.actualStartDate && !activity.actualFinishDate) {
        continue;
      }

      // Check each predecessor
      for (const predecessorId of activity.predecessorIds) {
        const predecessor = activityMap.get(predecessorId);
        if (!predecessor) continue;

        // Check if actual start is before predecessor's actual finish
        if (activity.actualStartDate && predecessor.actualFinishDate) {
          if (activity.actualStartDate < predecessor.actualFinishDate) {
            violations.push({
              activityId: activity.id,
              activityName: activity.name,
              persistentInternalGuid: activity.persistentInternalGuid,
              violationType: 'actual_start_before_predecessor',
              predecessorId: predecessor.id,
              predecessorName: predecessor.name,
              activityActualDate: activity.actualStartDate,
              predecessorActualFinish: predecessor.actualFinishDate,
              message: `Activity "${activity.name}" started on ${activity.actualStartDate.toISOString().split('T')[0]} before predecessor "${predecessor.name}" finished on ${predecessor.actualFinishDate.toISOString().split('T')[0]}`,
            });
          }
        }

        // Check if actual finish is before predecessor's actual finish
        if (activity.actualFinishDate && predecessor.actualFinishDate) {
          if (activity.actualFinishDate < predecessor.actualFinishDate) {
            violations.push({
              activityId: activity.id,
              activityName: activity.name,
              persistentInternalGuid: activity.persistentInternalGuid,
              violationType: 'actual_finish_before_predecessor',
              predecessorId: predecessor.id,
              predecessorName: predecessor.name,
              activityActualDate: activity.actualFinishDate,
              predecessorActualFinish: predecessor.actualFinishDate,
              message: `Activity "${activity.name}" finished on ${activity.actualFinishDate.toISOString().split('T')[0]} before predecessor "${predecessor.name}" finished on ${predecessor.actualFinishDate.toISOString().split('T')[0]}`,
            });
          }
        }

        // Also check: activity started but predecessor not yet finished (in-progress predecessor)
        if (activity.actualStartDate && !predecessor.actualFinishDate && predecessor.percentComplete < 100) {
          // Predecessor is in-progress but successor has already started
          violations.push({
            activityId: activity.id,
            activityName: activity.name,
            persistentInternalGuid: activity.persistentInternalGuid,
            violationType: 'actual_start_before_predecessor',
            predecessorId: predecessor.id,
            predecessorName: predecessor.name,
            activityActualDate: activity.actualStartDate,
            predecessorActualFinish: null,
            message: `Activity "${activity.name}" started before predecessor "${predecessor.name}" has finished (predecessor is ${predecessor.percentComplete}% complete)`,
          });
        }
      }
    }

    return violations;
  }

  /**
   * Flag activities with out-of-sequence status
   */
  async flagOutOfSequenceActivities(scheduleId: string): Promise<number> {
    const violations = await this.detectOutOfSequence(scheduleId);
    
    // Group violations by activity
    const violationsByActivity = new Map<string, OutOfSequenceViolation[]>();
    for (const violation of violations) {
      const existing = violationsByActivity.get(violation.activityId) || [];
      existing.push(violation);
      violationsByActivity.set(violation.activityId, existing);
    }

    // Update activities with out-of-sequence status
    let flaggedCount = 0;
    for (const [activityId, activityViolations] of violationsByActivity) {
      // Check if activity is already resolved or acknowledged
      const activity = await prisma.scheduleActivity.findUnique({
        where: { id: activityId },
      });

      if (activity && activity.outOfSequenceStatus !== 'resolved') {
        await prisma.scheduleActivity.update({
          where: { id: activityId },
          data: {
            outOfSequenceStatus: 'detected',
            outOfSequenceReason: activityViolations.map((v) => v.message).join('; '),
          },
        });
        flaggedCount++;
      }
    }

    logger.info(`Flagged ${flaggedCount} out-of-sequence activities in schedule ${scheduleId}`);
    return flaggedCount;
  }

  /**
   * Resolve an out-of-sequence violation
   * Requires mandatory comment and optional attachment
   */
  async resolveOutOfSequence(data: ResolveOutOfSequenceDto): Promise<ScheduleActivity> {
    const activity = await prisma.scheduleActivity.findUnique({
      where: { id: data.activityId },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    if (activity.outOfSequenceStatus !== 'detected' && activity.outOfSequenceStatus !== 'acknowledged') {
      throw new Error('Activity is not flagged as out-of-sequence');
    }

    if (!data.reason || data.reason.trim().length === 0) {
      throw new Error('Resolution reason is required');
    }

    const updated = await prisma.scheduleActivity.update({
      where: { id: data.activityId },
      data: {
        outOfSequenceStatus: 'resolved',
        outOfSequenceReason: data.reason,
        outOfSequenceResolvedBy: data.resolvedBy,
        outOfSequenceResolvedAt: new Date(),
        outOfSequenceAttachmentId: data.attachmentId || null,
      },
    });

    logger.info(`Out-of-sequence resolved for activity ${data.activityId} by ${data.resolvedBy}`);
    return updated;
  }

  /**
   * Acknowledge an out-of-sequence violation (user has seen it but not resolved)
   */
  async acknowledgeOutOfSequence(activityId: string): Promise<ScheduleActivity> {
    const activity = await prisma.scheduleActivity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    if (activity.outOfSequenceStatus !== 'detected') {
      throw new Error('Activity is not flagged as out-of-sequence');
    }

    return prisma.scheduleActivity.update({
      where: { id: activityId },
      data: {
        outOfSequenceStatus: 'acknowledged',
      },
    });
  }

  /**
   * Get all out-of-sequence activities for a schedule
   */
  async getOutOfSequenceActivities(scheduleId: string): Promise<ScheduleActivity[]> {
    return prisma.scheduleActivity.findMany({
      where: {
        scheduleId,
        outOfSequenceStatus: {
          not: null,
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Validate schedule against DCMA-14 style rules
   */
  async validateSchedule(
    scheduleId: string,
    config: DCMA14Config = {}
  ): Promise<ValidationResult> {
    const mergedConfig = { ...DEFAULT_DCMA14_CONFIG, ...config };
    const issues: ValidationIssue[] = [];

    const activities = await prisma.scheduleActivity.findMany({
      where: { scheduleId },
    });

    if (activities.length === 0) {
      return {
        scheduleId,
        isValid: true,
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        issues: [],
        outOfSequenceViolations: [],
        validatedAt: new Date(),
      };
    }

    const activityMap = new Map(activities.map((a) => [a.id, a]));

    // Run validation rules
    for (const activity of activities) {
      // Rule 1: Missing Logic (no predecessors AND no successors)
      if (mergedConfig.enableMissingLogic) {
        if (activity.predecessorIds.length === 0 && activity.successorIds.length === 0) {
          issues.push({
            ruleType: 'missing_logic',
            severity: 'warning',
            activityId: activity.id,
            activityName: activity.name,
            persistentInternalGuid: activity.persistentInternalGuid,
            message: `Activity "${activity.name}" has no predecessors or successors (missing logic)`,
            details: {
              predecessorCount: 0,
              successorCount: 0,
            },
          });
        }
      }

      // Rule 2: Negative Float
      if (mergedConfig.enableNegativeFloat && activity.totalFloat !== null) {
        if (activity.totalFloat < 0) {
          issues.push({
            ruleType: 'negative_float',
            severity: 'error',
            activityId: activity.id,
            activityName: activity.name,
            persistentInternalGuid: activity.persistentInternalGuid,
            message: `Activity "${activity.name}" has negative float (${activity.totalFloat} days)`,
            details: {
              totalFloat: activity.totalFloat,
            },
          });
        }
      }

      // Rule 3: High Duration (>threshold days without WBS breakdown)
      if (mergedConfig.enableHighDuration) {
        if (activity.duration > mergedConfig.highDurationThreshold) {
          issues.push({
            ruleType: 'high_duration',
            severity: 'warning',
            activityId: activity.id,
            activityName: activity.name,
            persistentInternalGuid: activity.persistentInternalGuid,
            message: `Activity "${activity.name}" has high duration (${activity.duration} days > ${mergedConfig.highDurationThreshold} days threshold)`,
            details: {
              duration: activity.duration,
              threshold: mergedConfig.highDurationThreshold,
            },
          });
        }
      }

      // Rule 4: High Float (>threshold days)
      if (mergedConfig.enableHighFloat && activity.totalFloat !== null) {
        if (activity.totalFloat > mergedConfig.highFloatThreshold) {
          issues.push({
            ruleType: 'high_float',
            severity: 'info',
            activityId: activity.id,
            activityName: activity.name,
            persistentInternalGuid: activity.persistentInternalGuid,
            message: `Activity "${activity.name}" has high float (${activity.totalFloat} days > ${mergedConfig.highFloatThreshold} days threshold)`,
            details: {
              totalFloat: activity.totalFloat,
              threshold: mergedConfig.highFloatThreshold,
            },
          });
        }
      }

      // Rule 5: Dangling Activities (start without predecessors or finish without successors)
      if (mergedConfig.enableDanglingActivities) {
        // Check for dangling start (no predecessors but has successors)
        const hasPredecessors = activity.predecessorIds.length > 0;
        const hasSuccessors = activity.successorIds.length > 0;

        // Only flag if it's not a true start or end activity
        // A true start has no predecessors but has successors
        // A true end has predecessors but no successors
        // Dangling = isolated (no connections) - already caught by missing_logic
        // But we can flag activities that reference non-existent predecessors/successors
        
        for (const predId of activity.predecessorIds) {
          if (!activityMap.has(predId)) {
            issues.push({
              ruleType: 'dangling_activity',
              severity: 'error',
              activityId: activity.id,
              activityName: activity.name,
              persistentInternalGuid: activity.persistentInternalGuid,
              message: `Activity "${activity.name}" references non-existent predecessor (${predId})`,
              details: {
                missingPredecessorId: predId,
              },
            });
          }
        }

        for (const succId of activity.successorIds) {
          if (!activityMap.has(succId)) {
            issues.push({
              ruleType: 'dangling_activity',
              severity: 'error',
              activityId: activity.id,
              activityName: activity.name,
              persistentInternalGuid: activity.persistentInternalGuid,
              message: `Activity "${activity.name}" references non-existent successor (${succId})`,
              details: {
                missingSuccessorId: succId,
              },
            });
          }
        }
      }
    }

    // Detect out-of-sequence violations
    const outOfSequenceViolations = await this.detectOutOfSequence(scheduleId);
    
    // Add out-of-sequence issues
    for (const violation of outOfSequenceViolations) {
      issues.push({
        ruleType: 'out_of_sequence',
        severity: 'error',
        activityId: violation.activityId,
        activityName: violation.activityName,
        persistentInternalGuid: violation.persistentInternalGuid,
        message: violation.message,
        details: {
          violationType: violation.violationType,
          predecessorId: violation.predecessorId,
          predecessorName: violation.predecessorName,
        },
      });
    }

    // Count issues by severity
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    const infoCount = issues.filter((i) => i.severity === 'info').length;

    const result: ValidationResult = {
      scheduleId,
      isValid: errorCount === 0,
      totalIssues: issues.length,
      errorCount,
      warningCount,
      infoCount,
      issues,
      outOfSequenceViolations,
      validatedAt: new Date(),
    };

    logger.info(
      `Schedule ${scheduleId} validated: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info`
    );

    return result;
  }

  /**
   * Run validation on schedule save/import/approval request
   * Returns validation result and optionally blocks operation if errors exist
   */
  async validateOnAction(
    scheduleId: string,
    action: 'save' | 'import' | 'approval',
    config?: DCMA14Config
  ): Promise<ValidationResult> {
    const result = await this.validateSchedule(scheduleId, config);

    // Flag out-of-sequence activities
    await this.flagOutOfSequenceActivities(scheduleId);

    // Log action-specific validation
    logger.info(`Validation on ${action} for schedule ${scheduleId}: ${result.isValid ? 'PASSED' : 'FAILED'}`);

    return result;
  }

  /**
   * Get validation summary for dashboard display
   */
  async getValidationSummary(scheduleId: string): Promise<{
    totalActivities: number;
    outOfSequenceCount: number;
    missingLogicCount: number;
    negativeFloatCount: number;
    highDurationCount: number;
    highFloatCount: number;
  }> {
    const result = await this.validateSchedule(scheduleId);
    const activities = await prisma.scheduleActivity.findMany({
      where: { scheduleId },
    });

    return {
      totalActivities: activities.length,
      outOfSequenceCount: result.outOfSequenceViolations.length,
      missingLogicCount: result.issues.filter((i) => i.ruleType === 'missing_logic').length,
      negativeFloatCount: result.issues.filter((i) => i.ruleType === 'negative_float').length,
      highDurationCount: result.issues.filter((i) => i.ruleType === 'high_duration').length,
      highFloatCount: result.issues.filter((i) => i.ruleType === 'high_float').length,
    };
  }
}

// Export singleton instance
export const scheduleValidationService = new ScheduleValidationService();
