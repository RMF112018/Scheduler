# Staging Deployment Test Checklist

This checklist guides you through testing the staging deployment, both locally and on Azure.

## Phase 1: Local Staging Validation

### Prerequisites
- [ ] Docker and Docker Compose installed
- [ ] Ports 80, 4000, 5432, 6379 available
- [ ] Environment variables configured

### Setup
- [ ] Copy `.env.example` to `.env` in `docker/staging/`
- [ ] Edit `.env` with your configuration:
  - [ ] Database credentials
  - [ ] JWT secrets
  - [ ] Redis URL
  - [ ] Frontend URL
  - [ ] SMTP settings (optional)

### Start Services
- [ ] Run `docker compose up -d --build` in `docker/staging/`
- [ ] Wait for services to start (30-60 seconds)
- [ ] Run test script: `../../scripts/test-staging-local.sh`
- [ ] Verify all services show "✓ Healthy"

### Health Checks
- [ ] Backend health: `curl http://localhost:4000/health` returns `{"status":"ok"}`
- [ ] Frontend health: `curl http://localhost/health` returns `healthy`
- [ ] PostgreSQL: `docker compose exec postgres pg_isready` succeeds
- [ ] Redis: `docker compose exec redis redis-cli ping` returns `PONG`

### Database Setup
- [ ] Run migrations:
  ```bash
  cd backend
  DATABASE_URL=postgresql://scheduler:password@localhost:5432/scheduler_staging \
    pnpm db:migrate
  ```
- [ ] (Optional) Seed test data:
  ```bash
  DATABASE_URL=postgresql://scheduler:password@localhost:5432/scheduler_staging \
    pnpm db:seed
  ```

### Functional Testing
- [ ] Access frontend: http://localhost
- [ ] Frontend loads without console errors
- [ ] Login page is accessible
- [ ] Create test account (if registration enabled)
- [ ] Login with test account
- [ ] Create a test project
- [ ] Create a test schedule
- [ ] Import test schedule (XER or XLSX)
- [ ] Create lookahead schedule
- [ ] Pull lookahead activities
- [ ] Mark activity as "Will Do"
- [ ] Commit lookahead changes
- [ ] (As different user) Review and approve
- [ ] Verify approval workflow completes
- [ ] Test attachment upload
- [ ] Test offline mode indicator (if applicable)

### E2E Testing
- [ ] Run Playwright tests against local staging:
  ```bash
  FRONTEND_URL=http://localhost pnpm test:e2e
  ```
- [ ] All critical path tests pass
- [ ] No console errors in browser
- [ ] No network errors in browser

### Logs Review
- [ ] Check backend logs: `docker compose logs backend`
- [ ] No error messages in logs
- [ ] Check frontend logs: `docker compose logs frontend`
- [ ] No error messages in logs

### Cleanup
- [ ] Stop services: `docker compose down`
- [ ] (Optional) Remove volumes: `docker compose down -v`

## Phase 2: Azure Staging Deployment

### Prerequisites
- [ ] Azure account with appropriate permissions
- [ ] Azure CLI installed and configured (`az login`)
- [ ] GitHub Actions secrets configured (for CI/CD)

### Resource Creation
- [ ] Run `./scripts/azure-setup.sh` OR manually create resources
- [ ] Resource group created: `scheduler-staging-rg`
- [ ] App Service Plan created: `scheduler-staging-plan`
- [ ] PostgreSQL server created: `scheduler-staging-db`
- [ ] Redis cache created: `scheduler-staging-redis`
- [ ] Storage account created: `schedulerstagingstorage`
- [ ] Application Insights created: `scheduler-staging-insights`
- [ ] Backend App Service created: `scheduler-backend-staging`
- [ ] Frontend App Service created: `scheduler-frontend-staging`
- [ ] Save all connection strings securely

### Environment Configuration
- [ ] Configure backend App Service settings:
  - [ ] DATABASE_URL (PostgreSQL connection string)
  - [ ] REDIS_URL (Redis connection string)
  - [ ] JWT_SECRET
  - [ ] JWT_REFRESH_SECRET
  - [ ] FRONTEND_URL
  - [ ] AZURE_STORAGE_CONNECTION_STRING
  - [ ] APPLICATIONINSIGHTS_CONNECTION_STRING
  - [ ] All other required environment variables
