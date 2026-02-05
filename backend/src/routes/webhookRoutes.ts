/**
 * Webhook Routes
 *
 * Phase 9: Routes for webhook subscription management.
 */

import { Router } from 'express';
import { webhookController } from '../controllers/webhookController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// All webhook routes require authentication
router.use(authenticate);

// Only admins and PMs can manage webhooks
router.use(requireRole('admin', 'pm'));

// Create webhook subscription
router.post('/', webhookController.createSubscription.bind(webhookController));

// Get all webhook subscriptions
router.get('/', webhookController.getSubscriptions.bind(webhookController));

// Get specific webhook subscription
router.get('/:id', webhookController.getSubscription.bind(webhookController));

// Update webhook subscription
router.put('/:id', webhookController.updateSubscription.bind(webhookController));

// Delete webhook subscription
router.delete('/:id', webhookController.deleteSubscription.bind(webhookController));

// Test webhook subscription
router.post('/:id/test', webhookController.testSubscription.bind(webhookController));

export default router;
