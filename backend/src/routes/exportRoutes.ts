import { Router } from 'express';
import { ExportController } from '../controllers/exportController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const exportController = new ExportController();

// Routes - all require authentication
router.use(authenticate);

router.get('/xer/:scheduleId', exportController.exportXER);
router.get('/xlsx/:scheduleId', exportController.exportXLSX);
router.get('/xml/:scheduleId', exportController.exportXML);
router.get('/pdf/:scheduleId', exportController.exportPDF);

export default router;
