import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { notificationService, NotificationType } from '../services/notificationService.js';

export class NotificationController {
  /**
   * Get paginated notifications for the current user
   */
  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, unreadOnly = 'false', type } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      const where: Record<string, unknown> = { userId: req.user!.id };
      
      if (unreadOnly === 'true') {
        where.read = false;
      }
      
      if (type) {
        where.type = type as string;
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.notification.count({ where }),
      ]);

      res.json({
        notifications,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await prisma.notification.count({
        where: {
          userId: req.user!.id,
          read: false,
        },
      });

      res.json({ count });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get notification statistics
   */
  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await notificationService.getNotificationStats(req.user!.id);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notificationId } = req.params;

      const notification = await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId: req.user!.id,
        },
        data: { read: true },
      });

      if (notification.count === 0) {
        throw new NotFoundError('Notification not found');
      }

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async markManyAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notificationIds } = req.body;

      if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        throw new BadRequestError('notificationIds must be a non-empty array');
      }

      const result = await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: req.user!.id,
        },
        data: { read: true },
      });

      res.json({ 
        message: 'Notifications marked as read',
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId: req.user!.id,
          read: false,
        },
        data: { read: true },
      });

      res.json({ 
        message: 'All notifications marked as read',
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a single notification
   */
  async deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notificationId } = req.params;

      const result = await prisma.notification.deleteMany({
        where: {
          id: notificationId,
          userId: req.user!.id,
        },
      });

      if (result.count === 0) {
        throw new NotFoundError('Notification not found');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete multiple notifications
   */
  async deleteManyNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notificationIds } = req.body;

      if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        throw new BadRequestError('notificationIds must be a non-empty array');
      }

      const result = await prisma.notification.deleteMany({
        where: {
          id: { in: notificationIds },
          userId: req.user!.id,
        },
      });

      res.json({ 
        message: 'Notifications deleted',
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete all read notifications
   */
  async deleteAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await prisma.notification.deleteMany({
        where: {
          userId: req.user!.id,
          read: true,
        },
      });

      res.json({ 
        message: 'All read notifications deleted',
        count: result.count,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const preferences = await notificationService.getUserPreferences(req.user!.id);
      res.json(preferences);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { inApp, email, emailDigest, digestFrequency, mutedTypes } = req.body;

      const preferences = await notificationService.updateUserPreferences(req.user!.id, {
        inApp,
        email,
        emailDigest,
        digestFrequency,
        mutedTypes,
      });

      res.json(preferences);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send a test notification (admin only)
   */
  async sendTestNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type = 'system_alert', title, message } = req.body;

      if (!title || !message) {
        throw new BadRequestError('title and message are required');
      }

      const notification = await notificationService.notify(req.user!.id, {
        type: type as NotificationType,
        title,
        message,
        priority: 'normal',
      });

      res.json({
        message: 'Test notification sent',
        notification,
      });
    } catch (error) {
      next(error);
    }
  }
}
