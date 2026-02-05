import { Router } from 'express';
import multer from 'multer';
import { ImportController } from '../controllers/importController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const importController = new ImportController();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/octet-stream', // XER files
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/xml',
      'application/xml',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: XER, XLSX, XML'));
    }
  },
});

// Routes - all require authentication
router.use(authenticate);

// Preview import diff before applying (XER)
router.post('/preview', upload.single('file'), importController.previewImport);

// XLSX-specific routes
router.post('/xlsx/preview', upload.single('file'), importController.previewXLSX);
router.post('/xlsx/preview-import', upload.single('file'), importController.previewXLSXImport);

// Execute import
router.post('/xer', upload.single('file'), importController.importXER);
router.post('/xlsx', upload.single('file'), importController.importXLSX);
router.post('/xml', upload.single('file'), importController.importXML);

export default router;
