/**
 * Shared Types for Construction Scheduling Application
 * 
 * Phase 9: Extracted Prisma model types for use across frontend and backend.
 * These types are generated from the Prisma schema and provide type safety
 * across the entire application.
 */

// Re-export Prisma types for convenience
export type {
  // User & Auth
  User,
  Permission,
  UserPermission,
  Role,
  RolePermission,
  
  // Company & Project
  Company,
  Project,
  ProjectSettings,
  ProjectMember,
  
  // Schedule
  Schedule,
  ScheduleActivity,
  ScheduleBaseline,
  
  // Lookahead
  LookaheadSchedule,
  LookaheadActivity,
  LookaheadVersion,
  
  // Workflow
  WorkflowApproval,
  WorkflowHistory,
  
  // Import Mapping
  ImportMapping,
  
  // Staff & Resources
  StaffRole,
  StaffMember,
  ResourceAssignment,
  StaffAssignment,
  StaffAssignmentMonthlyAllocation,
  ProjectRoleRate,
  
  // Attachments
  ActivityAttachment,
  
  // Notifications
  Notification,
  
  // Comments
  LookaheadActivityComment,
  LookaheadCommentReaction,
  
  // Audit Log
  AuditLog,
} from '@prisma/client';

// Additional shared interfaces for Phase 9
export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  userId: string;
  companyId: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
