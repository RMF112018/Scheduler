/**
 * Azure Application Insights Frontend Integration
 * 
 * Provides client-side telemetry and monitoring for the React application.
 * Tracks page views, user interactions, exceptions, and performance metrics.
 */

import { ApplicationInsights } from '@microsoft/applicationinsights-web';

let appInsights: ApplicationInsights | null = null;

/**
 * Initialize Application Insights for frontend
 * 
 * Should be called early in application startup (e.g., in main.tsx).
 * Only initializes if:
 * - VITE_APPINSIGHTS_KEY is provided, AND
 * - MODE is 'production' or 'staging'
 */
export function setupInsights(): void {
  const instrumentationKey = import.meta.env.VITE_APPINSIGHTS_KEY;
  const mode = import.meta.env.MODE;

  // Only enable in production or staging
  if (mode !== 'production' && mode !== 'staging') {
    // Application Insights disabled in development mode
    return;
  }

  if (!instrumentationKey) {
    console.warn('Application Insights instrumentation key not provided. Monitoring disabled.');
    return;
  }

  try {
    // Configure Application Insights
    appInsights = new ApplicationInsights({
      config: {
        instrumentationKey,
        enableAutoRouteTracking: true, // Automatically track route changes (works with React Router)
        enableCorsCorrelation: true, // Correlate client/server requests
        enableRequestHeaderTracking: true,
        enableResponseHeaderTracking: true,
        enableAjaxErrorStatusText: true,
        enableAjaxPerfTracking: true,
        maxAjaxCallsPerView: -1, // Track all AJAX calls
        enableUnhandledPromiseRejectionTracking: true, // Track unhandled promise rejections
        disableTelemetry: false,
        autoTrackPageVisitTime: true,
      },
    });

    // Initialize Application Insights
    appInsights.loadAppInsights();

    // Set default properties
    appInsights.addTelemetryInitializer((envelope) => {
      if (envelope.tags) {
        envelope.tags['ai.cloud.role'] = 'scheduler-frontend';
        envelope.tags['ai.cloud.roleInstance'] = window.location.hostname;
      }
      if (envelope.data) {
        envelope.data['environment'] = mode;
        envelope.data['version'] = import.meta.env.VITE_APP_VERSION || '1.0.0';
      }
    });

    // Track initial page view
    appInsights.trackPageView();
  } catch (error) {
    console.error('Failed to initialize Application Insights:', error);
    // Don't throw - allow app to continue without monitoring
  }
}

/**
 * Get the Application Insights instance
 */
export function getInsights(): ApplicationInsights | null {
  return appInsights;
}

/**
 * Track a custom event
 */
export function trackEvent(name: string, properties?: Record<string, string>): void {
  if (appInsights) {
    appInsights.trackEvent({ name }, properties);
  }
}

/**
 * Track a custom metric
 */
export function trackMetric(name: string, value: number, properties?: Record<string, string>): void {
  if (appInsights) {
    appInsights.trackMetric({ name, value }, properties);
  }
}

/**
 * Track an exception
 */
export function trackException(error: Error, properties?: Record<string, string>): void {
  if (appInsights) {
    appInsights.trackException({ exception: error }, properties);
  }
}

/**
 * Track a page view
 */
export function trackPageView(name?: string, uri?: string, properties?: Record<string, string>): void {
  if (appInsights) {
    appInsights.trackPageView({ name, uri }, properties);
  }
}

/**
 * Track a user action (button click, form submission, etc.)
 */
export function trackUserAction(action: string, properties?: Record<string, string>): void {
  trackEvent(`User Action: ${action}`, properties);
}

/**
 * Track performance timing
 */
export function trackPerformance(name: string, duration: number, properties?: Record<string, string>): void {
  trackMetric(name, duration, properties);
}

export default appInsights;
