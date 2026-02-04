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
});

// Routes - all require authentication
router.use(authenticate);

router.get('/:lookaheadId', lookaheadController.getLookahead);
router.post('/', validate(createLookaheadSchema), lookaheadController.createLookahead);
router.post('/:lookaheadId/pull', lookaheadController.pullFromMaster);
router.post('/:lookaheadId/commit', lookaheadController.commitChanges);

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
