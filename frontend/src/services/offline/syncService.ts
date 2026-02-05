/**
 * Offline Sync Service
 *
 * Manages synchronization between local IndexedDB and the server.
 * Handles:
 * - Caching lookahead data for offline access
 * - Queuing offline changes for later sync
 * - Detecting and resolving conflicts
 * - Background sync when connection is restored
 */

import {
  offlineDb,
  OfflineLookahead,
  OfflineLookaheadActivity,
  SyncOperation,
  SyncConflict,
  setSyncMetadata,
  getSyncMetadata,
} from './db';
import { lookaheadApi } from '../api/lookaheadApi';
import type { LookaheadSchedule, LookaheadActivity } from '@store/slices/lookaheadSlice';

// ============================================================================
// Types
// ============================================================================

export interface SyncResult {
  success: boolean;
  syncedOperations: number;
  failedOperations: number;
  conflicts: SyncConflict[];
  errors: string[];
}

export interface OfflineStatus {
  isOnline: boolean;
  pendingSyncCount: number;
  unresolvedConflicts: number;
  lastSyncAt: string | null;
  isSyncing: boolean;
}

type SyncEventType = 'sync_started' | 'sync_completed' | 'sync_failed' | 'conflict_detected' | 'online' | 'offline';

type SyncEventListener = (event: { type: SyncEventType; data?: unknown }) => void;

// ============================================================================
// Sync Service Class
// ============================================================================

class OfflineSyncService {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<SyncEventListener> = new Set();

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  private handleOnline = (): void => {
    this.isOnline = true;
    this.emit('online');
    // Trigger sync when coming back online
    this.syncPendingOperations();
  };

  private handleOffline = (): void => {
    this.isOnline = false;
    this.emit('offline');
  };

  /**
   * Subscribe to sync events
   */
  subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(type: SyncEventType, data?: unknown): void {
    this.listeners.forEach((listener) => listener({ type, data }));
  }

  // ==========================================================================
  // Status Methods
  // ==========================================================================

