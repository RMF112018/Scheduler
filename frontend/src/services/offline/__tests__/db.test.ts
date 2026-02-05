/**
 * Offline Database Tests
 *
 * Tests for the Dexie.js IndexedDB wrapper
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
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
} from '../db';

describe('Offline Database', () => {
  beforeEach(async () => {
    await clearOfflineData();
  });

  afterEach(async () => {
    await clearOfflineData();
  });

  describe('Lookahead Storage', () => {
    const testLookahead: OfflineLookahead = {
      id: 'test-lookahead-1',
      masterScheduleId: 'master-1',
      projectId: 'project-1',
      name: 'Test Lookahead',
      startDate: '2026-02-01',
      endDate: '2026-02-14',
      status: 'active',
      hasUncommittedChanges: false,
      hasPostCommitTweaks: false,
      lastSyncedAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOfflineModified: false,
      syncStatus: 'synced',
      localVersion: 1,
    };

    it('should store and retrieve a lookahead', async () => {
      await offlineDb.lookaheads.put(testLookahead);

      const retrieved = await offlineDb.lookaheads.get(testLookahead.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Lookahead');
      expect(retrieved?.projectId).toBe('project-1');
    });

    it('should update a lookahead', async () => {
      await offlineDb.lookaheads.put(testLookahead);

      await offlineDb.lookaheads.update(testLookahead.id, {
        hasUncommittedChanges: true,
        isOfflineModified: true,
        syncStatus: 'pending',
      });

      const updated = await offlineDb.lookaheads.get(testLookahead.id);
      expect(updated?.hasUncommittedChanges).toBe(true);
      expect(updated?.isOfflineModified).toBe(true);
      expect(updated?.syncStatus).toBe('pending');
    });

    it('should query lookaheads by project', async () => {
      await offlineDb.lookaheads.put(testLookahead);
      await offlineDb.lookaheads.put({
        ...testLookahead,
        id: 'test-lookahead-2',
        name: 'Another Lookahead',
      });
      await offlineDb.lookaheads.put({
        ...testLookahead,
        id: 'test-lookahead-3',
        projectId: 'project-2',
        name: 'Different Project',
      });

      const project1Lookaheads = await offlineDb.lookaheads
        .where('projectId')
        .equals('project-1')
        .toArray();

      expect(project1Lookaheads.length).toBe(2);
    });

    it('should delete a lookahead', async () => {
      await offlineDb.lookaheads.put(testLookahead);
      await offlineDb.lookaheads.delete(testLookahead.id);

      const deleted = await offlineDb.lookaheads.get(testLookahead.id);
      expect(deleted).toBeUndefined();
    });
  });

  describe('Activity Storage', () => {
    const testActivity: OfflineLookaheadActivity = {
      id: 'activity-1',
      lookaheadScheduleId: 'lookahead-1',
      persistentInternalGuid: 'guid-1',
      name: 'Test Activity',
      startDate: '2026-02-01',
      finishDate: '2026-02-05',
      duration: 5,
      percentComplete: 0,
      plannerStatus: null,
      hasConflict: false,
      isCommitted: false,
      hasPostCommitTweaks: false,
      isOfflineModified: false,
      syncStatus: 'synced',
      localVersion: 1,
    };

    it('should store and retrieve an activity', async () => {
      await offlineDb.activities.put(testActivity);

      const retrieved = await offlineDb.activities.get(testActivity.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Activity');
    });

    it('should update activity with original values for conflict resolution', async () => {
      await offlineDb.activities.put(testActivity);

      await offlineDb.activities.update(testActivity.id, {
        plannerStatus: 'will_do',
        isOfflineModified: true,
        syncStatus: 'pending',
        originalValues: {
          plannerStatus: null,
          percentComplete: 0,
          startDate: '2026-02-01',
          finishDate: '2026-02-05',
        },
      });

      const updated = await offlineDb.activities.get(testActivity.id);
      expect(updated?.plannerStatus).toBe('will_do');
      expect(updated?.originalValues?.plannerStatus).toBeNull();
    });

    it('should query activities by lookahead', async () => {
      await offlineDb.activities.put(testActivity);
      await offlineDb.activities.put({
        ...testActivity,
        id: 'activity-2',
        name: 'Activity 2',
      });

      const activities = await offlineDb.activities
        .where('lookaheadScheduleId')
        .equals('lookahead-1')
        .toArray();

      expect(activities.length).toBe(2);
    });
  });

  describe('Sync Queue', () => {
    it('should add operations to sync queue', async () => {
      const operation: SyncOperation = {
        operationType: 'mark_status',
        entityType: 'activity',
        entityId: 'activity-1',
        parentId: 'lookahead-1',
        payload: { status: 'will_do' },
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: 'pending',
        priority: 1,
      };

      const id = await offlineDb.syncQueue.add(operation);
      expect(id).toBeDefined();

      const count = await getPendingSyncCount();
      expect(count).toBe(1);
    });

    it('should retrieve pending operations sorted by priority', async () => {
      await offlineDb.syncQueue.add({
        operationType: 'update_activity',
        entityType: 'activity',
        entityId: 'activity-1',
        payload: {},
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: 'pending',
        priority: 2,
      });

      await offlineDb.syncQueue.add({
        operationType: 'commit_changes',
        entityType: 'lookahead',
        entityId: 'lookahead-1',
        payload: {},
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: 'pending',
        priority: 0,
      });

      const pending = await offlineDb.syncQueue
        .where('status')
        .equals('pending')
        .sortBy('priority');

      expect(pending.length).toBe(2);
      expect(pending[0].operationType).toBe('commit_changes'); // Priority 0
      expect(pending[1].operationType).toBe('update_activity'); // Priority 2
    });

    it('should update operation status', async () => {
      const id = await offlineDb.syncQueue.add({
        operationType: 'mark_status',
        entityType: 'activity',
        entityId: 'activity-1',
        payload: {},
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: 'pending',
        priority: 1,
      });

      await offlineDb.syncQueue.update(id, {
        status: 'completed',
        attempts: 1,
      });

      const updated = await offlineDb.syncQueue.get(id);
      expect(updated?.status).toBe('completed');
      expect(updated?.attempts).toBe(1);
    });
  });

  describe('Conflicts', () => {
    it('should store and retrieve conflicts', async () => {
      const conflict: SyncConflict = {
        entityType: 'activity',
        entityId: 'activity-1',
        localValue: { plannerStatus: 'will_do' },
        serverValue: { plannerStatus: 'should_do' },
        conflictType: 'update',
        detectedAt: new Date().toISOString(),
      };

      const id = await offlineDb.conflicts.add(conflict);
      expect(id).toBeDefined();

      const count = await getUnresolvedConflictCount();
      expect(count).toBe(1);
    });

    it('should filter unresolved conflicts', async () => {
      await offlineDb.conflicts.add({
        entityType: 'activity',
        entityId: 'activity-1',
        localValue: {},
        serverValue: {},
        conflictType: 'update',
        detectedAt: new Date().toISOString(),
      });

      await offlineDb.conflicts.add({
        entityType: 'activity',
        entityId: 'activity-2',
        localValue: {},
        serverValue: {},
        conflictType: 'update',
        detectedAt: new Date().toISOString(),
        resolvedAt: new Date().toISOString(),
        resolution: 'local',
      });

      const unresolved = await offlineDb.conflicts
        .filter((c) => !c.resolvedAt)
        .toArray();

      expect(unresolved.length).toBe(1);
      expect(unresolved[0].entityId).toBe('activity-1');
    });
  });

  describe('Metadata', () => {
    it('should store and retrieve metadata', async () => {
      await setSyncMetadata('lastSyncAt', '2026-02-04T12:00:00Z');
      await setSyncMetadata('syncEnabled', true);
      await setSyncMetadata('syncInterval', 30000);

      const lastSyncAt = await getSyncMetadata('lastSyncAt');
      const syncEnabled = await getSyncMetadata('syncEnabled');
      const syncInterval = await getSyncMetadata('syncInterval');

      expect(lastSyncAt).toBe('2026-02-04T12:00:00Z');
      expect(syncEnabled).toBe(true);
      expect(syncInterval).toBe(30000);
    });

    it('should return null for non-existent metadata', async () => {
      const value = await getSyncMetadata('nonexistent');
      expect(value).toBeNull();
    });
  });

  describe('Utility Functions', () => {
    it('should detect offline modifications', async () => {
      // Initially no modifications
      let hasModifications = await hasOfflineModifications();
      expect(hasModifications).toBe(false);

      // Add a pending sync operation
      await offlineDb.syncQueue.add({
        operationType: 'mark_status',
        entityType: 'activity',
        entityId: 'activity-1',
        payload: {},
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: 'pending',
        priority: 1,
      });

      hasModifications = await hasOfflineModifications();
      expect(hasModifications).toBe(true);
    });

    it('should clear all offline data', async () => {
      // Add some data
      await offlineDb.lookaheads.put({
        id: 'test',
        masterScheduleId: 'master',
        projectId: 'project',
        name: 'Test',
        startDate: '2026-02-01',
        endDate: '2026-02-14',
        status: 'active',
        hasUncommittedChanges: false,
        hasPostCommitTweaks: false,
        lastSyncedAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOfflineModified: false,
        syncStatus: 'synced',
        localVersion: 1,
      });

      await offlineDb.syncQueue.add({
        operationType: 'mark_status',
        entityType: 'activity',
        entityId: 'activity-1',
        payload: {},
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: 'pending',
        priority: 1,
      });

      // Clear all data
      await clearOfflineData();

      const lookaheadCount = await offlineDb.lookaheads.count();
      const queueCount = await offlineDb.syncQueue.count();

      expect(lookaheadCount).toBe(0);
      expect(queueCount).toBe(0);
    });
  });
});
