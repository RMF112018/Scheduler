// Service exports
// Phase 9: Core scheduling services moved to modules/core/
export { scheduleService, ScheduleService } from '../modules/core/services/scheduleService.js';
export { activityService, ActivityService } from '../modules/core/services/activityService.js';
export { lookaheadService, LookaheadService } from '../modules/core/services/lookaheadService.js';
export { importMappingService, ImportMappingService } from '../modules/core/services/importMappingService.js';
export { scheduleValidationService, ScheduleValidationService } from '../modules/core/services/scheduleValidationService.js';
export { staffService, StaffService } from './staffService.js';
export { forecastingService, ForecastingService } from './forecastingService.js';
export { exportService, ExportService } from './exportService.js';
export { xlsxImportService, XLSXImportService } from './xlsxImportService.js';
export { dashboardService, DashboardService } from './dashboardService.js';
export {
  initializeSocketIO,
  notifyProjectUpdate,
  notifyScheduleUpdate,
  notifyActivityUpdate,
  notifyLookaheadUpdate,
  notifyApprovalStatus,
  notifyCompany,
  notifyUser,
  sendNotificationAlert,
  updateUnreadCount,
  isUserOnline,
  getOnlineUsers,
  getIO,
  isSocketInitialized,
} from './socketService.js';

export { notificationService, NotificationService } from './notificationService.js';
export { commentService } from './commentService.js';
export { p6LogicVerificationService, P6LogicVerificationService } from './p6LogicVerificationService.js';

// Types
export type {
  CreateScheduleDto,
  UpdateScheduleDto,
  BaselineVariance,
  BaselineComparison,
  ScheduleWithDetails,
} from '../modules/core/services/scheduleService.js';

export type {
  CreateActivityDto,
  UpdateActivityDto,
  ActivityNode,
  CriticalPathResult,
  CriticalPathOptions,
} from '../modules/core/services/activityService.js';

export type {
  CreateLookaheadDto,
  UpdateLookaheadActivityDto,
  Conflict,
  MergeResult,
  CommitResult,
  LookaheadWithActivities,
} from '../modules/core/services/lookaheadService.js';

export type {
  ExternalActivity,
  ExternalRelationship,
  ImportDiff,
  ImportDiffActivity,
  ImportChange,
  DiffApproval,
  ImportResult,
  FieldTiesResult,
} from '../modules/core/services/importMappingService.js';

export type {
  OutOfSequenceStatus,
  ValidationRuleSeverity,
  ValidationRuleType,
  OutOfSequenceViolation,
  ValidationIssue,
  ValidationResult,
  ResolveOutOfSequenceDto,
  DCMA14Config,
} from '../modules/core/services/scheduleValidationService.js';

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

export type {
  ExportOptions,
  PDFExportOptions,
  ScheduleExportData,
  VarianceData,
} from './exportService.js';

export type {
  ColumnMapping,
  XLSXImportOptions,
  XLSXPreviewResult,
  XLSXImportResult,
  ValidationError,
} from './xlsxImportService.js';

export type {
  ProjectHealthMetric,
  CriticalDelay,
  FinancialSummary,
  ResourceUtilization,
  ExecutiveDashboard,
  ProjectDrillDown,
} from './dashboardService.js';

export type {
  NotificationType,
  NotificationPayload,
  NotificationRecipient,
  UserNotificationPreferences,
} from './notificationService.js';

export type {
  Comment,
  CommentReaction,
  CreateCommentInput,
  UpdateCommentInput,
} from './commentService.js';
