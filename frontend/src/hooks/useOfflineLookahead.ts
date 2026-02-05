/**
 * useOfflineLookahead Hook
 *
 * React hook for managing lookahead data with offline support.
 * Provides:
 * - Automatic caching of lookahead data
 * - Offline-first data access
 * - Queued operations when offline
 * - Seamless sync when back online
 */

import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { offlineSyncService } from '@services/offline';
import { lookaheadApi } from '@services/api/lookaheadApi';
import type { LookaheadSchedule, LookaheadActivity } from '@store/slices/lookaheadSlice';
import { setCurrentLookahead } from '@store/slices/lookaheadSlice';
import type { AppDispatch } from '@store/index';

export interface UseOfflineLookaheadReturn {
  // Data
  lookahead: LookaheadSchedule | null;
  isLoading: boolean;
  error: string | null;
  isOfflineData: boolean;

  // Actions
  fetchLookahead: (lookaheadId: string) => Promise<void>;
  markTaskStatus: (activityId: string, status: 'should_do' | 'will_do') => Promise<void>;
  updateActivity: (activityId: string, updates: Partial<LookaheadActivity>) => Promise<void>;
  commitChanges: () => Promise<void>;
  refreshFromServer: () => Promise<void>;
}

export function useOfflineLookahead(initialLookaheadId?: string): UseOfflineLookaheadReturn {
  const dispatch = useDispatch<AppDispatch>();
  const [lookahead, setLookahead] = useState<LookaheadSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [currentLookaheadId, setCurrentLookaheadId] = useState<string | undefined>(
    initialLookaheadId
  );

  /**
   * Fetch lookahead with offline fallback
   */
  const fetchLookahead = useCallback(async (lookaheadId: string) => {
    setIsLoading(true);
    setError(null);
    setCurrentLookaheadId(lookaheadId);

    try {
      if (offlineSyncService.getIsOnline()) {
        // Online: fetch from server and cache
        const data = await lookaheadApi.getLookahead(lookaheadId);
        await offlineSyncService.cacheLookahead(data);
        setLookahead(data);
        setIsOfflineData(false);
      } else {
        // Offline: try to get from cache
        const cached = await offlineSyncService.getCachedLookahead(lookaheadId);
        if (cached) {
          setLookahead(cached);
          setIsOfflineData(true);
        } else {
          throw new Error('No offline data available for this lookahead');
        }
      }
    } catch (err) {
      // If online fetch fails, try cache
      try {
        const cached = await offlineSyncService.getCachedLookahead(lookaheadId);
        if (cached) {
          setLookahead(cached);
          setIsOfflineData(true);
          setError('Using cached data - server unavailable');
        } else {
          setError(err instanceof Error ? err.message : 'Failed to fetch lookahead');
        }
      } catch {
        setError(err instanceof Error ? err.message : 'Failed to fetch lookahead');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mark task status with offline support
   */
  const markTaskStatus = useCallback(
    async (activityId: string, status: 'should_do' | 'will_do') => {
      if (!currentLookaheadId || !lookahead) return;

      try {
        if (offlineSyncService.getIsOnline()) {
          // Online: send to server immediately
          const updatedActivity = await lookaheadApi.markTaskStatus(
            currentLookaheadId,
            activityId,
            status
          );

          // Update local state
          setLookahead((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              activities: prev.activities.map((a) =>
                a.id === activityId ? updatedActivity : a
              ),
              hasUncommittedChanges: true,
            };
          });

          // Update cache
          await offlineSyncService.cacheLookahead({
            ...lookahead,
            activities: lookahead.activities.map((a) =>
              a.id === activityId ? updatedActivity : a
            ),
            hasUncommittedChanges: true,
          });
        } else {
          // Offline: queue for later sync
          await offlineSyncService.queueMarkStatus(currentLookaheadId, activityId, status);

          // Update local state optimistically
          setLookahead((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              activities: prev.activities.map((a) =>
                a.id === activityId
                  ? { ...a, plannerStatus: status, plannerUpdatedAt: new Date().toISOString() }
                  : a
              ),
              hasUncommittedChanges: true,
            };
          });
          setIsOfflineData(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update task status');
      }
    },
    [currentLookaheadId, lookahead]
  );

  /**
   * Update activity with offline support
   */
  const updateActivity = useCallback(
    async (activityId: string, updates: Partial<LookaheadActivity>) => {
      if (!currentLookaheadId || !lookahead) return;

      try {
        if (offlineSyncService.getIsOnline()) {
          const updatedActivity = await lookaheadApi.updateActivity(
            currentLookaheadId,
            activityId,
            updates
          );

          setLookahead((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              activities: prev.activities.map((a) =>
                a.id === activityId ? updatedActivity : a
              ),
            };
          });

          await offlineSyncService.cacheLookahead({
            ...lookahead,
            activities: lookahead.activities.map((a) =>
              a.id === activityId ? { ...a, ...updates } : a
            ),
          });
        } else {
          await offlineSyncService.queueActivityUpdate(currentLookaheadId, activityId, updates);

          setLookahead((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              activities: prev.activities.map((a) =>
                a.id === activityId ? { ...a, ...updates } : a
              ),
            };
          });
          setIsOfflineData(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update activity');
      }
    },
    [currentLookaheadId, lookahead]
  );

  /**
   * Commit changes with offline support
   */
  const commitChanges = useCallback(async () => {
    if (!currentLookaheadId) return;

    try {
      if (offlineSyncService.getIsOnline()) {
        const updatedLookahead = await lookaheadApi.commitChanges(currentLookaheadId);
        setLookahead(updatedLookahead);
        await offlineSyncService.cacheLookahead(updatedLookahead);
        setIsOfflineData(false);
      } else {
        await offlineSyncService.queueCommitChanges(currentLookaheadId);
        setError('Commit queued - will sync when back online');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit changes');
    }
  }, [currentLookaheadId]);

  /**
   * Force refresh from server
   */
  const refreshFromServer = useCallback(async () => {
    if (!currentLookaheadId) return;

    if (!offlineSyncService.getIsOnline()) {
      setError('Cannot refresh while offline');
      return;
    }

    setIsLoading(true);
    try {
      const data = await lookaheadApi.getLookahead(currentLookaheadId);
      await offlineSyncService.cacheLookahead(data);
      setLookahead(data);
      setIsOfflineData(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh from server');
    } finally {
      setIsLoading(false);
    }
  }, [currentLookaheadId]);

  // Update Redux store when lookahead changes
  useEffect(() => {
    if (lookahead) {
      dispatch(setCurrentLookahead(lookahead));
    }
  }, [lookahead, dispatch]);

  // Fetch initial lookahead if ID provided
  useEffect(() => {
    if (initialLookaheadId) {
      fetchLookahead(initialLookaheadId);
    }
  }, [initialLookaheadId, fetchLookahead]);

  // Listen for online status changes to refresh data
  useEffect(() => {
    const unsubscribe = offlineSyncService.subscribe((event) => {
      if (event.type === 'online' && currentLookaheadId && isOfflineData) {
        // Refresh from server when coming back online
        refreshFromServer();
      }
    });

    return () => unsubscribe();
  }, [currentLookaheadId, isOfflineData, refreshFromServer]);

  return {
    lookahead,
    isLoading,
    error,
    isOfflineData,
    fetchLookahead,
    markTaskStatus,
    updateActivity,
    commitChanges,
    refreshFromServer,
  };
}

export default useOfflineLookahead;
