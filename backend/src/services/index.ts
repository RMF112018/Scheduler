// Service exports
export { scheduleService, ScheduleService } from './scheduleService.js';
export { activityService, ActivityService } from './activityService.js';
export { lookaheadService, LookaheadService } from './lookaheadService.js';
export { importMappingService, ImportMappingService } from './importMappingService.js';
export { scheduleValidationService, ScheduleValidationService } from './scheduleValidationService.js';
export { staffService, StaffService } from './staffService.js';
export { forecastingService, ForecastingService } from './forecastingService.js';
export {
  initializeSocketIO,
  notifyProjectUpdate,
  notifyScheduleUpdate,
  notifyLookaheadUpdate,
  notifyApprovalStatus,
  notifyCompany,
  getIO,
} from './socketService.js';

// Types
export type {
  CreateScheduleDto,
  UpdateScheduleDto,
  BaselineVariance,
  BaselineComparison,
  ScheduleWithDetails,
} from './scheduleService.js';

export type {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityNode,
  CriticalPathResult,
  CriticalPathOptions,
} from './activityService.js';

export type {
  CreateLookaheadDto,
  UpdateLookaheadActivityDto,
  Conflict,
  MergeResult,
  CommitResult,
  LookaheadWithActivities,
} from './lookaheadService.js';

export type {
  ExternalActivity,
  ExternalRelationship,
  ImportDiff,
  ImportDiffActivity,
  ImportChange,
  DiffApproval,
  ImportResult,
  FieldTiesResult,
} from './importMappingService.js';

export type {
  OutOfSequenceStatus,
  ValidationRuleSeverity,
  ValidationRuleType,
  OutOfSequenceViolation,
  ValidationIssue,
  ValidationResult,
  ResolveOutOfSequenceDto,
  DCMA14Config,
} from './scheduleValidationService.js';

export type {
  StaffRoleInput,
  StaffMemberInput,
  StaffAssignmentInput,
  AllocationInfo,
  StaffAvailabilityResult,
} from './staffService.js';

export type {
  ProjectForecast,
  StaffSuggestion,
  NewHireNeedsResult,
} from './forecastingService.js';