  /**
   * Get current offline status
   */
  async getStatus(): Promise<OfflineStatus> {
    const pendingSyncCount = await offlineDb.syncQueue
      .where('status')
      .equals('pending')
      .count();
    const unresolvedConflicts = await offlineDb.conflicts
      .filter((c) => !c.resolvedAt)
      .count();
    const lastSyncAt = (await getSyncMetadata('lastSyncAt')) as string | null;

    return {
      isOnline: this.isOnline,
      pendingSyncCount,
      unresolvedConflicts,
      lastSyncAt,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Check if we're currently online
   */
  getIsOnline(): boolean {
    return this.isOnline;
  }

  // ==========================================================================
  // Caching Methods
  // ==========================================================================

  /**
   * Cache a lookahead schedule for offline access
   */
  async cacheLookahead(lookahead: LookaheadSchedule): Promise<void> {
    const now = new Date().toISOString();

    // Convert to offline format
    const offlineLookahead: OfflineLookahead = {
      id: lookahead.id,
      masterScheduleId: lookahead.masterScheduleId,
      projectId: lookahead.projectId,
      name: lookahead.name,
      startDate: lookahead.startDate,
      endDate: lookahead.endDate,
      status: lookahead.status,
      hasUncommittedChanges: lookahead.hasUncommittedChanges,
      hasPostCommitTweaks: lookahead.hasPostCommitTweaks,
      lastSyncedAt: now,
      lastModifiedAt: lookahead.updatedAt,
      createdAt: lookahead.createdAt,
      updatedAt: lookahead.updatedAt,
      isOfflineModified: false,
      syncStatus: 'synced',
      localVersion: 1,
    };

    // Convert activities
    const offlineActivities: OfflineLookaheadActivity[] = lookahead.activities.map(
      (activity) => ({
        id: activity.id,
        lookaheadScheduleId: activity.lookaheadScheduleId,
        persistentInternalGuid: activity.persistentInternalGuid,
        name: activity.name,
        startDate: activity.startDate,
        finishDate: activity.finishDate,
        duration: activity.duration,
        percentComplete: activity.percentComplete,
        plannerStatus: activity.plannerStatus,
        plannerUpdatedBy: activity.plannerUpdatedBy,
        plannerUpdatedAt: activity.plannerUpdatedAt,
        hasConflict: activity.hasConflict,
        isCommitted: activity.isCommitted,
        hasPostCommitTweaks: activity.hasPostCommitTweaks,
        isOfflineModified: false,
        syncStatus: 'synced',
        localVersion: 1,
      })
    );

    // Store in transaction
    await offlineDb.transaction(
      'rw',
      [offlineDb.lookaheads, offlineDb.activities],
      async () => {
        await offlineDb.lookaheads.put(offlineLookahead);

        // Clear existing activities for this lookahead and add new ones
        await offlineDb.activities
          .where('lookaheadScheduleId')
          .equals(lookahead.id)
          .delete();
        await offlineDb.activities.bulkPut(offlineActivities);
      }
    );

    await setSyncMetadata('lastSyncAt', now);
  }

  /**
   * Get cached lookahead from offline storage
   */
  async getCachedLookahead(lookaheadId: string): Promise<LookaheadSchedule | null> {
    const lookahead = await offlineDb.lookaheads.get(lookaheadId);
    if (!lookahead) return null;

    const activities = await offlineDb.activities
      .where('lookaheadScheduleId')
      .equals(lookaheadId)
      .toArray();

    // Convert back to LookaheadSchedule format
    return {
      id: lookahead.id,
      masterScheduleId: lookahead.masterScheduleId,
      projectId: lookahead.projectId,
      name: lookahead.name,
      startDate: lookahead.startDate,
      endDate: lookahead.endDate,
      status: lookahead.status,
      activities: activities.map((a) => ({
        id: a.id,
        lookaheadScheduleId: a.lookaheadScheduleId,
        persistentInternalGuid: a.persistentInternalGuid,
        name: a.name,
        startDate: a.startDate,
        finishDate: a.finishDate,
        duration: a.duration,
        percentComplete: a.percentComplete,
        plannerStatus: a.plannerStatus,
        plannerUpdatedBy: a.plannerUpdatedBy,
        plannerUpdatedAt: a.plannerUpdatedAt,
        hasConflict: a.hasConflict,
        isCommitted: a.isCommitted,
        hasPostCommitTweaks: a.hasPostCommitTweaks,
      })),
      conflicts: [],
      hasUncommittedChanges: lookahead.hasUncommittedChanges,
      hasPostCommitTweaks: lookahead.hasPostCommitTweaks,
      lastSyncedAt: lookahead.lastSyncedAt,
      createdAt: lookahead.createdAt,
      updatedAt: lookahead.updatedAt,
    };
  }

  /**
   * Get all cached lookaheads for a project
   */
  async getCachedLookaheads(projectId: string): Promise<LookaheadSchedule[]> {
    const lookaheads = await offlineDb.lookaheads
      .where('projectId')
      .equals(projectId)
      .toArray();

    const results: LookaheadSchedule[] = [];
    for (const lookahead of lookaheads) {
      const full = await this.getCachedLookahead(lookahead.id);
      if (full) results.push(full);
    }

    return results;
  }

  // ==========================================================================
  // Offline Operation Methods
  // ==========================================================================

  /**
   * Queue a mark status operation for offline sync
   */
  async queueMarkStatus(
    lookaheadId: string,
    activityId: string,
    status: 'should_do' | 'will_do'
  ): Promise<void> {
    const now = new Date().toISOString();

    // Update local activity
    const activity = await offlineDb.activities.get(activityId);
    if (activity) {
      // Store original values if this is the first offline modification
      const originalValues = activity.originalValues || {
        plannerStatus: activity.plannerStatus,
        percentComplete: activity.percentComplete,
        startDate: activity.startDate,
        finishDate: activity.finishDate,
      };

      await offlineDb.activities.update(activityId, {
        plannerStatus: status,
        plannerUpdatedAt: now,
        isOfflineModified: true,
        offlineModifiedAt: now,
        syncStatus: 'pending',
        localVersion: activity.localVersion + 1,
        originalValues,
      });
    }

    // Update lookahead
    const lookahead = await offlineDb.lookaheads.get(lookaheadId);
    if (lookahead) {
      await offlineDb.lookaheads.update(lookaheadId, {
        hasUncommittedChanges: true,
        isOfflineModified: true,
        offlineModifiedAt: now,
        syncStatus: 'pending',
        localVersion: lookahead.localVersion + 1,
      });
    }

    // Add to sync queue
    const operation: SyncOperation = {
      operationType: 'mark_status',
      entityType: 'activity',
      entityId: activityId,
      parentId: lookaheadId,
      payload: { status },
      createdAt: now,
      attempts: 0,
      status: 'pending',
      priority: 1,
    };

    await offlineDb.syncQueue.add(operation);

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncPendingOperations();
    }
  }

  /**
   * Queue an activity update operation
   */
  async queueActivityUpdate(
    lookaheadId: string,
    activityId: string,
    updates: Partial<LookaheadActivity>
  ): Promise<void> {
    const now = new Date().toISOString();

    // Update local activity
    const activity = await offlineDb.activities.get(activityId);
    if (activity) {
      const originalValues = activity.originalValues || {
        plannerStatus: activity.plannerStatus,
        percentComplete: activity.percentComplete,
        startDate: activity.startDate,
        finishDate: activity.finishDate,
      };

      await offlineDb.activities.update(activityId, {
        ...updates,
        isOfflineModified: true,
        offlineModifiedAt: now,
        syncStatus: 'pending',
        localVersion: activity.localVersion + 1,
        originalValues,
      });
    }

    // Add to sync queue
    const operation: SyncOperation = {
      operationType: 'update_activity',
      entityType: 'activity',
      entityId: activityId,
      parentId: lookaheadId,
      payload: updates,
      createdAt: now,
      attempts: 0,
      status: 'pending',
      priority: 2,
    };

    await offlineDb.syncQueue.add(operation);

    if (this.isOnline) {
      this.syncPendingOperations();
    }
  }

  /**
   * Queue a commit changes operation
   */
  async queueCommitChanges(lookaheadId: string): Promise<void> {
    const now = new Date().toISOString();

    const operation: SyncOperation = {
      operationType: 'commit_changes',
      entityType: 'lookahead',
      entityId: lookaheadId,
      payload: {},
      createdAt: now,
      attempts: 0,
      status: 'pending',
      priority: 0, // Highest priority
    };

    await offlineDb.syncQueue.add(operation);

    if (this.isOnline) {
      this.syncPendingOperations();
    }
  }

  // ==========================================================================
  // Sync Methods
  // ==========================================================================

  /**
   * Sync all pending operations
   */
  async syncPendingOperations(): Promise<SyncResult> {
    if (this.isSyncing || !this.isOnline) {
      return {
        success: false,
        syncedOperations: 0,
        failedOperations: 0,
        conflicts: [],
        errors: [this.isSyncing ? 'Sync already in progress' : 'Offline'],
      };
    }

    this.isSyncing = true;
    this.emit('sync_started');

    const result: SyncResult = {
      success: true,
      syncedOperations: 0,
      failedOperations: 0,
      conflicts: [],
      errors: [],
    };

    try {
      // Get pending operations sorted by priority and creation time
      const pendingOps = await offlineDb.syncQueue
        .where('status')
        .equals('pending')
        .sortBy('priority');

      for (const operation of pendingOps) {
        try {
          await this.processSyncOperation(operation);
          result.syncedOperations++;
        } catch (error) {
          result.failedOperations++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`${operation.operationType}: ${errorMessage}`);

          // Check if it's a conflict
          if (errorMessage.includes('conflict') || errorMessage.includes('version')) {
            const conflict = await this.createConflict(operation, errorMessage);
            result.conflicts.push(conflict);
            this.emit('conflict_detected', conflict);
          }
        }
      }

      // Update last sync time
      await setSyncMetadata('lastSyncAt', new Date().toISOString());

      this.emit('sync_completed', result);
    } catch (error) {
      result.success = false;
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      result.errors.push(errorMessage);
      this.emit('sync_failed', { error: errorMessage });
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Process a single sync operation
   */
  private async processSyncOperation(operation: SyncOperation): Promise<void> {
    // Mark as processing
    await offlineDb.syncQueue.update(operation.id!, {
      status: 'processing',
      lastAttemptAt: new Date().toISOString(),
      attempts: operation.attempts + 1,
    });

    try {
      switch (operation.operationType) {
        case 'mark_status':
          await lookaheadApi.markTaskStatus(
            operation.parentId!,
            operation.entityId,
            operation.payload.status as 'should_do' | 'will_do'
          );
          break;

        case 'update_activity':
          await lookaheadApi.updateActivity(
            operation.parentId!,
            operation.entityId,
            operation.payload as Partial<LookaheadActivity>
          );
          break;

        case 'commit_changes':
          await lookaheadApi.commitChanges(operation.entityId);
          break;

        default:
          throw new Error(`Unknown operation type: ${operation.operationType}`);
      }

      // Mark as completed and update local state
      await offlineDb.syncQueue.update(operation.id!, { status: 'completed' });

      // Update local entity sync status
      if (operation.entityType === 'activity') {
        await offlineDb.activities.update(operation.entityId, {
          syncStatus: 'synced',
          isOfflineModified: false,
        });
      } else if (operation.entityType === 'lookahead') {
        await offlineDb.lookaheads.update(operation.entityId, {
          syncStatus: 'synced',
          isOfflineModified: false,
        });
      }
    } catch (error) {
      // Mark as failed if max attempts reached
      const maxAttempts = 3;
      const newStatus = operation.attempts + 1 >= maxAttempts ? 'failed' : 'pending';

      await offlineDb.syncQueue.update(operation.id!, {
        status: newStatus,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Create a conflict record
   */
  private async createConflict(
    operation: SyncOperation,
    errorMessage: string
  ): Promise<SyncConflict> {
    let localValue: Record<string, unknown> = {};
    let serverValue: Record<string, unknown> = {};

    // Get local value
    if (operation.entityType === 'activity') {
      const activity = await offlineDb.activities.get(operation.entityId);
      if (activity) {
        localValue = {
          plannerStatus: activity.plannerStatus,
          percentComplete: activity.percentComplete,
          startDate: activity.startDate,
          finishDate: activity.finishDate,
        };
      }

      // Try to get server value
      try {
        const serverLookahead = await lookaheadApi.getLookahead(operation.parentId!);
        const serverActivity = serverLookahead.activities.find(
          (a) => a.id === operation.entityId
        );
        if (serverActivity) {
          serverValue = {
            plannerStatus: serverActivity.plannerStatus,
            percentComplete: serverActivity.percentComplete,
            startDate: serverActivity.startDate,
            finishDate: serverActivity.finishDate,
          };
        }
      } catch {
        // Server fetch failed, leave serverValue empty
      }
    }

    const conflict: SyncConflict = {
      entityType: operation.entityType,
      entityId: operation.entityId,
      localValue,
      serverValue,
      conflictType: errorMessage.includes('version') ? 'version_mismatch' : 'update',
      detectedAt: new Date().toISOString(),
    };

    const id = await offlineDb.conflicts.add(conflict);
    conflict.id = id;

    // Update entity sync status
    if (operation.entityType === 'activity') {
      await offlineDb.activities.update(operation.entityId, {
        syncStatus: 'conflict',
      });
    }

    return conflict;
  }

  // ==========================================================================
  // Conflict Resolution Methods
  // ==========================================================================

  /**
   * Get all unresolved conflicts
   */
  async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    return offlineDb.conflicts.filter((c) => !c.resolvedAt).toArray();
  }

  /**
   * Resolve a conflict by keeping local changes
   */
  async resolveConflictKeepLocal(conflictId: number): Promise<void> {
    const conflict = await offlineDb.conflicts.get(conflictId);
    if (!conflict) throw new Error('Conflict not found');

    // Re-queue the sync operation
    const operation: SyncOperation = {
      operationType: 'update_activity',
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      payload: conflict.localValue,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending',
      priority: 0,
    };

    await offlineDb.syncQueue.add(operation);

    // Mark conflict as resolved
    await offlineDb.conflicts.update(conflictId, {
      resolvedAt: new Date().toISOString(),
      resolution: 'local',
      resolvedValue: conflict.localValue,
    });

    // Update entity status
    if (conflict.entityType === 'activity') {
      await offlineDb.activities.update(conflict.entityId, {
        syncStatus: 'pending',
      });
    }

    // Trigger sync
    if (this.isOnline) {
      this.syncPendingOperations();
    }
  }

  /**
   * Resolve a conflict by accepting server changes
   */
  async resolveConflictKeepServer(conflictId: number): Promise<void> {
    const conflict = await offlineDb.conflicts.get(conflictId);
    if (!conflict) throw new Error('Conflict not found');

    // Update local data with server values
    if (conflict.entityType === 'activity') {
      await offlineDb.activities.update(conflict.entityId, {
        ...conflict.serverValue,
        syncStatus: 'synced',
        isOfflineModified: false,
      });
    }

    // Mark conflict as resolved
    await offlineDb.conflicts.update(conflictId, {
      resolvedAt: new Date().toISOString(),
      resolution: 'server',
      resolvedValue: conflict.serverValue,
    });

    // Remove pending operations for this entity
    await offlineDb.syncQueue
      .where('entityId')
      .equals(conflict.entityId)
      .delete();
  }

  /**
   * Resolve a conflict with merged values
   */
  async resolveConflictMerge(
    conflictId: number,
    mergedValue: Record<string, unknown>
  ): Promise<void> {
    const conflict = await offlineDb.conflicts.get(conflictId);
    if (!conflict) throw new Error('Conflict not found');

    // Update local data with merged values
    if (conflict.entityType === 'activity') {
      await offlineDb.activities.update(conflict.entityId, {
        ...mergedValue,
        syncStatus: 'pending',
        isOfflineModified: true,
      });
    }

    // Queue sync operation with merged values
    const operation: SyncOperation = {
      operationType: 'update_activity',
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      payload: mergedValue,
      createdAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending',
      priority: 0,
    };

    await offlineDb.syncQueue.add(operation);

    // Mark conflict as resolved
    await offlineDb.conflicts.update(conflictId, {
      resolvedAt: new Date().toISOString(),
      resolution: 'merged',
      resolvedValue: mergedValue,
    });

    // Trigger sync
    if (this.isOnline) {
      this.syncPendingOperations();
    }
  }

  // ==========================================================================
  // Background Sync Methods
  // ==========================================================================

  /**
   * Start background sync interval
   */
  startBackgroundSync(intervalMs: number = 30000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncPendingOperations();
      }
    }, intervalMs);
  }

  /**
   * Stop background sync
   */
  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Cleanup - call when service is no longer needed
   */
  destroy(): void {
    this.stopBackgroundSync();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.listeners.clear();
  }
}

// Singleton instance
export const offlineSyncService = new OfflineSyncService();

export default offlineSyncService;
