/**
 * Notification Service
 *
 * Comprehensive notification system supporting:
 * - In-app notifications with real-time delivery via Socket.io
 * - Email notifications with HTML templates
 * - Background job processing via BullMQ
 * - Daily digest bundling
 * - User notification preferences
 */

import { PrismaClient, Notification } from '@prisma/client';
import { Queue, Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import { getIO } from './socketService.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | 'schedule_updated'
  | 'activity_completed'
  | 'lookahead_committed'
  | 'approval_required'
  | 'approval_approved'
  | 'approval_rejected'
  | 'conflict_detected'
  | 'deadline_approaching'
  | 'resource_overallocated'
  | 'comment_added'
  | 'mention'
  | 'system_alert'
  | 'daily_digest';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface NotificationRecipient {
  userId: string;
  email?: string;
  preferences?: UserNotificationPreferences;
}

export interface UserNotificationPreferences {
  inApp: boolean;
  email: boolean;
  emailDigest: boolean;
  digestFrequency: 'daily' | 'weekly' | 'never';
  mutedTypes: NotificationType[];
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface DigestJobData {
  userId: string;
  email: string;
  notifications: Notification[];
}

// ============================================================================
// Email Templates
// ============================================================================

const EMAIL_TEMPLATES = {
  notification: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { border-bottom: 2px solid #2196F3; padding-bottom: 16px; margin-bottom: 16px; }
    .logo { font-size: 24px; font-weight: bold; color: #2196F3; }
    .title { font-size: 20px; font-weight: 600; margin: 0 0 8px 0; color: #1a1a1a; }
    .message { font-size: 16px; color: #555; margin-bottom: 20px; }
    .button { display: inline-block; background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; }
    .button:hover { background: #1976D2; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #888; }
    .priority-high { border-left: 4px solid #ff9800; }
    .priority-urgent { border-left: 4px solid #f44336; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card {{#if isUrgent}}priority-urgent{{else if isHigh}}priority-high{{/if}}">
      <div class="header">
        <div class="logo">Scheduler</div>
      </div>
      <h1 class="title">{{title}}</h1>
      <p class="message">{{message}}</p>
      {{#if actionUrl}}
      <a href="{{actionUrl}}" class="button">View Details</a>
      {{/if}}
      <div class="footer">
        <p>This notification was sent from Scheduler. <a href="{{settingsUrl}}">Manage notification preferences</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `,

  digest: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Digest</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .header { border-bottom: 2px solid #2196F3; padding-bottom: 16px; margin-bottom: 16px; }
    .logo { font-size: 24px; font-weight: bold; color: #2196F3; }
    .date { font-size: 14px; color: #888; }
    .section-title { font-size: 18px; font-weight: 600; margin: 16px 0 12px 0; color: #1a1a1a; }
    .notification-item { padding: 12px; border-left: 3px solid #2196F3; margin-bottom: 12px; background: #f9f9f9; border-radius: 0 4px 4px 0; }
    .notification-title { font-weight: 500; margin-bottom: 4px; }
    .notification-message { font-size: 14px; color: #666; }
    .notification-time { font-size: 12px; color: #999; margin-top: 4px; }
    .summary { background: #e3f2fd; padding: 16px; border-radius: 6px; margin-bottom: 16px; }
    .summary-item { display: inline-block; margin-right: 24px; }
    .summary-number { font-size: 24px; font-weight: bold; color: #2196F3; }
    .summary-label { font-size: 12px; color: #666; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">Scheduler</div>
        <div class="date">Daily Digest - {{date}}</div>
      </div>
      
      <div class="summary">
        <div class="summary-item">
          <div class="summary-number">{{totalCount}}</div>
          <div class="summary-label">Total Updates</div>
        </div>
        <div class="summary-item">
          <div class="summary-number">{{approvalCount}}</div>
          <div class="summary-label">Approvals Needed</div>
        </div>
        <div class="summary-item">
          <div class="summary-number">{{alertCount}}</div>
          <div class="summary-label">Alerts</div>
        </div>
      </div>

      {{#if approvals.length}}
      <h2 class="section-title">🔔 Approvals Required</h2>
      {{#each approvals}}
      <div class="notification-item">
        <div class="notification-title">{{this.title}}</div>
        <div class="notification-message">{{this.message}}</div>
        <div class="notification-time">{{this.time}}</div>
      </div>
      {{/each}}
      {{/if}}

      {{#if updates.length}}
      <h2 class="section-title">📋 Schedule Updates</h2>
      {{#each updates}}
      <div class="notification-item">
        <div class="notification-title">{{this.title}}</div>
        <div class="notification-message">{{this.message}}</div>
        <div class="notification-time">{{this.time}}</div>
      </div>
      {{/each}}
      {{/if}}

      {{#if alerts.length}}
      <h2 class="section-title">⚠️ Alerts</h2>
      {{#each alerts}}
      <div class="notification-item">
        <div class="notification-title">{{this.title}}</div>
        <div class="notification-message">{{this.message}}</div>
        <div class="notification-time">{{this.time}}</div>
      </div>
      {{/each}}
      {{/if}}

      <div class="footer">
        <p>This is your daily digest from Scheduler. <a href="{{settingsUrl}}">Manage notification preferences</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `,
};

// Compile templates
const compiledTemplates = {
  notification: Handlebars.compile(EMAIL_TEMPLATES.notification),
  digest: Handlebars.compile(EMAIL_TEMPLATES.digest),
};

// ============================================================================
// Notification Service Class
// ============================================================================

export class NotificationService {
  private emailQueue: Queue<EmailJobData> | null = null;
  private digestQueue: Queue<DigestJobData> | null = null;
  private emailWorker: Worker<EmailJobData> | null = null;
  private digestWorker: Worker<DigestJobData> | null = null;
  private transporter: nodemailer.Transporter | null = null;

  /**
   * Initialize the notification service with queues and email transport
   */
  async initialize(): Promise<void> {
    // Initialize email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });

    // Initialize BullMQ queues
    const redisConnection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    };

    this.emailQueue = new Queue<EmailJobData>('email-notifications', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    this.digestQueue = new Queue<DigestJobData>('digest-notifications', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    });

    // Initialize workers
    this.emailWorker = new Worker<EmailJobData>(
      'email-notifications',
      async (job: Job<EmailJobData>) => {
        await this.processEmailJob(job);
      },
      { connection: redisConnection }
    );

    this.digestWorker = new Worker<DigestJobData>(
      'digest-notifications',
      async (job: Job<DigestJobData>) => {
        await this.processDigestJob(job);
      },
      { connection: redisConnection }
    );

    // Set up worker event handlers
    this.emailWorker.on('completed', (job) => {
      logger.debug(`Email job ${job.id} completed`);
    });

    this.emailWorker.on('failed', (job, err) => {
      logger.error(`Email job ${job?.id} failed:`, err);
    });

    this.digestWorker.on('completed', (job) => {
      logger.debug(`Digest job ${job.id} completed`);
    });

    this.digestWorker.on('failed', (job, err) => {
      logger.error(`Digest job ${job?.id} failed:`, err);
    });

    logger.info('✅ Notification service initialized');
  }

  /**
   * Shutdown the notification service
   */
  async shutdown(): Promise<void> {
    await this.emailWorker?.close();
    await this.digestWorker?.close();
    await this.emailQueue?.close();
    await this.digestQueue?.close();
    this.transporter?.close();
    logger.info('Notification service shut down');
  }

  // ==========================================================================
  // Core Notification Methods
  // ==========================================================================

  /**
   * Send a notification to a single user
   */
  async notify(
    userId: string,
    payload: NotificationPayload
  ): Promise<Notification> {
    // Create in-app notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        actionUrl: payload.actionUrl,
      },
    });

    // Send real-time notification via Socket.io
    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('notification:new', notification);
    } catch {
      // Socket.io may not be initialized in tests
      logger.debug('Socket.io not available for real-time notification');
    }

    // Get user for email notification
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.email) {
      // Queue email notification
      await this.queueEmailNotification(user.email, payload);
    }

    return notification;
  }

  /**
   * Send notifications to multiple users
   */
  async notifyMany(
    userIds: string[],
    payload: NotificationPayload
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];

    for (const userId of userIds) {
      const notification = await this.notify(userId, payload);
      notifications.push(notification);
    }

    return notifications;
  }

  /**
   * Send notification to all users in a company
   */
  async notifyCompany(
    companyId: string,
    payload: NotificationPayload
  ): Promise<Notification[]> {
    const users = await prisma.user.findMany({
      where: { companyId },
      select: { id: true },
    });

    return this.notifyMany(
      users.map((u) => u.id),
      payload
    );
  }

  /**
   * Send notification to all members of a project
   */
  async notifyProject(
    projectId: string,
    payload: NotificationPayload,
    excludeUserId?: string
  ): Promise<Notification[]> {
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });

    const userIds = members
      .map((m) => m.userId)
      .filter((id) => id !== excludeUserId);

    return this.notifyMany(userIds, payload);
  }

  // ==========================================================================
  // Specific Notification Types
  // ==========================================================================

  /**
   * Notify about schedule update
   */
  async notifyScheduleUpdate(
    projectId: string,
    scheduleName: string,
    updatedBy: string,
    changes: string
  ): Promise<void> {
    await this.notifyProject(
      projectId,
      {
        type: 'schedule_updated',
        title: 'Schedule Updated',
        message: `${scheduleName} has been updated: ${changes}`,
        actionUrl: `/projects/${projectId}/schedules`,
        priority: 'normal',
      },
      updatedBy
    );
  }

  /**
   * Notify about lookahead commitment
   */
  async notifyLookaheadCommitted(
    projectId: string,
    lookaheadId: string,
    committedBy: string,
    activitiesCount: number
  ): Promise<void> {
    // Get project managers for approval notification
    const managers = await prisma.projectMember.findMany({
      where: {
        projectId,
        role: { in: ['project_manager', 'admin'] },
      },
      select: { userId: true },
    });

    await this.notifyMany(
      managers.map((m) => m.userId),
      {
        type: 'approval_required',
        title: 'Lookahead Approval Required',
        message: `A lookahead with ${activitiesCount} activities has been committed and requires your approval.`,
        actionUrl: `/projects/${projectId}/lookahead/${lookaheadId}/review`,
        priority: 'high',
      }
    );
  }

  /**
   * Notify about approval decision
   */
  async notifyApprovalDecision(
    userId: string,
    projectId: string,
    lookaheadId: string,
    approved: boolean,
    reason?: string
  ): Promise<void> {
    await this.notify(userId, {
      type: approved ? 'approval_approved' : 'approval_rejected',
      title: approved ? 'Lookahead Approved' : 'Lookahead Rejected',
      message: approved
        ? 'Your lookahead submission has been approved and merged to the master schedule.'
        : `Your lookahead submission was rejected. ${reason || ''}`,
      actionUrl: `/projects/${projectId}/lookahead/${lookaheadId}`,
      priority: approved ? 'normal' : 'high',
    });
  }

  /**
   * Notify about conflict detection
   */
  async notifyConflictDetected(
    userId: string,
    projectId: string,
    conflictType: string,
    activityName: string
  ): Promise<void> {
    await this.notify(userId, {
      type: 'conflict_detected',
      title: 'Conflict Detected',
      message: `A ${conflictType} conflict was detected for activity "${activityName}".`,
      actionUrl: `/projects/${projectId}/conflicts`,
      priority: 'high',
    });
  }

  /**
   * Notify about approaching deadline
   */
  async notifyDeadlineApproaching(
    userId: string,
    projectId: string,
    activityName: string,
    daysRemaining: number
  ): Promise<void> {
    await this.notify(userId, {
      type: 'deadline_approaching',
      title: 'Deadline Approaching',
      message: `Activity "${activityName}" is due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
      actionUrl: `/projects/${projectId}/activities`,
      priority: daysRemaining <= 1 ? 'urgent' : daysRemaining <= 3 ? 'high' : 'normal',
    });
  }

  /**
   * Notify about resource over-allocation
   */
  async notifyResourceOverallocation(
    userId: string,
    staffName: string,
    overallocationPercent: number
  ): Promise<void> {
    await this.notify(userId, {
      type: 'resource_overallocated',
      title: 'Resource Over-Allocated',
      message: `${staffName} is over-allocated by ${overallocationPercent}%.`,
      actionUrl: '/staff/allocations',
      priority: 'high',
    });
  }

  // ==========================================================================
  // Email Methods
  // ==========================================================================

  /**
   * Queue an email notification
   */
  private async queueEmailNotification(
    email: string,
    payload: NotificationPayload
  ): Promise<void> {
    if (!this.emailQueue) {
      logger.warn('Email queue not initialized');
      return;
    }

    const html = compiledTemplates.notification({
      title: payload.title,
      message: payload.message,
      actionUrl: payload.actionUrl,
      settingsUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/notifications`,
      isHigh: payload.priority === 'high',
      isUrgent: payload.priority === 'urgent',
    });

    await this.emailQueue.add('send-email', {
      to: email,
      subject: payload.title,
      html,
      text: payload.message,
    });
  }

  /**
   * Process email job
   */
  private async processEmailJob(job: Job<EmailJobData>): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    const { to, subject, html, text } = job.data;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@scheduler.app',
      to,
      subject,
      html,
      text,
    });

    logger.info(`Email sent to ${to}: ${subject}`);
  }

  // ==========================================================================
  // Digest Methods
  // ==========================================================================

  /**
   * Schedule daily digest for all users
   */
  async scheduleDailyDigests(): Promise<void> {
    const users = await prisma.user.findMany({
      where: {
        // Only users who have email and haven't disabled digests
        email: { not: null },
      },
      select: {
        id: true,
        email: true,
      },
    });

    for (const user of users) {
      if (user.email) {
        await this.scheduleUserDigest(user.id, user.email);
      }
    }

    logger.info(`Scheduled daily digests for ${users.length} users`);
  }

  /**
   * Schedule digest for a single user
   */
  private async scheduleUserDigest(userId: string, email: string): Promise<void> {
    if (!this.digestQueue) {
      logger.warn('Digest queue not initialized');
      return;
    }

    // Get unread notifications from the last 24 hours
    const since = new Date();
    since.setHours(since.getHours() - 24);

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (notifications.length === 0) {
      return; // No notifications to digest
    }

    await this.digestQueue.add('send-digest', {
      userId,
      email,
      notifications,
    });
  }

  /**
   * Process digest job
   */
  private async processDigestJob(job: Job<DigestJobData>): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    const { email, notifications } = job.data;

    // Categorize notifications
    const approvals = notifications.filter((n) =>
      ['approval_required', 'approval_approved', 'approval_rejected'].includes(n.type)
    );
    const updates = notifications.filter((n) =>
      ['schedule_updated', 'activity_completed', 'lookahead_committed'].includes(n.type)
    );
    const alerts = notifications.filter((n) =>
      ['conflict_detected', 'deadline_approaching', 'resource_overallocated', 'system_alert'].includes(n.type)
    );

    const formatTime = (date: Date) => {
      return new Date(date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    };

    const html = compiledTemplates.digest({
      date: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      totalCount: notifications.length,
      approvalCount: approvals.length,
      alertCount: alerts.length,
      approvals: approvals.map((n) => ({
        title: n.title,
        message: n.message,
        time: formatTime(n.createdAt),
      })),
      updates: updates.map((n) => ({
        title: n.title,
        message: n.message,
        time: formatTime(n.createdAt),
      })),
      alerts: alerts.map((n) => ({
        title: n.title,
        message: n.message,
        time: formatTime(n.createdAt),
      })),
      settingsUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/notifications`,
    });

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@scheduler.app',
      to: email,
      subject: `Your Daily Digest - ${notifications.length} updates`,
      html,
    });

    logger.info(`Daily digest sent to ${email} with ${notifications.length} notifications`);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get user's notification preferences
   */
  async getUserPreferences(_userId: string): Promise<UserNotificationPreferences> {
    // In a real implementation, this would fetch from a user_preferences table
    // For now, return defaults
    return {
      inApp: true,
      email: true,
      emailDigest: true,
      digestFrequency: 'daily',
      mutedTypes: [],
    };
  }

  /**
   * Update user's notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> {
    // In a real implementation, this would update a user_preferences table
    const current = await this.getUserPreferences(userId);
    return { ...current, ...preferences };
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
  }> {
    const [total, unread, byType] = await Promise.all([
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, read: false } }),
      prisma.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: true,
      }),
    ]);

    return {
      total,
      unread,
      byType: byType.reduce(
        (acc, item) => {
          acc[item.type] = item._count;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }

  /**
   * Delete old notifications
   */
  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        read: true,
      },
    });

    logger.info(`Cleaned up ${result.count} old notifications`);
    return result.count;
  }
}

// Singleton instance
export const notificationService = new NotificationService();

export default notificationService;
