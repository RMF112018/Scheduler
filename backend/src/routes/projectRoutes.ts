import { Router } from 'express';
import { ProjectController } from '../controllers/projectController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();
const projectController = new ProjectController();

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateProjectSchema = createProjectSchema.partial();

// Routes - all require authentication
router.use(authenticate);

router.get('/', projectController.getProjects);
router.get('/:projectId', projectController.getProject);
router.post('/', validate(createProjectSchema), projectController.createProject);
router.put('/:projectId', validate(updateProjectSchema), projectController.updateProject);
router.delete('/:projectId', requirePermission('project:delete'), projectController.deleteProject);

// Project schedules
router.get('/:projectId/schedules', projectController.getProjectSchedules);

// Project lookaheads
router.get('/:projectId/lookaheads', projectController.getProjectLookaheads);

export default router;
