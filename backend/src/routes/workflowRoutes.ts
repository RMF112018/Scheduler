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

const attachmentApproveSchema = z.object({
  notes: z.string().optional(),
});

const attachmentRejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

const bulkAttachmentSchema = z.object({
  action: z.enum(['approve', 'reject']),
  attachmentIds: z.array(z.string()).min(1, 'At least one attachment ID is required'),
  reason: z.string().optional(),
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

// Review data endpoint - combined schedule changes + attachments
router.get(
  '/:approvalId/review',
  requireRole('pm', 'superintendent', 'admin'),
  workflowController.getReviewData
);

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

// ============================================================================
// Attachment Approval Routes
// ============================================================================

// Get pending attachments for an approval
router.get(
  '/:approvalId/attachments',
  requireRole('pm', 'superintendent', 'admin'),
  workflowController.getPendingAttachments
);

// Approve a single attachment
router.post(
  '/attachments/:attachmentId/approve',
  requireRole('pm', 'superintendent', 'admin'),
  validate(attachmentApproveSchema),
  workflowController.approveAttachment
);

// Reject a single attachment
router.post(
  '/attachments/:attachmentId/reject',
  requireRole('pm', 'superintendent', 'admin'),
  validate(attachmentRejectSchema),
  workflowController.rejectAttachment
);

// Bulk approve/reject attachments
router.post(
  '/attachments/bulk',
  requireRole('pm', 'superintendent', 'admin'),
  validate(bulkAttachmentSchema),
  workflowController.bulkAttachmentAction
);

// Attachment statistics for a project
router.get(
  '/attachments/statistics/:projectId',
  workflowController.getAttachmentStatistics
);

export default router;
