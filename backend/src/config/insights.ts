/**
 * Azure Application Insights Configuration
 * 
 * Provides telemetry and monitoring for the application.
 * Automatically tracks requests, dependencies, exceptions, and performance metrics.
 */

import * as appInsights from 'applicationinsights';
import { logger } from '../utils/logger.js';

let isInitialized = false;

/**
 * Initialize Application Insights
 * 
 * Should be called early in application startup, before any routes are registered.
 * Only initializes if:
 * - NODE_ENV is 'production' or 'staging', OR
 * - ENABLE_INSIGHTS environment variable is 'true', AND
 * - APPLICATIONINSIGHTS_CONNECTION_STRING is provided
 */
export function setupInsights(): void {
  // Check if already initialized
  if (isInitialized) {
    logger.warn('Application Insights already initialized');
    return;
  }

  // Get connection string from environment
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  
  // Determine if insights should be enabled
  const shouldEnable = 
    process.env.ENABLE_INSIGHTS === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging';

  if (!shouldEnable) {
    logger.info('Application Insights disabled (set ENABLE_INSIGHTS=true to enable)');
    return;
  }

  if (!connectionString) {
    logger.warn('Application Insights connection string not provided. Monitoring disabled.');
    return;
  }

  try {
    // Configure Application Insights
    appInsights
      .setup(connectionString)
      .setAutoDependencyCorrelation(true) // Automatically correlate dependencies
      .setAutoCollectRequests(true) // Collect HTTP requests
      .setAutoCollectPerformance(true) // Collect performance counters
      .setAutoCollectExceptions(true) // Collect unhandled exceptions
      .setAutoCollectDependencies(true) // Collect dependency calls (DB, HTTP, etc.)
      .setAutoCollectConsole(true, true) // Collect console logs (warnings and errors)
      .setUseDiskRetryCaching(true) // Cache telemetry on disk for retry
      .setSendLiveMetrics(true) // Enable live metrics stream
      .start();

    // Set default properties for all telemetry
    appInsights.defaultClient.commonProperties = {
      environment: process.env.NODE_ENV || 'development',
      service: 'scheduler-backend',
      version: process.env.APP_VERSION || '1.0.0',
    };

    // Set cloud role name for better organization in Application Insights
    appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = 'scheduler-backend';
    appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRoleInstance] = process.env.WEBSITE_INSTANCE_ID || 'local';

    isInitialized = true;
    logger.info('Application Insights initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Application Insights:', error);
    // Don't throw - allow app to continue without monitoring
  }
}

/**
 * Get the Application Insights client
 * 
 * Returns the default client if initialized, null otherwise.
 * Use this to send custom telemetry.
 */
export function getInsightsClient(): appInsights.TelemetryClient | null {
  if (!isInitialized) {
    return null;
  }
  return appInsights.defaultClient;
}

/**
 * Track a custom event
 */
export function trackEvent(name: string, properties?: Record<string, string>): void {
  const client = getInsightsClient();
  if (client) {
    client.trackEvent({ name, properties });
  }
}

/**
 * Track a custom metric
 */
export function trackMetric(name: string, value: number, properties?: Record<string, string>): void {
  const client = getInsightsClient();
  if (client) {
    client.trackMetric({ name, value, properties });
  }
}

/**
 * Track a dependency (external service call)
 */
export function trackDependency(
  name: string,
  commandName: string,
  elapsed: number,
  success: boolean,
  dependencyTypeName: string = 'HTTP',
  properties?: Record<string, string>
): void {
  const client = getInsightsClient();
  if (client) {
    client.trackDependency({
      name,
      commandName,
      elapsed,
      success,
      dependencyTypeName,
      properties,
    });
  }
}

/**
 * Track an exception
 */
export function trackException(error: Error, properties?: Record<string, string>): void {
  const client = getInsightsClient();
  if (client) {
    client.trackException({ exception: error, properties });
  }
}

/**
 * Flush telemetry (useful before shutdown)
 */
export function flushInsights(): Promise<void> {
  const client = getInsightsClient();
  if (client) {
    return new Promise((resolve) => {
      client.flush({
        callback: () => {
          logger.info('Application Insights telemetry flushed');
          resolve();
        },
      });
    });
  }
  return Promise.resolve();
}
