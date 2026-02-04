import { Router } from 'express';
import { ScheduleController } from '../controllers/scheduleController.js';
import { authenticate, requireProjectPermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();
const scheduleController = new ScheduleController();

// Validation schemas
const createScheduleSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateScheduleSchema = createScheduleSchema.partial().omit({ projectId: true });

// Routes - all require authentication
router.use(authenticate);

router.get('/:scheduleId', scheduleController.getSchedule);
router.post('/', validate(createScheduleSchema), scheduleController.createSchedule);
router.put('/:scheduleId', validate(updateScheduleSchema), scheduleController.updateSchedule);
router.delete('/:scheduleId', scheduleController.deleteSchedule);

// Activities
router.get('/:scheduleId/activities', scheduleController.getActivities);

// Baselines
router.get('/:scheduleId/baselines', scheduleController.getBaselines);
router.post('/:scheduleId/baselines', scheduleController.createBaseline);
router.get('/:scheduleId/baselines/compare', scheduleController.compareBaselines);

export default router;
