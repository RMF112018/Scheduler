/**
 * Integration Tests: Webhook Delivery
 *
 * Phase 9: Tests for webhook subscription and delivery functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webhookService } from '../../src/services/webhookService.js';
// import { eventBus } from '../../src/services/eventBus.js';
import { prisma } from '../setup.js';
import {
  createTestCompany,
  createTestUser,
  type TestUser,
  type TestCompany,
} from '../helpers/testUtils.js';
import type { ApprovalCompletedEvent } from '../../../shared/src/events.js';

describe('Webhook Integration Tests', () => {
  let company: TestCompany;
  let user: TestUser;

  beforeEach(async () => {
    company = await createTestCompany('Webhook Test Company');
    user = await createTestUser(company.id, {
      email: 'webhook-test@example.com',
      role: 'admin',
    });
  });

  afterEach(async () => {
    // Clean up webhook subscriptions
    await prisma.webhookSubscription.deleteMany({
      where: { companyId: company.id },
    });
  });

  describe('Webhook Subscription Management', () => {
    it('should create a webhook subscription', async () => {
      const subscription = await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook.test.example.com/webhook',
        events: ['approval.completed', 'activity.updated'],
        secret: 'test-secret',
        isActive: true,
      });

      expect(subscription).toBeDefined();
      expect(subscription.companyId).toBe(company.id);
      expect(subscription.url).toBe('https://webhook.test.example.com/webhook');
      expect(subscription.events).toContain('approval.completed');
      expect(subscription.events).toContain('activity.updated');
      expect(subscription.secret).toBe('test-secret');
      expect(subscription.isActive).toBe(true);
    });

    it('should get webhook subscriptions for a company', async () => {
      // Create multiple subscriptions
      await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook1.test.example.com/webhook',
        events: ['approval.completed'],
        isActive: true,
      });

      await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook2.test.example.com/webhook',
        events: ['activity.updated'],
        isActive: false,
      });

      const subscriptions = await webhookService.getSubscriptions(company.id, false);
      expect(subscriptions.length).toBe(2);

      const activeSubscriptions = await webhookService.getSubscriptions(company.id, true);
      expect(activeSubscriptions.length).toBe(1);
    });

    it('should update a webhook subscription', async () => {
      const subscription = await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook.test.example.com/webhook',
        events: ['approval.completed'],
        isActive: true,
      });

      const updated = await webhookService.updateSubscription(subscription.id, {
        url: 'https://webhook.updated.test.example.com/webhook',
        events: ['approval.completed', 'approval.rejected'],
        isActive: false,
      });

      expect(updated.url).toBe('https://webhook.updated.test.example.com/webhook');
      expect(updated.events).toContain('approval.rejected');
      expect(updated.isActive).toBe(false);
    });

    it('should delete a webhook subscription', async () => {
      const subscription = await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook.test.example.com/webhook',
        events: ['approval.completed'],
        isActive: true,
      });

      await webhookService.deleteSubscription(subscription.id);

      const subscriptions = await webhookService.getSubscriptions(company.id, false);
      expect(subscriptions.length).toBe(0);
    });
  });

  describe('Webhook Delivery', () => {
    it('should deliver event to subscribed webhook', async () => {
      // Create subscription
      await webhookService.createSubscription({
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

      // Create event
      const event: ApprovalCompletedEvent = {
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

      // Deliver event
      await webhookService.deliverEvent(event);

      // Wait a bit for async processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify webhook was called
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[0]).toBe('https://webhook.test.example.com/webhook');
      expect(callArgs[1]?.method).toBe('POST');
      expect(callArgs[1]?.headers['Content-Type']).toBe('application/json');
      expect(callArgs[1]?.headers['X-Webhook-Event']).toBe('approval.completed');
      expect(callArgs[1]?.headers['X-Webhook-Signature']).toBeDefined();

      // Verify payload
      const payload = JSON.parse(callArgs[1]?.body as string);
      expect(payload.type).toBe('approval.completed');
      expect(payload.entityId).toBe('test-approval-id');

      vi.restoreAllMocks();
    });

    it('should not deliver to inactive subscriptions', async () => {
      // Create inactive subscription
      await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook.test.example.com/webhook',
        events: ['approval.completed'],
        isActive: false,
      });

      // Mock fetch
      const fetchMock = vi.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      // Create and deliver event
      const event: ApprovalCompletedEvent = {
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

      await webhookService.deliverEvent(event);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify webhook was NOT called
      expect(fetchMock).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('should only deliver to subscriptions matching event type', async () => {
      // Create subscriptions for different event types
      await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook1.test.example.com/webhook',
        events: ['approval.completed'],
        isActive: true,
      });

      await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook2.test.example.com/webhook',
        events: ['activity.updated'],
        isActive: true,
      });

      // Mock fetch
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      // Create approval event
      const event: ApprovalCompletedEvent = {
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

      await webhookService.deliverEvent(event);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify only the matching subscription was called
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('https://webhook1.test.example.com/webhook');

      vi.restoreAllMocks();
    });

    it('should handle webhook delivery failures and increment failure count', async () => {
      // Create subscription
      const subscription = await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook.test.example.com/webhook',
        events: ['approval.completed'],
        isActive: true,
      });

      // Mock fetch to fail
      const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = fetchMock as unknown as typeof fetch;

      // Create and deliver event
      const event: ApprovalCompletedEvent = {
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

      // Expect error to be thrown (handled by BullMQ retry)
      await expect(webhookService.deliverEvent(event)).rejects.toThrow();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify failure count was incremented
      const updated = await prisma.webhookSubscription.findUnique({
        where: { id: subscription.id },
      });
      expect(updated?.failureCount).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });

    it('should sign webhook payload with HMAC when secret is provided', async () => {
      // Create subscription with secret
      await webhookService.createSubscription({
        companyId: company.id,
        url: 'https://webhook.test.example.com/webhook',
        events: ['approval.completed'],
        secret: 'test-secret-key',
        isActive: true,
      });

      // Mock fetch
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'OK',
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      // Create and deliver event
      const event: ApprovalCompletedEvent = {
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

      await webhookService.deliverEvent(event);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify signature header is present
      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[1]?.headers['X-Webhook-Signature']).toBeDefined();
      expect(callArgs[1]?.headers['X-Webhook-Signature']).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex

      vi.restoreAllMocks();
    });
  });
});
