/**
 * Integration Tests: Event Bus Cross-Module Event Flows
 *
 * Phase 9: Tests that validate event-driven communication between modules.
 * 
 * Tests:
 * 1. Event publishing and processing
 * 2. Audit log creation from events
 * 3. Webhook delivery from events
 * 4. Cross-module event flows
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../../src/services/eventBus.js';
import { auditService } from '../../src/services/auditService.js';
import { webhookService } from '../../src/services/webhookService.js';
import { prisma } from '../setup.js';
import {
  createTestCompany,
  createTestUser,
  createTestProject,
  createTestSchedule,
  createTestActivities,
  type TestUser,
  type TestCompany,
  type TestProject,
  type TestSchedule,
} from '../helpers/testUtils.js';
import {
  createTestEventQueue,
  waitForEvent,
  clearTestQueue,
  TestEventCollector,
} from '../helpers/eventBus.js';
import {
  verifyAuditLog,
  getLatestAuditLog,
  clearAuditLogs,
} from '../helpers/auditLog.js';
import type { ApprovalCompletedEvent, ActivityUpdatedEvent } from '../../../shared/src/events.js';

describe('Event Bus Integration Tests', () => {
  let eventBus: EventBus;
  let testQueue: ReturnType<typeof createTestEventQueue>;
  let eventCollector: TestEventCollector;
  
  let company: TestCompany;
  let user: TestUser;
  let project: TestProject;
  let schedule: TestSchedule;

  beforeEach(async () => {
    // Create test entities
    company = await createTestCompany('Event Test Company');
    user = await createTestUser(company.id, {
      email: 'event-test@example.com',
      role: 'pm',
    });
    project = await createTestProject(company.id, user.id, {
      name: 'Event Test Project',
    });
    schedule = await createTestSchedule(project.id, user.id, {
      name: 'Event Test Schedule',
    });

    // Create event bus instance for testing
    eventBus = new EventBus();
    
    // Create test queue
    testQueue = createTestEventQueue();
    eventCollector = new TestEventCollector('events');
    
    // Clear audit logs
    await clearAuditLogs();
  });

  afterEach(async () => {
    // Clean up test queue
    await clearTestQueue(testQueue);
    await eventCollector.close();
    await testQueue.close();
    await eventBus.stopProcessors();
  });

  describe('Event Publishing and Processing', () => {
    it('should publish and process approval.completed event', async () => {
      const approvalEvent: ApprovalCompletedEvent = {
        type: 'approval.completed',
        entityId: 'test-approval-id',
        entityType: 'WorkflowApproval',
        userId: user.id,
        companyId: company.id,
        timestamp: new Date(),
        lookaheadId: 'test-lookahead-id',
        approvedBy: user.id,
        activitiesCount: 5,
        metadata: {
          projectId: project.id,
        },
      };

      // Publish event
      await eventBus.publish(approvalEvent);

      // Wait for event to be processed
      const processedEvent = await waitForEvent(
        testQueue,
        'approval.completed',
        'test-approval-id',
        3000
      );

      expect(processedEvent).toBeDefined();
      expect(processedEvent?.type).toBe('approval.completed');
      expect(processedEvent?.entityId).toBe('test-approval-id');
    });

    it('should create audit log entry when event is processed', async () => {
      const approvalEvent: ApprovalCompletedEvent = {
        type: 'approval.completed',
        entityId: 'test-approval-id',
        entityType: 'WorkflowApproval',
        userId: user.id,
        companyId: company.id,
        timestamp: new Date(),
        lookaheadId: 'test-lookahead-id',
        approvedBy: user.id,
        activitiesCount: 5,
      };

      // Publish event
      await eventBus.publish(approvalEvent);

      // Wait for audit log to be created
      const auditLog = await verifyAuditLog(
        'WorkflowApproval',
        'test-approval-id',
        'update',
        { userId: user.id, timeout: 3000 }
      );

      expect(auditLog).toBeDefined();
      expect(auditLog?.action).toBe('update');
      expect(auditLog?.entityType).toBe('WorkflowApproval');
      expect(auditLog?.entityId).toBe('test-approval-id');
      expect(auditLog?.userId).toBe(user.id);
      expect(auditLog?.companyId).toBe(company.id);
    });
  });

  describe('Activity Update Event Flow', () => {
    it('should publish activity.updated event and create audit log', async () => {
      // Create an activity
      const activityIds = await createTestActivities(schedule.id, 1);
      const activityId = activityIds[0];

      // Get the activity
      const activity = await prisma.scheduleActivity.findUnique({
        where: { id: activityId },
      });

      expect(activity).toBeDefined();

      // Simulate activity update event
      const updateEvent: ActivityUpdatedEvent = {
        type: 'activity.updated',
        entityId: activityId,
        entityType: 'Activity',
        userId: user.id,
        companyId: company.id,
        timestamp: new Date(),
        scheduleId: schedule.id,
        changes: {
          percentComplete: {
            old: 0,
            new: 50,
          },
        },
      };

      // Publish event
      await eventBus.publish(updateEvent);

      // Wait for audit log
      const auditLog = await verifyAuditLog(
        'Activity',
        activityId,
        'update',
        { userId: user.id, timeout: 3000 }
      );

      expect(auditLog).toBeDefined();
      expect(auditLog?.changes).toBeDefined();
      
      const changes = auditLog?.changes as Record<string, { old: unknown; new: unknown }>;
      expect(changes.percentComplete).toBeDefined();
      expect(changes.percentComplete?.old).toBe(0);
      expect(changes.percentComplete?.new).toBe(50);
    });
  });

  describe('Webhook Delivery from Events', () => {
    it('should deliver webhook when event is published', async () => {
      // Create a webhook subscription
      const subscription = await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook.test.example.com/webhook',
        events: ['approval.completed'],
        secret: 'test-secret',
        isActive: true,
      });

      // Mock fetch for webhook delivery
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      // Publish event
      const approvalEvent: ApprovalCompletedEvent = {
        type: 'approval.completed',
        entityId: 'test-approval-id',
        entityType: 'WorkflowApproval',
        userId: user.id,
        companyId: company.id,
        timestamp: new Date(),
        lookaheadId: 'test-lookahead-id',
        approvedBy: user.id,
        activitiesCount: 5,
      };

      await eventBus.publish(approvalEvent);

      // Wait a bit for webhook processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify webhook was called
      expect(fetchMock).toHaveBeenCalled();
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[0]).toBe('https://webhook.test.example.com/webhook');
      expect(callArgs[1]?.method).toBe('POST');
      expect(callArgs[1]?.headers['Content-Type']).toBe('application/json');
      expect(callArgs[1]?.headers['X-Webhook-Event']).toBe('approval.completed');

      // Clean up
      await webhookService.deleteSubscription(subscription.id);
      vi.restoreAllMocks();
    });
  });

  describe('Cross-Module Event Flow', () => {
    it('should handle complete workflow: approval → audit → webhook', async () => {
      // Create webhook subscription
      const subscription = await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook.test.example.com/webhook',
        events: ['approval.completed'],
        secret: 'test-secret',
        isActive: true,
      });

      // Mock fetch
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      // Publish approval event
      const approvalEvent: ApprovalCompletedEvent = {
        type: 'approval.completed',
        entityId: 'test-approval-id',
        entityType: 'WorkflowApproval',
        userId: user.id,
        companyId: company.id,
        timestamp: new Date(),
        lookaheadId: 'test-lookahead-id',
        approvedBy: user.id,
        activitiesCount: 5,
      };

      await eventBus.publish(approvalEvent);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify audit log was created
      const auditLog = await verifyAuditLog(
        'WorkflowApproval',
        'test-approval-id',
        'update',
        { userId: user.id, timeout: 2000 }
      );
      expect(auditLog).toBeDefined();

      // Verify webhook was delivered
      expect(fetchMock).toHaveBeenCalled();

      // Clean up
      await webhookService.deleteSubscription(subscription.id);
      vi.restoreAllMocks();
    });
  });

  describe('Event Queue Statistics', () => {
    it('should provide queue statistics', async () => {
      const approvalEvent: ApprovalCompletedEvent = {
        type: 'approval.completed',
        entityId: 'test-approval-id',
        entityType: 'WorkflowApproval',
        userId: user.id,
        companyId: company.id,
        timestamp: new Date(),
        lookaheadId: 'test-lookahead-id',
        approvedBy: user.id,
        activitiesCount: 5,
      };

      // Publish event
      await eventBus.publish(approvalEvent);

      // Get stats
      const stats = await eventBus.getStats();
      expect(stats).toBeDefined();
      expect(stats.waiting + stats.active + stats.completed).toBeGreaterThanOrEqual(0);
    });
  });
});
