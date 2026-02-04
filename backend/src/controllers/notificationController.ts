import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export class NotificationController {
  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      res.json(notifications);
    } catch (error) {
      next(error);
    }
  }

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

  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await prisma.notification.updateMany({
        where: {
          userId: req.user!.id,
          read: false,
        },
        data: { read: true },
      });

      res.json({ message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  }

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
}
