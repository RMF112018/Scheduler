import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';

import { configurePassport } from './config/passport.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { swaggerSpec } from './config/swagger.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import scheduleRoutes from './routes/scheduleRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import lookaheadRoutes from './routes/lookaheadRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import importRoutes from './routes/importRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import forecastingRoutes from './routes/forecastingRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import userManagementRoutes from './routes/userManagementRoutes.js';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting - more lenient in development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit in development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Passport authentication
configurePassport(passport);
app.use(passport.initialize());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Module status endpoint (Phase 9)
app.get('/health/modules', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    modules: getModuleStatus(),
  });
});

// API Documentation (Swagger UI)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Construction Scheduler API Documentation',
}));

// OpenAPI JSON spec endpoint
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/schedules', scheduleRoutes);
app.use('/api/v1/activities', activityRoutes);
app.use('/api/v1/lookaheads', lookaheadRoutes);
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/import', importRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/forecasts', forecastingRoutes);
app.use('/api/v1', commentRoutes); // Comments are nested under activities and projects
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/admin', userManagementRoutes); // Phase 11: Admin-only user management

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
