/**
 * Offline Services Index
 *
 * Exports all offline-related functionality for clean imports
 */

// Database
export {
  offlineDb,
  clearOfflineData,
  getSyncMetadata,
  setSyncMetadata,
  getPendingSyncCount,
  getUnresolvedConflictCount,
  hasOfflineModifications,
  type OfflineLookahead,
  type OfflineLookaheadActivity,
  type SyncOperation,
  type SyncConflict,
  type SyncMetadata,
  type SyncOperationType,
} from './db';

// Sync Service
export {
  offlineSyncService,
  type SyncResult,
  type OfflineStatus,
} from './syncService';
