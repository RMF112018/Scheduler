import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { initializeSocketIO } from './services/socketService.js';
import { prisma } from './config/database.js';
import { logger } from './utils/logger.js';
import { eventBus } from './services/eventBus.js';
import { setupInsights, flushInsights } from './config/insights.js';

const PORT = process.env.PORT || 4000;

// Initialize Application Insights (must be before server creation)
setupInsights();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initializeSocketIO(server);

// Initialize event bus processors
eventBus.startProcessors();

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    // Stop event bus processors
    await eventBus.stopProcessors();
    logger.info('Event bus processors stopped');
    
    // Disconnect Prisma
    await prisma.$disconnect();
    logger.info('Database connection closed');
    
    // Flush Application Insights telemetry
    await flushInsights();
    
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default server;
