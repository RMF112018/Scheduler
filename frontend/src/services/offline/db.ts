/**
 * Offline Database Schema
 *
 * Dexie.js IndexedDB wrapper for offline lookahead caching.
 * This provides persistent local storage for:
 * - Lookahead schedules and activities
 * - Pending sync operations (queue)
 * - Sync metadata and conflict tracking
 */

import Dexie, { Table } from 'dexie';

// ============================================================================
// Types
// ============================================================================

export interface OfflineLookahead {
  id: string;
  masterScheduleId: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'submitted' | 'approved' | 'rejected';
  hasUncommittedChanges: boolean;
  hasPostCommitTweaks: boolean;
  lastSyncedAt: string;
  lastModifiedAt: string;
  createdAt: string;
  updatedAt: string;
  // Offline-specific fields
  isOfflineModified: boolean;
  offlineModifiedAt?: string;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
  serverVersion?: number;
  localVersion: number;
}

export interface OfflineLookaheadActivity {
  id: string;
  lookaheadScheduleId: string;
  persistentInternalGuid: string;
  name: string;
  startDate: string;
  finishDate: string;
  duration: number;
  percentComplete: number;
  plannerStatus: 'should_do' | 'will_do' | null;
  plannerUpdatedBy?: string;
  plannerUpdatedAt?: string;
  hasConflict: boolean;
  isCommitted: boolean;
  hasPostCommitTweaks: boolean;
  // Offline-specific fields
  isOfflineModified: boolean;
  offlineModifiedAt?: string;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
  localVersion: number;
  // Store original values for conflict resolution
  originalValues?: {
    plannerStatus: 'should_do' | 'will_do' | null;
    percentComplete: number;
    startDate: string;
    finishDate: string;
  };
}

export type SyncOperationType =
  | 'mark_status'
  | 'update_activity'
  | 'commit_changes'
  | 'add_attachment';

export interface SyncOperation {
  id?: number; // Auto-incremented
  operationType: SyncOperationType;
  entityType: 'lookahead' | 'activity' | 'attachment';
  entityId: string;
  parentId?: string; // e.g., lookaheadId for activity operations
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  priority: number; // Lower = higher priority
}

export interface SyncConflict {
  id?: number;
  entityType: 'lookahead' | 'activity' | 'attachment';
  entityId: string;
  localValue: Record<string, unknown>;
  serverValue: Record<string, unknown>;
  conflictType: 'update' | 'delete' | 'version_mismatch';
  detectedAt: string;
  resolvedAt?: string;
  resolution?: 'local' | 'server' | 'merged';
  resolvedValue?: Record<string, unknown>;
}

export interface SyncMetadata {
  key: string;
  value: string | number | boolean | null;
  updatedAt: string;
}

// ============================================================================
// Database Class
// ============================================================================

export class OfflineDatabase extends Dexie {
  lookaheads!: Table<OfflineLookahead, string>;
  activities!: Table<OfflineLookaheadActivity, string>;
  syncQueue!: Table<SyncOperation, number>;
  conflicts!: Table<SyncConflict, number>;
  metadata!: Table<SyncMetadata, string>;

  constructor() {
    super('SchedulerOfflineDB');

    // Define schema with indexes
    this.version(1).stores({
      lookaheads: 'id, projectId, masterScheduleId, syncStatus, lastSyncedAt',
      activities:
        'id, lookaheadScheduleId, persistentInternalGuid, syncStatus, isOfflineModified',
      syncQueue: '++id, operationType, entityType, entityId, status, priority, createdAt',
      conflicts: '++id, entityType, entityId, conflictType, detectedAt',
      metadata: 'key',
    });

    // Version 2: Add isOfflineModified index to lookaheads table
    this.version(2).stores({
      lookaheads: 'id, projectId, masterScheduleId, syncStatus, lastSyncedAt, isOfflineModified',
    });
  }
}

// Singleton instance
export const offlineDb = new OfflineDatabase();

// ============================================================================
// Database Utilities
// ============================================================================

/**
 * Clear all offline data (useful for logout or reset)
 */
export async function clearOfflineData(): Promise<void> {
  await offlineDb.transaction(
    'rw',
    [
      offlineDb.lookaheads,
      offlineDb.activities,
      offlineDb.syncQueue,
      offlineDb.conflicts,
      offlineDb.metadata,
    ],
    async () => {
      await offlineDb.lookaheads.clear();
      await offlineDb.activities.clear();
      await offlineDb.syncQueue.clear();
      await offlineDb.conflicts.clear();
      await offlineDb.metadata.clear();
    }
  );
}

/**
 * Get sync metadata value
 */
export async function getSyncMetadata(key: string): Promise<string | number | boolean | null> {
  const record = await offlineDb.metadata.get(key);
  return record?.value ?? null;
}

/**
 * Set sync metadata value
 */
export async function setSyncMetadata(
  key: string,
  value: string | number | boolean | null
): Promise<void> {
  await offlineDb.metadata.put({
    key,
    value,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Get the count of pending sync operations
 */
export async function getPendingSyncCount(): Promise<number> {
  return offlineDb.syncQueue.where('status').equals('pending').count();
}

/**
 * Get the count of unresolved conflicts
 */
export async function getUnresolvedConflictCount(): Promise<number> {
  return offlineDb.conflicts.filter((c) => !c.resolvedAt).count();
}

/**
 * Check if the database has any offline modifications
 */
export async function hasOfflineModifications(): Promise<boolean> {
  const pendingCount = await getPendingSyncCount();
  const modifiedLookaheads = await offlineDb.lookaheads
    .where('isOfflineModified')
    .equals(1)
    .count();
  const modifiedActivities = await offlineDb.activities
    .where('isOfflineModified')
    .equals(1)
    .count();

  return pendingCount > 0 || modifiedLookaheads > 0 || modifiedActivities > 0;
}

export default offlineDb;
