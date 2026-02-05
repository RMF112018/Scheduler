import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const dashboardController = new DashboardController();

// Routes - all require authentication
router.use(authenticate);

// Executive dashboard
router.get('/executive', dashboardController.getExecutiveDashboard);

// Portfolio health
router.get('/portfolio/health', dashboardController.getPortfolioHealth);

// Project drill-down
router.get('/projects/:projectId', dashboardController.getProjectDrillDown);
router.get('/projects/:projectId/progress', dashboardController.getProjectProgress);
router.get('/projects/:projectId/financial', dashboardController.getFinancialDrillDown);

// Legacy route (deprecated, use /projects/:projectId/financial)
router.get('/financial/:projectId', dashboardController.getFinancialDrillDown);

// Critical delays
router.get('/delays', dashboardController.getCriticalDelays);

// Resource utilization
router.get('/resources/utilization', dashboardController.getResourceUtilization);

export default router;
