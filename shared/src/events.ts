/**
 * Event Type Definitions
 *
 * Phase 9: Event types for the async event bus (BullMQ).
 * All events are processed asynchronously with retry and durability.
 */

// ============================================================================
// Event Types
// ============================================================================

export type EventType = 
  | 'activity.created'
  | 'activity.updated'
  | 'activity.deleted'
  | 'schedule.created'
  | 'schedule.updated'
  | 'schedule.deleted'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'lookahead.committed'
  | 'lookahead.approved'
  | 'lookahead.rejected'
  | 'approval.completed'
  | 'approval.rejected'
  | 'resource.assigned'
  | 'resource.unassigned'
  | 'staff.created'
  | 'staff.updated'
  | 'staff.deleted'
  | 'attachment.uploaded'
  | 'attachment.approved'
  | 'attachment.rejected'
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'role.assigned'
  | 'role.removed'
  | 'permission.granted'
  | 'permission.revoked';

// ============================================================================
// Base Event Interface
// ============================================================================

export interface BaseEvent {
  type: EventType;
  entityId: string;
  entityType: string;
  userId: string;
  companyId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Specific Event Interfaces
// ============================================================================

export interface ActivityUpdatedEvent extends BaseEvent {
  type: 'activity.updated';
  changes: Record<string, { old: unknown; new: unknown }>;
  scheduleId: string;
}

export interface ActivityCreatedEvent extends BaseEvent {
  type: 'activity.created';
  scheduleId: string;
  activityName: string;
}

export interface ActivityDeletedEvent extends BaseEvent {
  type: 'activity.deleted';
  scheduleId: string;
  activityName: string;
}

export interface ScheduleUpdatedEvent extends BaseEvent {
  type: 'schedule.updated';
  changes: Record<string, { old: unknown; new: unknown }>;
  projectId: string;
}

export interface ScheduleCreatedEvent extends BaseEvent {
  type: 'schedule.created';
  projectId: string;
  scheduleName: string;
}

export interface ProjectUpdatedEvent extends BaseEvent {
  type: 'project.updated';
  changes: Record<string, { old: unknown; new: unknown }>;
}

export interface LookaheadCommittedEvent extends BaseEvent {
  type: 'lookahead.committed';
  lookaheadId: string;
  lookaheadName: string;
  activitiesCount: number;
}

export interface ApprovalCompletedEvent extends BaseEvent {
  type: 'approval.completed';
  lookaheadId: string;
  approvedBy: string;
  activitiesCount: number;
}

export interface ApprovalRejectedEvent extends BaseEvent {
  type: 'approval.rejected';
  lookaheadId: string;
  rejectedBy: string;
  rejectionReason?: string;
}

export interface ResourceAssignedEvent extends BaseEvent {
  type: 'resource.assigned';
  activityId: string;
  staffMemberId: string;
  hoursAllocated?: number;
}

export interface ResourceUnassignedEvent extends BaseEvent {
  type: 'resource.unassigned';
  activityId: string;
  staffMemberId: string;
}

// Phase 11: User Management Events
export interface UserCreatedEvent extends BaseEvent {
  type: 'user.created';
  userEmail: string;
  userName: string;
  defaultRoleId?: string;
}

export interface UserUpdatedEvent extends BaseEvent {
  type: 'user.updated';
  changes: Record<string, { old: unknown; new: unknown }>;
}

export interface UserDeletedEvent extends BaseEvent {
  type: 'user.deleted';
  userEmail: string;
  userName: string;
}

export interface RoleAssignedEvent extends BaseEvent {
  type: 'role.assigned';
  roleId: string;
  roleName: string;
  projectId?: string | null;
}

export interface RoleRemovedEvent extends BaseEvent {
  type: 'role.removed';
  roleId: string;
  roleName: string;
  projectId?: string | null;
}

export interface PermissionGrantedEvent extends BaseEvent {
  type: 'permission.granted';
  permission: string;
  projectId: string;
  granted: boolean;
}

export interface PermissionRevokedEvent extends BaseEvent {
  type: 'permission.revoked';
  permission: string;
  projectId: string;
}

// ============================================================================
// Union Type for All Events
// ============================================================================

export type Event = 
  | ActivityCreatedEvent
  | ActivityUpdatedEvent
  | ActivityDeletedEvent
  | ScheduleCreatedEvent
  | ScheduleUpdatedEvent
  | ProjectUpdatedEvent
  | LookaheadCommittedEvent
  | ApprovalCompletedEvent
  | ApprovalRejectedEvent
  | ResourceAssignedEvent
  | ResourceUnassignedEvent
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | RoleAssignedEvent
  | RoleRemovedEvent
  | PermissionGrantedEvent
  | PermissionRevokedEvent
  | BaseEvent; // Fallback for other event types
