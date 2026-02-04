import { Router } from 'express';
import { ActivityController } from '../controllers/activityController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();
const activityController = new ActivityController();

// Validation schemas
const createActivitySchema = z.object({
  scheduleId: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(500),
  activityCode: z.string().max(100).optional(),
  startDate: z.string().datetime(),
  finishDate: z.string().datetime(),
  duration: z.number().int().positive(),
  percentComplete: z.number().int().min(0).max(100).default(0),
  predecessorIds: z.array(z.string().uuid()).optional(),
  successorIds: z.array(z.string().uuid()).optional(),
  resourceIds: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateActivitySchema = createActivitySchema.partial().omit({ scheduleId: true });

const relationshipSchema = z.object({
  predecessorId: z.string().uuid(),
  successorId: z.string().uuid(),
  type: z.enum(['FS', 'SS', 'FF', 'SF']),
});

// Routes - all require authentication
router.use(authenticate);

router.get('/:activityId', activityController.getActivity);
router.post('/', validate(createActivitySchema), activityController.createActivity);
router.put('/:activityId', validate(updateActivitySchema), activityController.updateActivity);
router.delete('/:activityId', activityController.deleteActivity);

// Relationships
router.post('/relationships', validate(relationshipSchema), activityController.addRelationship);
router.delete('/relationships', activityController.removeRelationship);

export default router;
