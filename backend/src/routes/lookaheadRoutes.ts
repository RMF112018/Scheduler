import { Router } from 'express';
import { LookaheadController } from '../controllers/lookaheadController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();
const lookaheadController = new LookaheadController();

// Validation schemas
const createLookaheadSchema = z.object({
  masterScheduleId: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(255),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const updateActivityStatusSchema = z.object({
  status: z.enum(['should_do', 'will_do']),
});

const updateActivitySchema = z.object({
  startDate: z.string().datetime().optional(),
  finishDate: z.string().datetime().optional(),
  duration: z.number().int().positive().optional(),
  percentComplete: z.number().int().min(0).max(100).optional(),
  plannerStatus: z.enum(['should_do', 'will_do']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Routes - all require authentication
router.use(authenticate);

// Lookahead CRUD
router.get('/project/:projectId', lookaheadController.getLookaheadsByProject);
router.get('/schedule/:scheduleId', lookaheadController.getLookaheadsBySchedule);
router.get('/:lookaheadId', lookaheadController.getLookahead);
router.post('/', validate(createLookaheadSchema), lookaheadController.createLookahead);
router.delete('/:lookaheadId', lookaheadController.deleteLookahead);

// Pull from master
router.post('/:lookaheadId/pull', lookaheadController.pullFromMaster);

// Commit changes for approval
router.post('/:lookaheadId/commit', lookaheadController.commitChanges);

// Get uncommitted changes
router.get('/:lookaheadId/uncommitted', lookaheadController.getUncommittedChanges);

// Get pending approval
router.get('/:lookaheadId/pending-approval', lookaheadController.getPendingApproval);

// Activity management
router.put(
  '/:lookaheadId/activities/:activityId/status',
  validate(updateActivityStatusSchema),
  lookaheadController.markTaskStatus
);
router.put(
  '/:lookaheadId/activities/:activityId',
  validate(updateActivitySchema),
  lookaheadController.updateActivity
);

// Conflicts
router.get('/:lookaheadId/conflicts', lookaheadController.checkConflicts);

export default router;
