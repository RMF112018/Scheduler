# Monitoring Setup Guide

This guide covers setting up Azure Application Insights for monitoring the Construction Scheduling Application in staging and production environments.

## Table of Contents

- [Overview](#overview)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Azure Portal Configuration](#azure-portal-configuration)
- [Alerts Configuration](#alerts-configuration)
- [Custom Metrics](#custom-metrics)
- [Troubleshooting](#troubleshooting)

## Overview

Azure Application Insights provides:
- **Request tracking** - All HTTP requests with response times
- **Exception tracking** - Automatic capture of errors and exceptions
- **Dependency tracking** - Database queries, Redis calls, external API calls
- **Performance metrics** - Response times, throughput, failure rates
- **Live metrics** - Real-time monitoring dashboard
- **Custom telemetry** - Track business-specific events and metrics

## Backend Setup

### 1. Install Dependencies

Already installed:
```bash
cd backend
pnpm add applicationinsights
```

### 2. Configuration

Application Insights is configured in `backend/src/config/insights.ts` and automatically initialized in `backend/src/index.ts`.

### 3. Environment Variables

Set the following environment variable in your App Service:

```env
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...;IngestionEndpoint=...
```

Or enable via flag:
```env
ENABLE_INSIGHTS=true
APPLICATIONINSIGHTS_CONNECTION_STRING=...
```

### 4. Automatic Tracking

The following are automatically tracked:
- ✅ All HTTP requests (method, path, status code, duration)
- ✅ Unhandled exceptions (via error handler middleware)
- ✅ Database queries (via Prisma)
- ✅ Redis operations
- ✅ External HTTP calls
- ✅ Performance counters

### 5. Custom Telemetry

Use the helper functions to track custom events:

```typescript
import { trackEvent, trackMetric, trackException } from './config/insights';

// Track a custom event
trackEvent('UserAction', { action: 'create_project', userId: '123' });

// Track a custom metric
trackMetric('LookaheadCommitDuration', 1500, { projectId: '456' });

// Track an exception
try {
  // some code
} catch (error) {
  trackException(error, { context: 'lookahead_service' });
}
```

## Frontend Setup

### 1. Install Dependencies

Already installed:
```bash
cd frontend
pnpm add @microsoft/applicationinsights-web
```

### 2. Configuration

Application Insights is configured in `frontend/src/utils/insights.ts` and automatically initialized in `frontend/src/main.tsx`.

### 3. Environment Variables

Add to your `.env` or App Service configuration:

```env
VITE_APPINSIGHTS_KEY=your-instrumentation-key
```

**Note:** For Vite, environment variables must be prefixed with `VITE_` to be accessible in the browser.

### 4. Automatic Tracking

The following are automatically tracked:
- ✅ Page views (route changes)
- ✅ AJAX requests (API calls)
- ✅ Unhandled JavaScript exceptions
- ✅ Unhandled promise rejections
- ✅ Performance metrics (page load time, etc.)

### 5. Custom Telemetry

Use the helper functions to track custom events:

```typescript
import { trackEvent, trackUserAction, trackException } from './utils/insights';

// Track a user action
trackUserAction('button_click', { button: 'commit_lookahead' });

// Track a custom event
trackEvent('WorkflowCompleted', { workflowId: '123', duration: 5000 });

// Track an exception
try {
  // some code
} catch (error) {
  trackException(error, { component: 'LookaheadView' });
}
```

## Azure Portal Configuration

### 1. Enable Application Insights on App Service

1. Navigate to your App Service in Azure Portal
2. Go to **Settings** → **Application Insights**
3. Click **Enable**
4. Select **Create new resource** or use existing
5. Click **Apply**

This automatically:
- Creates Application Insights resource (if new)
- Adds `APPLICATIONINSIGHTS_CONNECTION_STRING` to App Service settings
- Enables server-side monitoring

### 2. Get Instrumentation Key (Frontend)

1. Navigate to your Application Insights resource
2. Go to **Overview**
3. Copy the **Instrumentation Key**
4. Add to frontend App Service settings as `VITE_APPINSIGHTS_KEY`

### 3. Verify Data Collection

1. Navigate to Application Insights resource
2. Go to **Live Metrics** (real-time data)
3. Make a request to your backend
4. You should see requests appearing in real-time

## Alerts Configuration

### Quick Setup: Essential Alerts

#### 1. High Error Rate Alert

**When to alert:** Error rate exceeds 5% over 5 minutes

1. In Application Insights → **Alerts** → **Create** → **Alert rule**
2. **Condition:**
   - Signal: Failed requests
   - Aggregation: Percentage
   - Threshold: > 5%
   - Period: 5 minutes
3. **Actions:**
   - Create action group with email notification
4. **Details:**
   - Alert rule name: `High Error Rate - Staging`
   - Severity: Warning

#### 2. Slow Response Time Alert

**When to alert:** Average response time exceeds 2 seconds over 5 minutes

1. **Condition:**
   - Signal: Server response time
   - Aggregation: Average
   - Threshold: > 2000ms
   - Period: 5 minutes
2. **Actions:**
   - Same action group as above
3. **Details:**
   - Alert rule name: `Slow Response Time - Staging`
   - Severity: Warning

#### 3. Exception Alert

**When to alert:** Any exception occurs

1. **Condition:**
   - Signal: Exceptions
   - Aggregation: Count
   - Threshold: > 0
   - Period: 1 minute
2. **Actions:**
   - Same action group
3. **Details:**
   - Alert rule name: `Exception Detected - Staging`
   - Severity: Error

### Advanced Alerts

#### Database Connection Pool Exhaustion

```kusto
dependencies
| where type == "SQL" and success == false
| where name contains "connection pool"
| summarize count() by bin(timestamp, 5m)
```

#### High Redis Latency

```kusto
dependencies
| where type == "Redis"
| where duration > 100
| summarize avg(duration) by bin(timestamp, 5m)
```

#### Event Bus Queue Depth

Track custom metric for BullMQ queue depth and alert when > 100.

## Custom Metrics

### Backend Custom Metrics

Track business-specific metrics:

```typescript
import { trackMetric } from './config/insights';

// Track lookahead commit duration
trackMetric('LookaheadCommitDuration', duration, {
  projectId,
  activityCount: activities.length,
});

// Track approval workflow duration
trackMetric('ApprovalWorkflowDuration', duration, {
  lookaheadId,
  approverRole: user.role,
});
```

### Frontend Custom Metrics

Track user experience metrics:

```typescript
import { trackMetric } from './utils/insights';

// Track page load time
trackMetric('PageLoadTime', performance.now(), {
  route: window.location.pathname,
});

// Track user action duration
const startTime = performance.now();
// ... user action ...
trackMetric('UserActionDuration', performance.now() - startTime, {
  action: 'commit_lookahead',
});
```

## Key Metrics to Monitor

### Backend Metrics

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Request rate | > 0 | < 1 req/min for 10 min |
| Success rate | > 99% | < 95% |
| Response time (P95) | < 500ms | > 2000ms |
| Exception rate | < 0.1% | > 1% |
| Database query time (P95) | < 100ms | > 500ms |
| Redis latency | < 10ms | > 50ms |

### Frontend Metrics

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Page load time | < 2s | > 5s |
| API call success rate | > 99% | < 95% |
| JavaScript errors | 0 | > 0 |
| Unhandled promise rejections | 0 | > 0 |

## Troubleshooting

### No Data Appearing

1. **Check connection string:**
   - Verify `APPLICATIONINSIGHTS_CONNECTION_STRING` is set
   - Format: `InstrumentationKey=...;IngestionEndpoint=...`

2. **Check initialization:**
   - Backend: Check logs for "Application Insights initialized successfully"
   - Frontend: Check browser console for initialization message

3. **Check environment:**
   - Backend: `NODE_ENV` must be `production` or `staging`, OR `ENABLE_INSIGHTS=true`
   - Frontend: `MODE` must be `production` or `staging`

4. **Check network:**
   - Verify App Service can reach Application Insights endpoints
   - Check firewall rules

### High Telemetry Volume

If telemetry volume is too high (cost concerns):

1. **Sampling:**
   ```typescript
   appInsights.setup(connectionString)
     .setAutoCollectRequests(true)
     .setAutoCollectDependencies(true)
     .setSamplingPercentage(50) // Sample 50% of requests
   ```

2. **Disable specific collectors:**
   ```typescript
   appInsights.setup(connectionString)
     .setAutoCollectConsole(false) // Disable console logging
   ```

### Missing Dependencies

If database queries or Redis calls aren't showing:

1. **Check Prisma client:**
   - Application Insights should automatically track Prisma queries
   - Verify Prisma client is using the same connection

2. **Check Redis:**
   - Verify Redis client is using ioredis (auto-tracked)
   - Custom Redis clients may need manual tracking

## Best Practices

1. **Don't log sensitive data:**
   - Avoid logging passwords, tokens, or PII in custom properties
   - Use hashed or masked values

2. **Use meaningful names:**
   - Event names: `UserAction: CreateProject`
   - Metric names: `LookaheadCommitDuration`
   - Property names: `projectId`, `userId` (not `id`)

3. **Set appropriate sampling:**
   - High-traffic endpoints: Sample 10-50%
   - Low-traffic endpoints: Sample 100%

4. **Monitor costs:**
   - Review Application Insights usage regularly
   - Set up budget alerts in Azure

5. **Correlate client/server:**
   - Enable CORS correlation for end-to-end tracking
   - Use operation IDs to trace requests across services

## Next Steps

After monitoring is set up:
1. ✅ Verify data collection in Live Metrics
2. ✅ Set up essential alerts
3. ✅ Review baseline metrics
4. ✅ Document custom metrics for your team
5. ✅ Set up dashboards for key metrics
