/**
 * useSocket Hook
 *
 * React hook for managing Socket.io connection and events.
 * Automatically connects when user is authenticated and
 * handles real-time notifications.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { socketService } from '../services/socket/socketService.js';
import type { SocketEventType, SocketEventData, Notification } from '../services/socket/socketService.js';
import {
  addNotification,
  setUnreadCount,
} from '../store/slices/notificationSlice.js';
import type { RootState, AppDispatch } from '../store/index.js';

interface UseSocketOptions {
  autoConnect?: boolean;
}

interface UseSocketReturn {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  joinSchedule: (scheduleId: string) => void;
  leaveSchedule: (scheduleId: string) => void;
  joinLookahead: (lookaheadId: string) => void;
  leaveLookahead: (lookaheadId: string) => void;
  emitActivityEditing: (scheduleId: string, activityId: string) => void;
  emitActivityEditingStop: (scheduleId: string, activityId: string) => void;
  emitLookaheadTaskStatus: (lookaheadId: string, activityId: string, status: string) => void;
  requestPresence: (projectId: string) => void;
  on: <T extends SocketEventType>(event: T, callback: (data: SocketEventData[T]) => void) => () => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true } = options;
  const dispatch = useDispatch<AppDispatch>();
  const [isConnected, setIsConnected] = useState(socketService.isConnected());
  const token = useSelector((state: RootState) => state.auth.token);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const cleanupRef = useRef<(() => void)[]>([]);

  // Connect to socket
  const connect = useCallback(() => {
    if (token && !socketService.isConnected()) {
      socketService.connect(token);
    }
  }, [token]);

  // Disconnect from socket
  const disconnect = useCallback(() => {
    socketService.disconnect();
    setIsConnected(false);
  }, []);

  // Set up connection and event handlers
  useEffect(() => {
    if (!isAuthenticated || !token || !autoConnect) {
      return;
    }

    // Connect
    connect();

    // Set up connection status handlers
    const unsubConnect = socketService.on('connect', () => {
      setIsConnected(true);
    });

    const unsubDisconnect = socketService.on('disconnect', () => {
      setIsConnected(false);
    });

    // Set up notification handlers
    const unsubNotification = socketService.on('notification:new', (notification: Notification) => {
      dispatch(addNotification(notification));
    });

    const unsubUnreadCount = socketService.on('notification:unread-count', (data: { count: number }) => {
      dispatch(setUnreadCount(data.count));
    });

    // Store cleanup functions
    cleanupRef.current = [unsubConnect, unsubDisconnect, unsubNotification, unsubUnreadCount];

    return () => {
      cleanupRef.current.forEach((unsub) => unsub());
      cleanupRef.current = [];
    };
  }, [isAuthenticated, token, autoConnect, connect, dispatch]);

  // Disconnect on logout
  useEffect(() => {
    if (!isAuthenticated) {
      disconnect();
    }
  }, [isAuthenticated, disconnect]);

  // Room management
  const joinProject = useCallback((projectId: string) => {
    socketService.joinProject(projectId);
  }, []);

  const leaveProject = useCallback((projectId: string) => {
    socketService.leaveProject(projectId);
  }, []);

  const joinSchedule = useCallback((scheduleId: string) => {
    socketService.joinSchedule(scheduleId);
  }, []);

  const leaveSchedule = useCallback((scheduleId: string) => {
    socketService.leaveSchedule(scheduleId);
  }, []);

  const joinLookahead = useCallback((lookaheadId: string) => {
    socketService.joinLookahead(lookaheadId);
  }, []);

  const leaveLookahead = useCallback((lookaheadId: string) => {
    socketService.leaveLookahead(lookaheadId);
  }, []);

  // Emit events
  const emitActivityEditing = useCallback((scheduleId: string, activityId: string) => {
    socketService.emitActivityEditing(scheduleId, activityId);
  }, []);

  const emitActivityEditingStop = useCallback((scheduleId: string, activityId: string) => {
    socketService.emitActivityEditingStop(scheduleId, activityId);
  }, []);

  const emitLookaheadTaskStatus = useCallback((lookaheadId: string, activityId: string, status: string) => {
    socketService.emitLookaheadTaskStatus(lookaheadId, activityId, status);
  }, []);

  const requestPresence = useCallback((projectId: string) => {
    socketService.requestPresence(projectId);
  }, []);

  // Generic event subscription
  const on = useCallback(<T extends SocketEventType>(
    event: T,
    callback: (data: SocketEventData[T]) => void
  ): (() => void) => {
    return socketService.on(event, callback);
  }, []);

  return {
    isConnected,
    connect,
    disconnect,
    joinProject,
    leaveProject,
    joinSchedule,
    leaveSchedule,
    joinLookahead,
    leaveLookahead,
    emitActivityEditing,
    emitActivityEditingStop,
    emitLookaheadTaskStatus,
    requestPresence,
    on,
  };
}

export default useSocket;
