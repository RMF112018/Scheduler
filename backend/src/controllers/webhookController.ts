/**
 * Webhook Controller
 *
 * Phase 9: API endpoints for webhook subscription management.
 */

import { Request, Response, NextFunction } from 'express';
import { webhookService } from '../services/webhookService.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export class WebhookController {
  /**
   * Create a new webhook subscription
   * POST /api/v1/webhooks
   */
  async createSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url, events, secret } = req.body;

      if (!url || !events || !Array.isArray(events) || events.length === 0) {
        throw new BadRequestError('url and events (array) are required');
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        throw new BadRequestError('Invalid URL format');
      }

      const subscription = await webhookService.createSubscription({
        companyId: req.user!.companyId,
        url,
        events,
        secret,
        isActive: true,
      });

      res.status(201).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all webhook subscriptions for the company
   * GET /api/v1/webhooks
   */
  async getSubscriptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activeOnly = req.query.activeOnly !== 'false';
      const subscriptions = await webhookService.getSubscriptions(
        req.user!.companyId,
        activeOnly
      );

      res.json({
        success: true,
        data: subscriptions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific webhook subscription
   * GET /api/v1/webhooks/:id
   */
  async getSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const subscriptions = await webhookService.getSubscriptions(req.user!.companyId, false);
      const subscription = subscriptions.find((s) => s.id === id);

      if (!subscription) {
        throw new NotFoundError('Webhook subscription not found');
      }

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a webhook subscription
   * PUT /api/v1/webhooks/:id
   */
  async updateSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { url, events, secret, isActive } = req.body;

      // Verify subscription belongs to company
      const subscriptions = await webhookService.getSubscriptions(req.user!.companyId, false);
      const subscription = subscriptions.find((s) => s.id === id);

      if (!subscription) {
        throw new NotFoundError('Webhook subscription not found');
      }

      // Validate URL if provided
      if (url) {
        try {
          new URL(url);
        } catch {
          throw new BadRequestError('Invalid URL format');
        }
      }

      const updated = await webhookService.updateSubscription(id, {
        url,
        events,
        secret,
        isActive,
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a webhook subscription
   * DELETE /api/v1/webhooks/:id
   */
  async deleteSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Verify subscription belongs to company
      const subscriptions = await webhookService.getSubscriptions(req.user!.companyId, false);
      const subscription = subscriptions.find((s) => s.id === id);

      if (!subscription) {
        throw new NotFoundError('Webhook subscription not found');
      }

      await webhookService.deleteSubscription(id);

      res.json({
        success: true,
        message: 'Webhook subscription deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Test a webhook subscription (send a test event)
   * POST /api/v1/webhooks/:id/test
   */
  async testSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Verify subscription belongs to company
      const subscriptions = await webhookService.getSubscriptions(req.user!.companyId, false);
      const subscription = subscriptions.find((s) => s.id === id);

      if (!subscription) {
        throw new NotFoundError('Webhook subscription not found');
      }

      // Create a test event
      const testEvent = {
        type: 'system_alert' as const,
        entityId: 'test',
        entityType: 'Test',
        userId: req.user!.id,
        companyId: req.user!.companyId,
        timestamp: new Date(),
        metadata: {
          test: true,
          message: 'This is a test webhook event',
        },
      };

      const results = await webhookService.deliverEvent(testEvent);

      res.json({
        success: true,
        data: {
          subscriptionId: id,
          results,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const webhookController = new WebhookController();
