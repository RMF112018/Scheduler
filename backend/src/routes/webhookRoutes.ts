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

/**
 * @swagger
 * /webhooks:
 *   post:
 *     summary: Create webhook subscription
 *     tags: [Webhooks]
 *     description: Create a new webhook subscription for receiving events. Only accessible to admins and PMs.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - events
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: Webhook endpoint URL
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of event types to subscribe to
 *                 example: ['activity.updated', 'approval.completed']
 *               secret:
 *                 type: string
 *                 description: Optional HMAC secret for webhook signing
 *     responses:
 *       201:
 *         description: Webhook subscription created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *   get:
 *     summary: Get all webhook subscriptions
 *     tags: [Webhooks]
 *     description: Get all webhook subscriptions for the company. Only accessible to admins and PMs.
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filter to only active subscriptions
 *     responses:
 *       200:
 *         description: Webhook subscriptions retrieved successfully
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post('/', webhookController.createSubscription.bind(webhookController));
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
