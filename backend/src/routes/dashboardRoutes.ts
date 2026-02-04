import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const dashboardController = new DashboardController();

// Routes - all require authentication
router.use(authenticate);

router.get('/executive', dashboardController.getExecutiveDashboard);
router.get('/financial/:projectId', dashboardController.getFinancialDrillDown);
router.get('/progress/:projectId', dashboardController.getProjectProgress);
router.get('/delays', dashboardController.getCriticalDelays);

export default router;
