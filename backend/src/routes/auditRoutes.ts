/**
 * Audit Routes
 *
 * Phase 9: Routes for audit log querying.
 */

import { Router } from 'express';
import { auditController } from '../controllers/auditController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// All audit routes require authentication
router.use(authenticate);

// Only admins and PMs can view audit logs
router.use(requireRole('admin', 'pm'));

/**
 * @swagger
 * /audit:
 *   get:
 *     summary: Query audit logs
 *     tags: [Audit]
 *     description: Query audit logs with filters. Only accessible to admins and PMs.
 *     parameters:
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Filter by entity type (e.g., 'Schedule', 'Activity', 'Project')
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by entity ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [create, update, delete]
 *         description: Filter by action type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Number of results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/', auditController.queryAuditLogs.bind(auditController));

/**
 * @swagger
 * /audit/entity/{entityType}/{entityId}:
 *   get:
 *     summary: Get audit trail for specific entity
 *     tags: [Audit]
 *     description: Get complete audit trail for a specific entity. Only accessible to admins and PMs.
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *         description: Entity type (e.g., 'Schedule', 'Activity', 'Project')
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Entity ID
 *     responses:
 *       200:
 *         description: Audit trail retrieved successfully
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/entity/:entityType/:entityId', auditController.getEntityAuditTrail.bind(auditController));

export default router;
