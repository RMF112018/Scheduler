import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

let io: SocketServer | null = null;

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: string;
    companyId: string;
  };
}

// Track connected users for presence
const connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

export function initializeSocketIO(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verifyToken(token);
      socket.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        companyId: payload.companyId,
      };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.user?.id;
    const companyId = socket.user?.companyId;

    logger.info(`Socket connected: ${socket.id} (user: ${socket.user?.email})`);

    // Track user connection
    if (userId) {
      if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set());
      }
      connectedUsers.get(userId)!.add(socket.id);

      // Join user's personal room for direct notifications
      socket.join(`user:${userId}`);
    }

    // Join user's company room
    if (companyId) {
      socket.join(`company:${companyId}`);
    }

    // ==========================================================================
    // Room Management
    // ==========================================================================

    // Join project room
    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
      logger.debug(`Socket ${socket.id} joined project:${projectId}`);
      
      // Notify others in the project
      socket.to(`project:${projectId}`).emit('user:joined', {
        userId,
        projectId,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      logger.debug(`Socket ${socket.id} left project:${projectId}`);
      
      // Notify others in the project
      socket.to(`project:${projectId}`).emit('user:left', {
        userId,
        projectId,
        timestamp: new Date().toISOString(),
      });
    });

    // Join schedule room
    socket.on('join:schedule', (scheduleId: string) => {
      socket.join(`schedule:${scheduleId}`);
      logger.debug(`Socket ${socket.id} joined schedule:${scheduleId}`);
    });

    socket.on('leave:schedule', (scheduleId: string) => {
      socket.leave(`schedule:${scheduleId}`);
      logger.debug(`Socket ${socket.id} left schedule:${scheduleId}`);
    });

    // Join lookahead room
    socket.on('join:lookahead', (lookaheadId: string) => {
      socket.join(`lookahead:${lookaheadId}`);
      logger.debug(`Socket ${socket.id} joined lookahead:${lookaheadId}`);
    });

    socket.on('leave:lookahead', (lookaheadId: string) => {
      socket.leave(`lookahead:${lookaheadId}`);
      logger.debug(`Socket ${socket.id} left lookahead:${lookaheadId}`);
    });

    // ==========================================================================
    // Real-time Collaboration Events
    // ==========================================================================

    // Activity editing - broadcast to others viewing the same schedule
    socket.on('activity:editing', (data: { scheduleId: string; activityId: string }) => {
      socket.to(`schedule:${data.scheduleId}`).emit('activity:editing', {
        userId,
        activityId: data.activityId,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('activity:editing:stop', (data: { scheduleId: string; activityId: string }) => {
      socket.to(`schedule:${data.scheduleId}`).emit('activity:editing:stop', {
        userId,
        activityId: data.activityId,
      });
    });

    // Lookahead task status changes
    socket.on('lookahead:task:status', (data: { lookaheadId: string; activityId: string; status: string }) => {
      socket.to(`lookahead:${data.lookaheadId}`).emit('lookahead:task:status', {
        userId,
        activityId: data.activityId,
        status: data.status,
        timestamp: new Date().toISOString(),
      });
    });

    // Typing indicator for comments
    socket.on('comment:typing', (data: { entityType: string; entityId: string }) => {
      const room = `${data.entityType}:${data.entityId}`;
      socket.to(room).emit('comment:typing', {
        userId,
        timestamp: new Date().toISOString(),
      });
    });

    // ==========================================================================
    // Presence
    // ==========================================================================

    socket.on('presence:request', (projectId: string) => {
      // Get all users in the project room
      const room = io?.sockets.adapter.rooms.get(`project:${projectId}`);
      const presentUsers: string[] = [];
      
      if (room) {
        room.forEach((socketId) => {
          const s = io?.sockets.sockets.get(socketId) as AuthenticatedSocket;
          if (s?.user?.id && !presentUsers.includes(s.user.id)) {
            presentUsers.push(s.user.id);
          }
        });
      }
      
      socket.emit('presence:response', { projectId, users: presentUsers });
    });

    // ==========================================================================
    // Disconnect
    // ==========================================================================

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);

      // Remove from connected users tracking
      if (userId) {
        const userSockets = connectedUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            connectedUsers.delete(userId);
          }
        }
      }
    });
  });

  logger.info('✅ Socket.io initialized');
  return io;
}

// =============================================================================
// Notification Functions
// =============================================================================

/**
 * Send notification to a specific user
 */
export function notifyUser(userId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Send notification to all users in a project
 */
export function notifyProjectUpdate(projectId: string, update: unknown): void {
  if (io) {
    io.to(`project:${projectId}`).emit('project:updated', update);
  }
}

/**
 * Send schedule update notification
 */
export function notifyScheduleUpdate(projectId: string, scheduleId: string, update: unknown): void {
  if (io) {
    io.to(`project:${projectId}`).emit('schedule:updated', { scheduleId, ...update as object });
    io.to(`schedule:${scheduleId}`).emit('schedule:updated', update);
  }
}

/**
 * Send activity update notification
 */
export function notifyActivityUpdate(scheduleId: string, activityId: string, update: unknown): void {
  if (io) {
    io.to(`schedule:${scheduleId}`).emit('activity:updated', { activityId, ...update as object });
  }
}

/**
 * Send lookahead update notification
 */
export function notifyLookaheadUpdate(lookaheadId: string, update: unknown): void {
  if (io) {
    io.to(`lookahead:${lookaheadId}`).emit('lookahead:updated', update);
  }
}

/**
 * Send approval status notification
 */
export function notifyApprovalStatus(lookaheadId: string, status: unknown): void {
  if (io) {
    io.to(`lookahead:${lookaheadId}`).emit('approval:status', status);
  }
}

/**
 * Send notification to all users in a company
 */
export function notifyCompany(companyId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`company:${companyId}`).emit(event, data);
  }
}

/**
 * Send a new notification alert to a user
 */
export function sendNotificationAlert(userId: string, notification: unknown): void {
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', notification);
  }
}

/**
 * Broadcast unread count update to a user
 */
export function updateUnreadCount(userId: string, count: number): void {
  if (io) {
    io.to(`user:${userId}`).emit('notification:unread-count', { count });
  }
}

/**
 * Check if a user is currently online
 */
export function isUserOnline(userId: string): boolean {
  return connectedUsers.has(userId);
}

/**
 * Get all online users
 */
export function getOnlineUsers(): string[] {
  return Array.from(connectedUsers.keys());
}

/**
 * Get the Socket.io server instance
 */
export function getIO(): SocketServer {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}

/**
 * Check if Socket.io is initialized
 */
export function isSocketInitialized(): boolean {
  return io !== null;
}
