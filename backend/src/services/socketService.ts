import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

let io: SocketServer;

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    email: string;
    role: string;
    companyId: string;
  };
}

export function initializeSocketIO(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
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
    logger.info(`Socket connected: ${socket.id} (user: ${socket.user?.email})`);

    // Join user's company room
    if (socket.user?.companyId) {
      socket.join(`company:${socket.user.companyId}`);
    }

    // Join project rooms
    socket.on('join:project', (projectId: string) => {
      socket.join(`project:${projectId}`);
      logger.debug(`Socket ${socket.id} joined project:${projectId}`);
    });

    socket.on('leave:project', (projectId: string) => {
      socket.leave(`project:${projectId}`);
      logger.debug(`Socket ${socket.id} left project:${projectId}`);
    });

    // Join lookahead rooms
    socket.on('join:lookahead', (lookaheadId: string) => {
      socket.join(`lookahead:${lookaheadId}`);
      logger.debug(`Socket ${socket.id} joined lookahead:${lookaheadId}`);
    });

    socket.on('leave:lookahead', (lookaheadId: string) => {
      socket.leave(`lookahead:${lookaheadId}`);
      logger.debug(`Socket ${socket.id} left lookahead:${lookaheadId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  logger.info('✅ Socket.io initialized');
  return io;
}

// Notification functions
export function notifyProjectUpdate(projectId: string, update: unknown): void {
  if (io) {
    io.to(`project:${projectId}`).emit('project:updated', update);
  }
}

export function notifyScheduleUpdate(projectId: string, scheduleId: string, update: unknown): void {
  if (io) {
    io.to(`project:${projectId}`).emit('schedule:updated', { scheduleId, ...update });
  }
}

export function notifyLookaheadUpdate(lookaheadId: string, update: unknown): void {
  if (io) {
    io.to(`lookahead:${lookaheadId}`).emit('lookahead:updated', update);
  }
}

export function notifyApprovalStatus(lookaheadId: string, status: unknown): void {
  if (io) {
    io.to(`lookahead:${lookaheadId}`).emit('approval:status', status);
  }
}

export function notifyCompany(companyId: string, event: string, data: unknown): void {
  if (io) {
    io.to(`company:${companyId}`).emit(event, data);
  }
}

export function getIO(): SocketServer {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}
