/**
 * Webhook Service
 *
 * Phase 9: Outgoing webhook delivery for partner integrations.
 * Delivers events to subscribed webhook endpoints with retry logic and HMAC signing.
 */

import * as crypto from 'crypto';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import type { BaseEvent, Event } from '../../../shared/src/events.js';

// ============================================================================
// Types
// ============================================================================

export interface WebhookSubscriptionInput {
  companyId: string;
  url: string;
  events: string[];
  secret?: string;
  isActive?: boolean;
}

export interface WebhookDeliveryResult {
  subscriptionId: string;
  url: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  deliveredAt: Date;
}

// ============================================================================
// Webhook Service
// ============================================================================

export class WebhookService {
  /**
   * Create a new webhook subscription
   */
  async createSubscription(input: WebhookSubscriptionInput) {
    return prisma.webhookSubscription.create({
      data: {
        companyId: input.companyId,
        url: input.url,
        events: input.events,
        secret: input.secret,
        isActive: input.isActive ?? true,
      },
    });
  }

  /**
   * Get all active subscriptions for a company
   */
  async getSubscriptions(companyId: string, activeOnly = true) {
    return prisma.webhookSubscription.findMany({
      where: {
        companyId,
        ...(activeOnly && { isActive: true }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Update a webhook subscription
   */
  async updateSubscription(
    id: string,
    updates: Partial<WebhookSubscriptionInput>
  ) {
    return prisma.webhookSubscription.update({
      where: { id },
      data: {
        ...(updates.url && { url: updates.url }),
        ...(updates.events && { events: updates.events }),
        ...(updates.secret !== undefined && { secret: updates.secret }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      },
    });
  }

  /**
   * Delete a webhook subscription
   */
  async deleteSubscription(id: string) {
    return prisma.webhookSubscription.delete({
      where: { id },
    });
  }

  /**
   * Deliver an event to all matching webhook subscriptions
   * This is called by the event bus processor
   */
  async deliverEvent(event: Event): Promise<WebhookDeliveryResult[]> {
    const subscriptions = await prisma.webhookSubscription.findMany({
      where: {
        companyId: event.companyId,
        isActive: true,
        events: { has: event.type },
      },
    });

    if (subscriptions.length === 0) {
      logger.debug(`No webhook subscriptions found for event ${event.type}`);
      return [];
    }

    const results: WebhookDeliveryResult[] = [];

    // Deliver to each subscription
    for (const subscription of subscriptions) {
      try {
        const result = await this.deliverToWebhook(subscription, event);
        results.push(result);

        // Update subscription on success
        if (result.success) {
          await prisma.webhookSubscription.update({
            where: { id: subscription.id },
            data: {
              lastTriggeredAt: new Date(),
              failureCount: 0,
            },
          });
        } else {
          // Increment failure count
          await prisma.webhookSubscription.update({
            where: { id: subscription.id },
            data: {
              failureCount: { increment: 1 },
            },
          });
        }
      } catch (error) {
        logger.error(`Failed to deliver webhook to ${subscription.url}:`, error);
        results.push({
          subscriptionId: subscription.id,
          url: subscription.url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          deliveredAt: new Date(),
        });

        // Increment failure count
        await prisma.webhookSubscription.update({
          where: { id: subscription.id },
          data: {
            failureCount: { increment: 1 },
          },
        });
      }
    }

    return results;
  }

  /**
   * Deliver event to a single webhook endpoint
   */
  private async deliverToWebhook(
    subscription: { id: string; url: string; secret: string | null },
    event: Event
  ): Promise<WebhookDeliveryResult> {
    const payload = JSON.stringify(event);
    const signature = subscription.secret
      ? this.signPayload(payload, subscription.secret)
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Construction-Scheduler-Webhook/1.0',
      'X-Webhook-Event': event.type,
      'X-Webhook-Timestamp': new Date().toISOString(),
    };

    if (signature) {
      headers['X-Webhook-Signature'] = signature;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Webhook delivery failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      return {
        subscriptionId: subscription.id,
        url: subscription.url,
        success: true,
        statusCode: response.status,
        deliveredAt: new Date(),
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Sign payload with HMAC-SHA256
   */
  private signPayload(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Verify webhook signature (for incoming webhooks in future)
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.signPayload(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Retry failed webhook deliveries
   * This can be called periodically to retry failed deliveries
   */
  async retryFailedDeliveries(maxFailures = 3) {
    const failedSubscriptions = await prisma.webhookSubscription.findMany({
      where: {
        isActive: true,
        failureCount: { gte: 1, lt: maxFailures },
      },
    });

    logger.info(`Found ${failedSubscriptions.length} webhook subscriptions with failures`);

    // Note: This is a placeholder - actual retry logic would need to
    // store failed events and retry them. For now, this just resets failure counts
    // after a cooldown period.
    for (const subscription of failedSubscriptions) {
      // Reset failure count after 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (
        subscription.lastTriggeredAt &&
        subscription.lastTriggeredAt < oneHourAgo
      ) {
        await prisma.webhookSubscription.update({
          where: { id: subscription.id },
          data: {
            failureCount: 0,
          },
        });
        logger.info(`Reset failure count for webhook ${subscription.id}`);
      }
    }
  }
}

export const webhookService = new WebhookService();
