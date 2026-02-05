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

// Query audit logs
router.get('/', auditController.queryAuditLogs.bind(auditController));

// Get audit trail for specific entity
router.get('/entity/:entityType/:entityId', auditController.getEntityAuditTrail.bind(auditController));

export default router;
