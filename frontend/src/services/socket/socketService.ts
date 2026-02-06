/**
 * Socket.io Client Service
 *
 * Manages WebSocket connection for real-time updates including:
 * - Notifications
 * - Schedule/Activity updates
 * - Lookahead collaboration
 * - User presence
 */

import { io, Socket } from 'socket.io-client';

// Event types
export type SocketEventType =
  | 'notification:new'
  | 'notification:unread-count'
  | 'project:updated'
  | 'schedule:updated'
  | 'activity:updated'
  | 'activity:editing'
  | 'activity:editing:stop'
  | 'lookahead:updated'
  | 'lookahead:task:status'
  | 'approval:status'
  | 'user:joined'
  | 'user:left'
  | 'presence:response'
  | 'comment:typing'
  | 'connect'
  | 'disconnect'
  | 'connect_error';

export interface SocketEventData {
  'notification:new': Notification;
  'notification:unread-count': { count: number };
  'project:updated': { projectId: string; [key: string]: unknown };
  'schedule:updated': { scheduleId: string; [key: string]: unknown };
  'activity:updated': { activityId: string; [key: string]: unknown };
  'activity:editing': { userId: string; activityId: string; timestamp: string };
  'activity:editing:stop': { userId: string; activityId: string };
  'lookahead:updated': { lookaheadId: string; [key: string]: unknown };
  'lookahead:task:status': { userId: string; activityId: string; status: string; timestamp: string };
  'approval:status': { lookaheadId: string; status: string; [key: string]: unknown };
  'user:joined': { userId: string; projectId: string; timestamp: string };
  'user:left': { userId: string; projectId: string; timestamp: string };
  'presence:response': { projectId: string; users: string[] };
  'comment:typing': { userId: string; timestamp: string };
  connect: void;
  disconnect: void;
  connect_error: Error;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

type EventCallback<T extends SocketEventType> = (data: SocketEventData[T]) => void;

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventListeners: Map<string, Set<EventCallback<SocketEventType>>> = new Map();
  private joinedRooms: Set<string> = new Set();

  /**
   * Initialize socket connection with authentication token
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      // Socket already connected, skip reconnection
      return;
    }
    // @ts-expect-error - Vite env types
    const apiUrl = (import.meta.env?.VITE_API_URL as string) || 'http://localhost:4000';
    const baseUrl = apiUrl.replace('/api/v1', '');

    this.socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.setupEventHandlers();
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.joinedRooms.clear();
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  // ===========================================================================
  // Room Management
  // ===========================================================================

  /**
   * Join a project room
   */
  joinProject(projectId: string): void {
    if (this.socket && !this.joinedRooms.has(`project:${projectId}`)) {
      this.socket.emit('join:project', projectId);
      this.joinedRooms.add(`project:${projectId}`);
    }
  }

  /**
   * Leave a project room
   */
  leaveProject(projectId: string): void {
    if (this.socket && this.joinedRooms.has(`project:${projectId}`)) {
      this.socket.emit('leave:project', projectId);
      this.joinedRooms.delete(`project:${projectId}`);
    }
  }

  /**
   * Join a schedule room
   */
  joinSchedule(scheduleId: string): void {
    if (this.socket && !this.joinedRooms.has(`schedule:${scheduleId}`)) {
      this.socket.emit('join:schedule', scheduleId);
      this.joinedRooms.add(`schedule:${scheduleId}`);
    }
  }

  /**
   * Leave a schedule room
   */
  leaveSchedule(scheduleId: string): void {
    if (this.socket && this.joinedRooms.has(`schedule:${scheduleId}`)) {
      this.socket.emit('leave:schedule', scheduleId);
      this.joinedRooms.delete(`schedule:${scheduleId}`);
    }
  }

  /**
   * Join a lookahead room
   */
  joinLookahead(lookaheadId: string): void {
    if (this.socket && !this.joinedRooms.has(`lookahead:${lookaheadId}`)) {
      this.socket.emit('join:lookahead', lookaheadId);
      this.joinedRooms.add(`lookahead:${lookaheadId}`);
    }
  }

  /**
   * Leave a lookahead room
   */
  leaveLookahead(lookaheadId: string): void {
    if (this.socket && this.joinedRooms.has(`lookahead:${lookaheadId}`)) {
      this.socket.emit('leave:lookahead', lookaheadId);
      this.joinedRooms.delete(`lookahead:${lookaheadId}`);
    }
  }

  // ===========================================================================
  // Event Subscription
  // ===========================================================================

  /**
   * Subscribe to a socket event
   */
  on<T extends SocketEventType>(event: T, callback: EventCallback<T>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback as EventCallback<SocketEventType>);

    // If socket is connected, add the listener
    if (this.socket) {
      this.socket.on(event, callback as any);
    }

    // Return unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Unsubscribe from a socket event
   */
  off<T extends SocketEventType>(event: T, callback: EventCallback<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback as EventCallback<SocketEventType>);
    }

    if (this.socket) {
      this.socket.off(event, callback as any);
    }
  }

  /**
   * Subscribe to an event once
   */
  once<T extends SocketEventType>(event: T, callback: EventCallback<T>): void {
    if (this.socket) {
      this.socket.once(event, callback as any);
    }
  }

  // ===========================================================================
  // Emit Events
  // ===========================================================================

  /**
   * Emit activity editing start
   */
  emitActivityEditing(scheduleId: string, activityId: string): void {
    this.socket?.emit('activity:editing', { scheduleId, activityId });
  }

  /**
   * Emit activity editing stop
   */
  emitActivityEditingStop(scheduleId: string, activityId: string): void {
    this.socket?.emit('activity:editing:stop', { scheduleId, activityId });
  }

  /**
   * Emit lookahead task status change
   */
  emitLookaheadTaskStatus(lookaheadId: string, activityId: string, status: string): void {
    this.socket?.emit('lookahead:task:status', { lookaheadId, activityId, status });
  }

  /**
   * Emit typing indicator
   */
  emitTyping(entityType: string, entityId: string): void {
    this.socket?.emit('comment:typing', { entityType, entityId });
  }

  /**
   * Request presence information for a project
   */
  requestPresence(projectId: string): void {
    this.socket?.emit('presence:request', projectId);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;

      // Re-join rooms after reconnection
      this.joinedRooms.forEach((room) => {
        const [type, id] = room.split(':');
        if (type === 'project') {
          this.socket?.emit('join:project', id);
        } else if (type === 'schedule') {
          this.socket?.emit('join:schedule', id);
        } else if (type === 'lookahead') {
          this.socket?.emit('join:lookahead', id);
        }
      });

      // Re-attach event listeners
      this.eventListeners.forEach((callbacks, event) => {
        callbacks.forEach((callback) => {
          this.socket?.on(event, callback as (...args: unknown[]) => void);
        });
      });

      // Notify listeners
      const connectListeners = this.eventListeners.get('connect');
      if (connectListeners) {
        connectListeners.forEach((callback) => callback(undefined as never));
      }
    });

    this.socket.on('disconnect', () => {

      const disconnectListeners = this.eventListeners.get('disconnect');
      if (disconnectListeners) {
        disconnectListeners.forEach((callback) => callback(undefined as never));
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      this.reconnectAttempts++;

      const errorListeners = this.eventListeners.get('connect_error');
      if (errorListeners) {
        errorListeners.forEach((callback) => callback(error as never));
      }

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });
  }
}

// Singleton instance
export const socketService = new SocketService();

export default socketService;
