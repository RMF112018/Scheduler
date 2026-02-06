# Deployment Guide

This guide covers deploying the Construction Scheduling Application to Azure staging and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Azure Resource Setup](#azure-resource-setup)
- [Local Staging Testing](#local-staging-testing)
- [Azure Deployment](#azure-deployment)
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [CI/CD Pipeline](#cicd-pipeline)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Azure account with appropriate permissions
- Azure CLI installed and configured
- Docker installed (for local testing)
- GitHub Actions secrets configured
- Access to Azure Portal

## Azure Resource Setup

### 1. Create Resource Group

```bash
az group create \
  --name scheduler-staging-rg \
  --location eastus
```

### 2. Create App Service Plan

```bash
az appservice plan create \
  --name scheduler-staging-plan \
  --resource-group scheduler-staging-rg \
  --sku B1 \
  --is-linux
```

### 3. Create PostgreSQL Flexible Server

```bash
az postgres flexible-server create \
  --resource-group scheduler-staging-rg \
  --name scheduler-staging-db \
  --location eastus \
  --admin-user scheduler \
  --admin-password <strong-password> \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0
```

**Note:** For production, restrict public access and use private endpoints.

### 4. Create Redis Cache (Optional)

```bash
az redis create \
  --resource-group scheduler-staging-rg \
  --name scheduler-staging-redis \
  --location eastus \
  --sku Basic \
  --vm-size c0
```

### 5. Create Storage Account

```bash
az storage account create \
  --resource-group scheduler-staging-rg \
  --name schedulerstagingstorage \
  --location eastus \
  --sku Standard_LRS
```

### 6. Create Application Insights

```bash
az monitor app-insights component create \
  --app scheduler-staging-insights \
  --location eastus \
  --resource-group scheduler-staging-rg
```

### 7. Create Backend App Service

```bash
az webapp create \
  --resource-group scheduler-staging-rg \
  --plan scheduler-staging-plan \
  --name scheduler-backend-staging \
  --deployment-container-image-name ghcr.io/<org>/scheduler-backend:staging
```

### 8. Create Frontend App Service

```bash
az webapp create \
  --resource-group scheduler-staging-rg \
  --plan scheduler-staging-plan \
  --name scheduler-frontend-staging \
  --deployment-container-image-name ghcr.io/<org>/scheduler-frontend:staging
```

## Local Staging Testing

Before deploying to Azure, test the staging configuration locally:

### 1. Set up environment variables

```bash
cd docker/staging
cp .env.example .env
# Edit .env with your staging values
```

### 2. Start services

```bash
docker-compose up -d
```

### 3. Run database migrations

```bash
cd ../../backend
DATABASE_URL=postgresql://scheduler:password@localhost:5432/scheduler_staging \
  pnpm db:migrate
```

### 4. Seed test data (optional)

```bash
DATABASE_URL=postgresql://scheduler:password@localhost:5432/scheduler_staging \
  pnpm db:seed
```

### 5. Verify services

- Backend: http://localhost:4000/health
- Frontend: http://localhost

## Azure Deployment

### Manual Deployment

#### 1. Build and push Docker images

```bash
# Backend
docker build -t ghcr.io/<org>/scheduler-backend:staging -f backend/Dockerfile .
docker push ghcr.io/<org>/scheduler-backend:staging

# Frontend
docker build -t ghcr.io/<org>/scheduler-frontend:staging -f frontend/Dockerfile .
docker push ghcr.io/<org>/scheduler-frontend:staging
```

#### 2. Update App Service container images

```bash
# Backend
az webapp config container set \
  --name scheduler-backend-staging \
  --resource-group scheduler-staging-rg \
  --docker-custom-image-name ghcr.io/<org>/scheduler-backend:staging

# Frontend
az webapp config container set \
  --name scheduler-frontend-staging \
  --resource-group scheduler-staging-rg \
  --docker-custom-image-name ghcr.io/<org>/scheduler-frontend:staging
```

### Automated Deployment (CI/CD)

The GitHub Actions workflow (`.github/workflows/deploy-staging.yml`) automatically:
1. Builds Docker images on push to `phase-10-beta-readiness` branch
2. Pushes images to GitHub Container Registry
3. Deploys to Azure App Services
4. Verifies deployment health

**Required GitHub Secrets:**
- `AZURE_CREDENTIALS` - Azure service principal credentials (JSON)
- `AZURE_RESOURCE_GROUP` - Resource group name
- `AZURE_BACKEND_APP_NAME` - Backend app service name
- `AZURE_FRONTEND_APP_NAME` - Frontend app service name
- `DOCKER_REGISTRY` - Container registry (e.g., `ghcr.io`)

## Database Setup

### 1. Create database

```bash
az postgres flexible-server db create \
  --resource-group scheduler-staging-rg \
  --server-name scheduler-staging-db \
  --database-name scheduler_staging
```

### 2. Run migrations

```bash
# Get connection string
CONNECTION_STRING=$(az postgres flexible-server show-connection-string \
  --server-name scheduler-staging-db \
  --database-name scheduler_staging \
  --admin-user scheduler \
  --admin-password <password> \
  --query connectionStrings.psql \
  --output tsv)

# Run migrations
cd backend
DATABASE_URL="$CONNECTION_STRING" pnpm db:migrate
```

### 3. Seed test data (optional)

```bash
DATABASE_URL="$CONNECTION_STRING" pnpm db:seed
```

## Environment Configuration

### Backend App Service Settings

Configure application settings in Azure Portal or via CLI:

```bash
az webapp config appsettings set \
  --name scheduler-backend-staging \
  --resource-group scheduler-staging-rg \
  --settings \
    NODE_ENV=staging \
    PORT=4000 \
    DATABASE_URL="<postgres-connection-string>" \
    REDIS_URL="<redis-connection-string>" \
    JWT_SECRET="<strong-secret>" \
    JWT_EXPIRES_IN=15m \
    JWT_REFRESH_SECRET="<strong-secret>" \
    JWT_REFRESH_EXPIRES_IN=7d \
    FRONTEND_URL="https://scheduler-frontend-staging.azurewebsites.net" \
    SMTP_HOST="<smtp-host>" \
    SMTP_PORT=587 \
    SMTP_USER="<smtp-user>" \
    SMTP_PASSWORD="<smtp-password>" \
    SMTP_FROM="noreply@scheduler.com" \
    AZURE_STORAGE_CONNECTION_STRING="<storage-connection-string>" \
    APPLICATIONINSIGHTS_CONNECTION_STRING="<insights-connection-string>" \
    ENABLE_COST_MODULE=false \
    ENABLE_DOCS_MODULE=false \
    ENABLE_RFI_MODULE=false \
    PARTNER_WEBHOOKS=false \
    WEBHOOK_SECRET="<webhook-secret>"
```

### Frontend App Service Settings

```bash
az webapp config appsettings set \
  --name scheduler-frontend-staging \
  --resource-group scheduler-staging-rg \
  --settings \
    VITE_API_URL="https://scheduler-backend-staging.azurewebsites.net/api/v1"
```

### CORS Configuration

Ensure backend allows frontend origin:

```bash
az webapp cors add \
  --name scheduler-backend-staging \
  --resource-group scheduler-staging-rg \
  --allowed-origins "https://scheduler-frontend-staging.azurewebsites.net"
```

## CI/CD Pipeline

The staging deployment pipeline (`.github/workflows/deploy-staging.yml`) runs on:
- Push to `phase-10-beta-readiness` branch
- Manual trigger via `workflow_dispatch`

**Pipeline Steps:**
1. Build backend and frontend Docker images
2. Push images to GitHub Container Registry
3. Deploy backend to Azure App Service
4. Deploy frontend to Azure App Service
5. Verify deployment health

## Verification

### 1. Check backend health

```bash
curl https://scheduler-backend-staging.azurewebsites.net/health
```

Expected response: `{"status":"ok"}`

### 2. Check frontend

```bash
curl https://scheduler-frontend-staging.azurewebsites.net/health
```

Expected response: `healthy`

### 3. Run E2E tests against staging

```bash
FRONTEND_URL=https://scheduler-frontend-staging.azurewebsites.net \
  pnpm test:e2e
```

### 4. Check application logs

```bash
# Backend logs
az webapp log tail \
  --name scheduler-backend-staging \
  --resource-group scheduler-staging-rg

# Frontend logs
az webapp log tail \
  --name scheduler-frontend-staging \
  --resource-group scheduler-staging-rg
```

## Troubleshooting

### Backend won't start

1. Check container logs:
   ```bash
   az webapp log tail --name scheduler-backend-staging --resource-group scheduler-staging-rg
   ```

2. Verify environment variables are set correctly
3. Check database connectivity
4. Verify Redis connectivity

### Database connection errors

1. Check firewall rules allow App Service IPs
2. Verify connection string format
3. Test connection from App Service console:
   ```bash
   az webapp ssh --name scheduler-backend-staging --resource-group scheduler-staging-rg
   ```

### Frontend can't reach backend

1. Verify `VITE_API_URL` is set correctly
2. Check CORS configuration
3. Verify backend is running and accessible
4. Check browser console for errors

### Migration failures

1. Run migrations manually from App Service console
2. Check database permissions
3. Verify connection string
4. Review migration logs

## Security Best Practices

1. **Use Azure Key Vault** for sensitive secrets
2. **Enable HTTPS only** on App Services
3. **Restrict database access** to App Service IPs only
4. **Use managed identities** for Azure resource access
5. **Enable Application Insights** for monitoring
6. **Set up alerts** for errors and performance issues
7. **Regular backups** of database
8. **IP allowlisting** for staging environment

## Cost Optimization

- Use **B1** App Service plan for staging (can scale up for production)
- Use **Burstable B1ms** PostgreSQL tier for staging
- Use **Basic C0** Redis tier for staging
- Enable **auto-shutdown** for non-production environments
- Use **Standard LRS** storage (cheaper than GRS)

## Next Steps

After successful staging deployment:
1. Run full E2E test suite against staging
2. Create beta test accounts
3. Set up monitoring and alerting
4. Prepare beta user onboarding materials
5. Plan controlled rollout
