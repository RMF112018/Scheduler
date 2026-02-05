/**
 * Module Check Middleware
 *
 * Phase 9: Middleware to verify that a module is enabled before allowing access.
 */

import { Request, Response, NextFunction } from 'express';
import { moduleConfig } from '../config/modules.js';
import { logger } from '../utils/logger.js';

/**
 * Require a specific module to be enabled
 * Returns 503 Service Unavailable if module is disabled
 */
export function requireModule(moduleName: keyof typeof moduleConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!moduleConfig[moduleName]) {
      logger.warn(`Module ${moduleName} is disabled but was accessed from ${req.path}`);
      res.status(503).json({
        success: false,
        error: 'Module not enabled',
        message: `${moduleName} module is not enabled in this environment`,
        module: moduleName,
      });
      return;
    }
    next();
  };
}

/**
 * Check if partner webhooks are enabled
 */
export function requirePartnerWebhooks(req: Request, res: Response, next: NextFunction): void {
  if (!moduleConfig.PARTNER_WEBHOOKS) {
    logger.warn('Partner webhooks are disabled but were accessed');
    res.status(503).json({
      success: false,
      error: 'Partner webhooks not enabled',
      message: 'Partner webhook integrations are not enabled in this environment',
    });
    return;
  }
  next();
}
