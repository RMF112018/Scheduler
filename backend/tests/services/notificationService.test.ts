/**
 * Notification Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Create a test Prisma client
const prisma = new PrismaClient();

// Test data
let testCompanyId: string;
let testUserId: string;
let testProjectId: string;

describe('NotificationService', () => {
  beforeEach(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: {
        name: 'Test Company',
      },
    });
    testCompanyId = company.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
        companyId: testCompanyId,
      },
    });
    testUserId = user.id;

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        status: 'active',
        company: { connect: { id: testCompanyId } },
        creator: { connect: { id: testUserId } },
      },
    });
    testProjectId = project.id;
  });

  afterEach(async () => {
    // Clean up in correct order
    await prisma.notification.deleteMany({ where: { userId: testUserId } });
    await prisma.projectMember.deleteMany({ where: { projectId: testProjectId } });
    await prisma.project.deleteMany({ where: { id: testProjectId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.company.deleteMany({ where: { id: testCompanyId } });
  });

  describe('Notification CRUD', () => {
    it('should create a notification', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'system_alert',
          title: 'Test Notification',
          message: 'This is a test notification',
        },
      });

      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
      expect(notification.type).toBe('system_alert');
      expect(notification.title).toBe('Test Notification');
      expect(notification.message).toBe('This is a test notification');
      expect(notification.read).toBe(false);
    });

    it('should create a notification with action URL', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'approval_required',
          title: 'Approval Required',
          message: 'A lookahead needs your approval',
          actionUrl: '/projects/123/lookahead/456',
        },
      });

      expect(notification.actionUrl).toBe('/projects/123/lookahead/456');
    });

    it('should get notifications for a user', async () => {
      // Create multiple notifications
      await prisma.notification.createMany({
        data: [
          {
            userId: testUserId,
            type: 'schedule_updated',
            title: 'Schedule Updated',
            message: 'Schedule has been updated',
          },
          {
            userId: testUserId,
            type: 'activity_completed',
            title: 'Activity Completed',
            message: 'An activity has been completed',
          },
          {
            userId: testUserId,
            type: 'conflict_detected',
            title: 'Conflict Detected',
            message: 'A conflict was detected',
          },
        ],
      });

      const notifications = await prisma.notification.findMany({
        where: { userId: testUserId },
        orderBy: { createdAt: 'desc' },
      });

      expect(notifications).toHaveLength(3);
    });

    it('should get unread notification count', async () => {
      // Create mix of read and unread notifications
      await prisma.notification.createMany({
        data: [
          {
            userId: testUserId,
            type: 'system_alert',
            title: 'Unread 1',
            message: 'Unread notification',
            read: false,
          },
          {
            userId: testUserId,
            type: 'system_alert',
            title: 'Unread 2',
            message: 'Unread notification',
            read: false,
          },
          {
            userId: testUserId,
            type: 'system_alert',
            title: 'Read 1',
            message: 'Read notification',
            read: true,
          },
        ],
      });

      const unreadCount = await prisma.notification.count({
        where: {
          userId: testUserId,
          read: false,
        },
      });

      expect(unreadCount).toBe(2);
    });

    it('should mark notification as read', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'system_alert',
          title: 'Test',
          message: 'Test message',
        },
      });

      expect(notification.read).toBe(false);

      const updated = await prisma.notification.update({
        where: { id: notification.id },
        data: { read: true },
      });

      expect(updated.read).toBe(true);
    });

    it('should mark all notifications as read', async () => {
      // Create unread notifications
      await prisma.notification.createMany({
        data: [
          {
            userId: testUserId,
            type: 'system_alert',
            title: 'Unread 1',
            message: 'Message',
            read: false,
          },
          {
            userId: testUserId,
            type: 'system_alert',
            title: 'Unread 2',
            message: 'Message',
            read: false,
          },
        ],
      });

      await prisma.notification.updateMany({
        where: {
          userId: testUserId,
          read: false,
        },
        data: { read: true },
      });

      const unreadCount = await prisma.notification.count({
        where: {
          userId: testUserId,
          read: false,
        },
      });

      expect(unreadCount).toBe(0);
    });

    it('should delete a notification', async () => {
      const notification = await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'system_alert',
          title: 'To Delete',
          message: 'This will be deleted',
        },
      });

      await prisma.notification.delete({
        where: { id: notification.id },
      });

      const found = await prisma.notification.findUnique({
        where: { id: notification.id },
      });

      expect(found).toBeNull();
    });

    it('should delete all read notifications', async () => {
      // Create mix of read and unread
      await prisma.notification.createMany({
        data: [
          {
            userId: testUserId,
            type: 'system_alert',
            title: 'Unread',
            message: 'Keep this',
            read: false,
          },
          {
            userId: testUserId,
            type: 'system_alert',
            title: 'Read 1',
            message: 'Delete this',
            read: true,
          },
          {
            userId: testUserId,
            type: 'system_alert',
            title: 'Read 2',
            message: 'Delete this too',
            read: true,
          },
        ],
      });

      const result = await prisma.notification.deleteMany({
        where: {
          userId: testUserId,
          read: true,
        },
      });

      expect(result.count).toBe(2);

      const remaining = await prisma.notification.findMany({
        where: { userId: testUserId },
      });

      expect(remaining).toHaveLength(1);
      expect(remaining[0].read).toBe(false);
    });
  });

  describe('Notification Types', () => {
    it('should support all notification types', async () => {
      const types = [
        'schedule_updated',
        'activity_completed',
        'lookahead_committed',
        'approval_required',
        'approval_approved',
        'approval_rejected',
        'conflict_detected',
        'deadline_approaching',
        'resource_overallocated',
        'comment_added',
        'mention',
        'system_alert',
        'daily_digest',
      ];

      for (const type of types) {
        const notification = await prisma.notification.create({
          data: {
            userId: testUserId,
            type,
            title: `Test ${type}`,
            message: `Testing ${type} notification`,
          },
        });

        expect(notification.type).toBe(type);
      }

      const allNotifications = await prisma.notification.findMany({
        where: { userId: testUserId },
      });

      expect(allNotifications).toHaveLength(types.length);
    });
  });

  describe('Notification Filtering', () => {
    beforeEach(async () => {
      // Create notifications of different types
      await prisma.notification.createMany({
        data: [
          {
            userId: testUserId,
            type: 'approval_required',
            title: 'Approval 1',
            message: 'Needs approval',
          },
          {
            userId: testUserId,
            type: 'approval_required',
            title: 'Approval 2',
            message: 'Needs approval',
          },
          {
            userId: testUserId,
            type: 'schedule_updated',
            title: 'Schedule Update',
            message: 'Schedule changed',
          },
          {
            userId: testUserId,
            type: 'conflict_detected',
            title: 'Conflict',
            message: 'Conflict found',
          },
        ],
      });
    });

    it('should filter notifications by type', async () => {
      const approvalNotifications = await prisma.notification.findMany({
        where: {
          userId: testUserId,
          type: 'approval_required',
        },
      });

      expect(approvalNotifications).toHaveLength(2);
    });

    it('should filter unread notifications only', async () => {
      // Mark one as read
      const notifications = await prisma.notification.findMany({
        where: { userId: testUserId },
        take: 1,
      });

      await prisma.notification.update({
        where: { id: notifications[0].id },
        data: { read: true },
      });

      const unreadNotifications = await prisma.notification.findMany({
        where: {
          userId: testUserId,
          read: false,
        },
      });

      expect(unreadNotifications).toHaveLength(3);
    });

    it('should paginate notifications', async () => {
      const page1 = await prisma.notification.findMany({
        where: { userId: testUserId },
        orderBy: { createdAt: 'desc' },
        take: 2,
        skip: 0,
      });

      const page2 = await prisma.notification.findMany({
        where: { userId: testUserId },
        orderBy: { createdAt: 'desc' },
        take: 2,
        skip: 2,
      });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe('Notification Statistics', () => {
    beforeEach(async () => {
      await prisma.notification.createMany({
        data: [
          { userId: testUserId, type: 'approval_required', title: 'A1', message: 'M', read: false },
          { userId: testUserId, type: 'approval_required', title: 'A2', message: 'M', read: false },
          { userId: testUserId, type: 'schedule_updated', title: 'S1', message: 'M', read: true },
          { userId: testUserId, type: 'conflict_detected', title: 'C1', message: 'M', read: false },
        ],
      });
    });

    it('should get notification statistics', async () => {
      const [total, unread, byType] = await Promise.all([
        prisma.notification.count({ where: { userId: testUserId } }),
        prisma.notification.count({ where: { userId: testUserId, read: false } }),
        prisma.notification.groupBy({
          by: ['type'],
          where: { userId: testUserId },
          _count: true,
        }),
      ]);

      expect(total).toBe(4);
      expect(unread).toBe(3);
      expect(byType).toHaveLength(3);

      const typeMap = byType.reduce(
        (acc, item) => {
          acc[item.type] = item._count;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(typeMap['approval_required']).toBe(2);
      expect(typeMap['schedule_updated']).toBe(1);
      expect(typeMap['conflict_detected']).toBe(1);
    });
  });

  describe('Notification Cleanup', () => {
    it('should delete old read notifications', async () => {
      // Create old notification (30+ days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);

      await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'system_alert',
          title: 'Old Notification',
          message: 'This is old',
          read: true,
          createdAt: oldDate,
        },
      });

      // Create recent notification
      await prisma.notification.create({
        data: {
          userId: testUserId,
          type: 'system_alert',
          title: 'Recent Notification',
          message: 'This is recent',
          read: true,
        },
      });

      // Delete notifications older than 30 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const result = await prisma.notification.deleteMany({
        where: {
          userId: testUserId,
          createdAt: { lt: cutoff },
          read: true,
        },
      });

      expect(result.count).toBe(1);

      const remaining = await prisma.notification.findMany({
        where: { userId: testUserId },
      });

      expect(remaining).toHaveLength(1);
      expect(remaining[0].title).toBe('Recent Notification');
    });
  });
});
