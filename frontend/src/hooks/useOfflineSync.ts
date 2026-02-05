/**
 * useOfflineSync Hook
 *
 * React hook for managing offline sync state and operations.
 * Provides:
 * - Current online/offline status
 * - Pending sync count
 * - Conflict count
 * - Sync operations
 * - Real-time status updates
 */

import { useState, useEffect, useCallback } from 'react';
import {
  offlineSyncService,
  type OfflineStatus,
  type SyncResult,
  type SyncConflict,
} from '@services/offline';

export interface UseOfflineSyncReturn {
  // Status
  status: OfflineStatus;
  isOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  unresolvedConflicts: number;
  lastSyncAt: string | null;

  // Actions
  syncNow: () => Promise<SyncResult>;
  refreshStatus: () => Promise<void>;

  // Conflict resolution
  conflicts: SyncConflict[];
  resolveConflictKeepLocal: (conflictId: number) => Promise<void>;
  resolveConflictKeepServer: (conflictId: number) => Promise<void>;
  resolveConflictMerge: (conflictId: number, mergedValue: Record<string, unknown>) => Promise<void>;
}

const initialStatus: OfflineStatus = {
  isOnline: navigator.onLine,
  pendingSyncCount: 0,
  unresolvedConflicts: 0,
  lastSyncAt: null,
  isSyncing: false,
};

export function useOfflineSync(): UseOfflineSyncReturn {
  const [status, setStatus] = useState<OfflineStatus>(initialStatus);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

  // Refresh status from service
  const refreshStatus = useCallback(async () => {
    const newStatus = await offlineSyncService.getStatus();
    setStatus(newStatus);

    const unresolvedConflicts = await offlineSyncService.getUnresolvedConflicts();
    setConflicts(unresolvedConflicts);
  }, []);

  // Sync now
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    const result = await offlineSyncService.syncPendingOperations();
    await refreshStatus();
    return result;
  }, [refreshStatus]);

  // Conflict resolution
  const resolveConflictKeepLocal = useCallback(
    async (conflictId: number) => {
      await offlineSyncService.resolveConflictKeepLocal(conflictId);
      await refreshStatus();
    },
    [refreshStatus]
  );

  const resolveConflictKeepServer = useCallback(
    async (conflictId: number) => {
      await offlineSyncService.resolveConflictKeepServer(conflictId);
      await refreshStatus();
    },
    [refreshStatus]
  );

  const resolveConflictMerge = useCallback(
    async (conflictId: number, mergedValue: Record<string, unknown>) => {
      await offlineSyncService.resolveConflictMerge(conflictId, mergedValue);
      await refreshStatus();
    },
    [refreshStatus]
  );

  // Subscribe to sync events
  useEffect(() => {
    // Initial status fetch
    refreshStatus();

    // Subscribe to events
    const unsubscribe = offlineSyncService.subscribe((event) => {
      switch (event.type) {
        case 'online':
        case 'offline':
        case 'sync_started':
        case 'sync_completed':
        case 'sync_failed':
          refreshStatus();
          break;
        case 'conflict_detected':
          refreshStatus();
          break;
      }
    });

    // Start background sync
    offlineSyncService.startBackgroundSync(30000);

    return () => {
      unsubscribe();
    };
  }, [refreshStatus]);

  return {
    status,
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    pendingSyncCount: status.pendingSyncCount,
    unresolvedConflicts: status.unresolvedConflicts,
    lastSyncAt: status.lastSyncAt,
    syncNow,
    refreshStatus,
    conflicts,
    resolveConflictKeepLocal,
    resolveConflictKeepServer,
    resolveConflictMerge,
  };
}

export default useOfflineSync;
