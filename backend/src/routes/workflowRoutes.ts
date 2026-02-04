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

const approveSchema = z.object({
  notes: z.string().optional(),
});

// Routes - all require authentication
router.use(authenticate);

// Get approvals
router.get('/', workflowController.getPendingApprovals);
router.get('/my-approvals', workflowController.getMyApprovals);
router.get('/to-review', workflowController.getApprovalsToReview);
router.get('/statistics/:projectId', workflowController.getStatistics);
router.get('/:approvalId', workflowController.getApproval);
router.get('/:approvalId/history', workflowController.getHistory);

// Approval actions - require PM, Superintendent, or Admin role
router.post(
  '/:approvalId/approve',
  requireRole('pm', 'superintendent', 'admin'),
  validate(approveSchema),
  workflowController.approve
);
router.post(
  '/:approvalId/reject',
  requireRole('pm', 'superintendent', 'admin'),
  validate(rejectSchema),
  workflowController.reject
);

export default router;