- [ ] Configure frontend App Service settings:
  - [ ] VITE_API_URL
- [ ] Configure CORS on backend to allow frontend origin

### Database Setup
- [ ] Create database: `scheduler_staging`
- [ ] Run migrations:
  ```bash
  DATABASE_URL="<azure-postgres-connection-string>" \
    cd backend && pnpm db:migrate
  ```
- [ ] (Optional) Seed test data

### CI/CD Deployment
- [ ] Push to `phase-10-beta-readiness` branch
- [ ] GitHub Actions workflow triggers
- [ ] Docker images build successfully
- [ ] Images pushed to container registry
- [ ] Backend deploys to Azure App Service
- [ ] Frontend deploys to Azure App Service
- [ ] Deployment verification passes

### Verification
- [ ] Backend health: `curl https://scheduler-backend-staging.azurewebsites.net/health`
- [ ] Frontend health: `curl https://scheduler-frontend-staging.azurewebsites.net/health`
- [ ] Access frontend: https://scheduler-frontend-staging.azurewebsites.net
- [ ] Frontend loads without errors
- [ ] Login page accessible
- [ ] Can login with test account
- [ ] Basic navigation works

### Functional Testing
- [ ] Create test project
- [ ] Create test schedule
- [ ] Import schedule
- [ ] Create lookahead
- [ ] Pull lookahead activities
- [ ] Mark activity as "Will Do"
- [ ] Commit changes
- [ ] Approve workflow
- [ ] Test attachment upload
- [ ] Verify data persists

### E2E Testing Against Azure
- [ ] Run Playwright tests:
  ```bash
  FRONTEND_URL=https://scheduler-frontend-staging.azurewebsites.net \
    pnpm test:e2e
  ```
- [ ] All critical path tests pass
- [ ] No SSL/CORS errors
- [ ] Network latency acceptable

### Monitoring
- [ ] Check Application Insights for errors
- [ ] Review App Service logs
- [ ] Check database connection pool usage
- [ ] Monitor Redis cache hit rate
- [ ] Check event bus queue depth

### Security
- [ ] HTTPS enabled (automatic with App Service)
- [ ] Database firewall rules configured
- [ ] Storage account access restricted
- [ ] CORS properly configured
- [ ] Environment variables secured (not in code)

## Common Issues & Solutions

### Local Staging Issues

**Services won't start:**
- Check if ports are in use: `lsof -i :4000`
- Check Docker logs: `docker compose logs`
- Verify .env file exists and is configured

**Backend connection errors:**
- Verify DATABASE_URL format
- Check PostgreSQL is running: `docker compose ps postgres`
- Test connection: `docker compose exec postgres psql -U scheduler -d scheduler_staging`

**Frontend can't reach backend:**
- Check VITE_API_URL in .env
- Verify backend is running: `curl http://localhost:4000/health`
- Check CORS settings

### Azure Staging Issues

**Deployment fails:**
- Check GitHub Actions logs
- Verify container registry credentials
- Check App Service configuration

**Backend won't start:**
- Check App Service logs in Azure Portal
- Verify environment variables are set
- Test database connectivity from App Service console
- Check Redis connectivity

**Frontend can't reach backend:**
- Verify VITE_API_URL is set correctly
- Check CORS configuration
- Verify backend is accessible
- Check browser console for errors

**Database connection errors:**
- Verify firewall rules allow App Service IPs
- Check connection string format
- Test connection from App Service console
- Verify database exists

## Success Criteria

### Local Staging
- ✅ All services start without errors
- ✅ Health checks pass
- ✅ Database migrations run successfully
- ✅ Login and basic navigation work
- ✅ Lookahead workflow completes
- ✅ E2E tests pass

### Azure Staging
- ✅ All resources created successfully
- ✅ CI/CD pipeline deploys without errors
- ✅ Health endpoints respond correctly
- ✅ Frontend loads and is accessible
- ✅ Login and basic navigation work
- ✅ E2E tests pass against Azure URL
- ✅ No critical errors in Application Insights

## Next Steps After Successful Testing

1. ✅ Proceed to monitoring setup (Priority 4)
2. ✅ Set up feedback collection (Priority 5)
3. ✅ Create beta user onboarding materials
4. ✅ Plan controlled rollout
