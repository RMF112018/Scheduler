import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { trackException } from '../config/insights.js';

interface ErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
  stack?: string;
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error
  logger.error(`Error: ${err.message}`, err.stack);

  // Track exception in Application Insights
  trackException(err, {
    method: req.method,
    path: req.path,
    statusCode: err instanceof AppError ? err.statusCode.toString() : '500',
    userAgent: req.get('user-agent') || 'unknown',
  });

  // Default error response
  const response: ErrorResponse = {
    success: false,
    message: err.message || 'Internal server error',
  };

  let statusCode = 500;

  // Handle known errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    response.code = err.code;

    if (err instanceof ValidationError) {
      response.errors = err.errors;
    }
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
