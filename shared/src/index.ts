// Shared types for Construction Scheduling Application
// These types are used by both frontend and backend

// Phase 9: Export Prisma types
export * from './types.js';

// Phase 9: Export event types
export * from './events.js';

// ============================================================================
// User & Auth Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: string;
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 
  | 'admin'
  | 'pm'           // Project Manager
  | 'superintendent'
  | 'foreman'
  | 'subcontractor'
  | 'user';

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ============================================================================
// Company & Project Types
// ============================================================================

export interface Company {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status: ProjectStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';

export interface ProjectSettings {
  id: string;
  projectId: string;
  useRetainedLogic: boolean;  // Enable P6-style retained logic CPM calculation
  progressOverride: boolean;  // Allow progress override in calculations
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Schedule Types
// ============================================================================

export interface Schedule {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: ScheduleStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type ScheduleStatus = 'draft' | 'active' | 'archived';

export interface ScheduleActivity {
  id: string;
  scheduleId: string;
  persistentInternalGuid: string;  // Immutable GUID for field data ties
  externalGuid?: string;           // P6/MPP external ID (can change)
  activityCode?: string;
  name: string;
  startDate: string;
  finishDate: string;
  duration: number;
  percentComplete: number;
  predecessorIds: string[];
  successorIds: string[];
  resourceIds: string[];
  totalFloat?: number;
  isCritical?: boolean;
  isAtRisk?: boolean;
  isDelayed?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Actual progress tracking
  actualStartDate?: string;
  actualFinishDate?: string;
  // Out-of-sequence tracking
  outOfSequenceStatus?: OutOfSequenceStatus;
  outOfSequenceReason?: string;
  outOfSequenceResolvedBy?: string;
  outOfSequenceResolvedAt?: string;
  outOfSequenceAttachmentId?: string;
}

export type OutOfSequenceStatus = 'detected' | 'acknowledged' | 'resolved';

export interface Baseline {
  id: string;
  scheduleId: string;
  version: number;
  snapshotData: Record<string, unknown>;
  createdAt: string;
}

export type RelationshipType = 'FS' | 'SS' | 'FF' | 'SF';

// ============================================================================
// Lookahead Types
// ============================================================================

export interface LookaheadSchedule {
  id: string;
  masterScheduleId: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: LookaheadStatus;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type LookaheadStatus = 'active' | 'submitted' | 'approved' | 'rejected';

export interface LookaheadActivity {
  id: string;
  lookaheadScheduleId: string;
  persistentInternalGuid: string;
  name: string;
  startDate: string;
  finishDate: string;
  duration: number;
  percentComplete: number;
  plannerStatus: PlannerStatus | null;
  plannerUpdatedBy?: string;
  plannerUpdatedAt?: string;
  hasConflict: boolean;
  conflicts?: Conflict[];
  isCommitted: boolean;
  hasPostCommitTweaks: boolean;
}

export type PlannerStatus = 'should_do' | 'will_do';

export interface Conflict {
  type: ConflictType;
  activityId: string;
  activityName: string;
  severity: ConflictSeverity;
  message: string;
}

export type ConflictType = 
  | 'zero_float_violation'
  | 'resource_conflict'
  | 'predecessor_violation';

export type ConflictSeverity = 'high' | 'medium' | 'low';

// ============================================================================
// Workflow Types
// ============================================================================

export interface WorkflowApproval {
  id: string;
  lookaheadScheduleId: string;
  submittedBy: string;
  status: ApprovalStatus;
  rejectionReason?: string;
  rejectionCategory?: string;
  approvedBy?: string;
  approvedAt?: string;
  commitSnapshot?: Record<string, unknown>;
  hasPostCommitTweaks: boolean;
  createdAt: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// ============================================================================
// Staff & Resource Types
// ============================================================================

export interface StaffMember {
  id: string;
  companyId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  role: string;
  certifications: string[];
  hourlyRate?: number;
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceAssignment {
  id: string;
  scheduleActivityId: string;
  staffMemberId: string;
  assignmentType: AssignmentType;
  hoursAllocated?: number;
  hoursActual?: number;
  assignedAt: string;
  assignedBy: string;
}

export type AssignmentType = 'manual' | 'forecasted' | 'actual';

// ============================================================================
// Notification Types
// ============================================================================

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

export type NotificationType = 
  | 'approval_request'
  | 'approval_approved'
  | 'approval_rejected'
  | 'conflict_detected'
  | 'schedule_updated'
  | 'general';

// ============================================================================
// Dashboard Types
// ============================================================================

export interface ProjectProgress {
  id: string;
  name: string;
  progress: number;
  status: 'on_track' | 'at_risk' | 'delayed';
  activitiesTotal: number;
  activitiesCompleted: number;
}

export interface DelayAlert {
  id: string;
  projectId: string;
  projectName: string;
  activityId: string;
  activityName: string;
  delayDays: number;
  isCriticalPath: boolean;
  impact: string;
}

export interface FinancialSummary {
  projectId: string;
  projectName: string;
  totalBudget: number;
  totalSpend: number;
  remainingBudget: number;
  budgetUtilization: number;
}

export interface ExecutiveDashboardData {
  projects: ProjectProgress[];
  criticalDelays: DelayAlert[];
  financial: FinancialSummary[];
  lastUpdated: string;
}

// ============================================================================
// Import/Export Types
// ============================================================================

export interface ImportDiff {
  newActivities: Partial<ScheduleActivity>[];
  updatedActivities: ActivityChange[];
  deletedActivities: string[];
  preservedFieldData: FieldDataPreservation[];
}

export interface ActivityChange {
  persistentInternalGuid: string;
  activityName: string;
  changes: FieldChange[];
  hasFieldAttachments: boolean;
  hasLookaheadEdits: boolean;
}

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface FieldDataPreservation {
  persistentInternalGuid: string;
  activityName: string;
  attachmentsCount: number;
  lookaheadEditsCount: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// Schedule Validation Types
// ============================================================================

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

export interface ValidationIssue {
  ruleType: ValidationRuleType;
  severity: ValidationRuleSeverity;
  activityId: string;
  activityName: string;
  persistentInternalGuid: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface OutOfSequenceViolation {
  activityId: string;
  activityName: string;
  persistentInternalGuid: string;
  violationType: 'actual_start_before_predecessor' | 'actual_finish_before_predecessor';
  predecessorId: string;
  predecessorName: string;
  activityActualDate: string;
  predecessorActualFinish: string | null;
  message: string;
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
  validatedAt: string;
}

export interface ValidationSummary {
  totalActivities: number;
  outOfSequenceCount: number;
  missingLogicCount: number;
  negativeFloatCount: number;
  highDurationCount: number;
  highFloatCount: number;
}

// ============================================================================
// Attachment Types
// ============================================================================

export type AttachmentStatus = 'pending' | 'approved' | 'rejected';
export type AttachmentSourceType = 'master' | 'lookahead';

export interface ActivityAttachment {
  id: string;
  persistentInternalGuid: string;
  attachmentType: string;
  filePath?: string;
  fileName?: string;
  uploadedBy: string;
  uploadedAt: string;
  metadata?: Record<string, unknown>;
  // Approval gating fields
  status: AttachmentStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  sourceType: AttachmentSourceType;
  lookaheadApprovalId?: string;
}
