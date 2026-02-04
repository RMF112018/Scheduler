import { Router } from 'express';
import { WorkflowController } from '../controllers/workflowController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();
const workflowController = new WorkflowController();

// Validation schemas
const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
  category: z.string().optional(),
});

// Routes - all require authentication
router.use(authenticate);

router.get('/', workflowController.getPendingApprovals);
router.get('/:approvalId', workflowController.getApproval);
router.post('/:approvalId/approve', requireRole('pm', 'superintendent', 'admin'), workflowController.approve);
router.post('/:approvalId/reject', requireRole('pm', 'superintendent', 'admin'), validate(rejectSchema), workflowController.reject);
router.get('/:approvalId/history', workflowController.getHistory);

export default router;
