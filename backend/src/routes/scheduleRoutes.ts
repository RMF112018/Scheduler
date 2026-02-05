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

/**
 * @swagger
 * /schedules/{scheduleId}:
 *   get:
 *     summary: Get schedule by ID
 *     tags: [Schedules]
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Schedule ID
 *     responses:
 *       200:
 *         description: Schedule details
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:scheduleId', scheduleController.getSchedule);

/**
 * @swagger
 * /schedules:
 *   post:
 *     summary: Create new schedule
 *     tags: [Schedules]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - name
 *             properties:
 *               projectId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Schedule created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', validate(createScheduleSchema), scheduleController.createSchedule);

/**
 * @swagger
 * /schedules/{scheduleId}:
 *   put:
 *     summary: Update schedule
 *     tags: [Schedules]
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Schedule updated successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:scheduleId', validate(updateScheduleSchema), scheduleController.updateSchedule);

// Activities
router.get('/:scheduleId/activities', scheduleController.getActivities);

// Baselines
router.get('/:scheduleId/baselines', scheduleController.getBaselines);
router.post('/:scheduleId/baselines', scheduleController.createBaseline);
router.get('/:scheduleId/baselines/compare', scheduleController.compareBaselines);

export default router;
