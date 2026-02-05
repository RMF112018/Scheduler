/**
 * Core Module
 *
 * Phase 9: Core scheduling functionality including schedules, activities,
 * lookahead workflows, validation, and import/export.
 */

// Services
export { scheduleService, ScheduleService } from './services/scheduleService.js';
export { activityService, ActivityService } from './services/activityService.js';
export { lookaheadService, LookaheadService } from './services/lookaheadService.js';
export { scheduleValidationService, ScheduleValidationService } from './services/scheduleValidationService.js';
export { importMappingService, ImportMappingService } from './services/importMappingService.js';

// Types
export type {
  CreateScheduleDto,
  UpdateScheduleDto,
  BaselineVariance,
  BaselineComparison,
  ScheduleWithDetails,
} from './services/scheduleService.js';

export type {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityNode,
  CriticalPathResult,
  CriticalPathOptions,
} from './services/activityService.js';

export type {
  CreateLookaheadDto,
  UpdateLookaheadActivityDto,
  Conflict,
  MergeResult,
  CommitResult,
  LookaheadWithActivities,
} from './services/lookaheadService.js';

export type {
  ExternalActivity,
  ExternalRelationship,
  ImportDiff,
  ImportDiffActivity,
  ImportChange,
  DiffApproval,
  ImportResult,
  FieldTiesResult,
} from './services/importMappingService.js';

export type {
  OutOfSequenceStatus,
  ValidationRuleSeverity,
  ValidationRuleType,
  OutOfSequenceViolation,
  ValidationIssue,
  ValidationResult,
  ResolveOutOfSequenceDto,
  DCMA14Config,
} from './services/scheduleValidationService.js';
