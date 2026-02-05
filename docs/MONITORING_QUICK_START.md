# Monitoring Quick Start

Quick reference for setting up Azure Application Insights monitoring.

## Backend Setup (5 minutes)

### 1. Enable in Azure Portal
- Navigate to App Service → **Settings** → **Application Insights**
- Click **Enable** → **Create new** → **Apply**
- Connection string automatically added to App Service settings

### 2. Verify
- Check backend logs for: `Application Insights initialized successfully`
- Visit Application Insights → **Live Metrics**
- Make a request to your API
- See request appear in Live Metrics

## Frontend Setup (5 minutes)

### 1. Get Instrumentation Key
- Application Insights → **Overview** → Copy **Instrumentation Key**

### 2. Add to App Service Settings
- Frontend App Service → **Configuration** → **Application settings**
- Add: `VITE_APPINSIGHTS_KEY` = `<instrumentation-key>`
- Save and restart

### 3. Verify
- Open browser console
- Should see: `Application Insights initialized successfully`
- Navigate between pages
- Check Application Insights → **Page views**

## Essential Alerts (10 minutes)

### 1. High Error Rate
- **Signal:** Failed requests
- **Threshold:** > 5% over 5 minutes
- **Action:** Email notification

### 2. Slow Response Time
- **Signal:** Server response time
- **Threshold:** > 2000ms average over 5 minutes
- **Action:** Email notification

### 3. Exceptions
- **Signal:** Exceptions
- **Threshold:** > 0 over 1 minute
- **Action:** Email notification

## Environment Variables

### Backend
```env
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...;IngestionEndpoint=...
# OR
ENABLE_INSIGHTS=true
APPLICATIONINSIGHTS_CONNECTION_STRING=...
```

### Frontend
```env
VITE_APPINSIGHTS_KEY=your-instrumentation-key
```

## Verification Checklist

- [ ] Backend logs show "Application Insights initialized"
- [ ] Frontend console shows "Application Insights initialized"
- [ ] Live Metrics shows requests
- [ ] Page views appear in Application Insights
- [ ] Alerts configured and tested

## Troubleshooting

**No data appearing?**
1. Check connection string format
2. Verify environment variables set
3. Check NODE_ENV is 'production' or 'staging'
4. Check browser console for errors

**See full guide:** `docs/MONITORING.md`
