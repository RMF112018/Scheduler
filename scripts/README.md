# Deployment Scripts

Scripts for deploying and managing the Construction Scheduling Application.

## azure-setup.sh

Creates all necessary Azure resources for staging deployment.

### Usage

```bash
./scripts/azure-setup.sh
```

### What it creates

1. Resource Group: `scheduler-staging-rg`
2. App Service Plan: `scheduler-staging-plan` (B1 tier)
3. PostgreSQL Flexible Server: `scheduler-staging-db`
4. Redis Cache: `scheduler-staging-redis` (Basic C0)
5. Storage Account: `schedulerstagingstorage`
6. Application Insights: `scheduler-staging-insights`
7. Backend App Service: `scheduler-backend-staging`
8. Frontend App Service: `scheduler-frontend-staging`

### Prerequisites

- Azure CLI installed and configured
- Logged in to Azure (`az login`)
- Appropriate permissions to create resources

### Output

The script outputs:
- Resource names and URLs
- Connection strings for database, Redis, storage
- Application Insights connection string
- Next steps for configuration

**Important:** Save all connection strings securely. They will be needed for App Service configuration.

## Next Steps After Running

1. Configure App Service environment variables (see `docs/DEPLOYMENT.md`)
2. Build and push Docker images
3. Deploy to App Services
4. Run database migrations
5. Verify deployment
