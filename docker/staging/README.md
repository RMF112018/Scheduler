# Local Staging Environment

This directory contains the Docker Compose configuration for local staging testing before deploying to Azure.

## Quick Start

1. **Copy environment variables:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file** with your configuration:
   - Database credentials
   - JWT secrets
   - SMTP settings (optional for testing)
   - Azure Storage connection string (optional for testing)

3. **Start services:**
   ```bash
   docker compose up -d --build
   ```

4. **Run test script:**
   ```bash
   ../../scripts/test-staging-local.sh
   ```

5. **Access the application:**
   - Frontend: http://localhost
   - Backend API: http://localhost:4000
   - Backend Health: http://localhost:4000/health

## Services

- **backend**: Node.js backend API (port 4000)
- **frontend**: Nginx serving React frontend (port 80)
- **postgres**: PostgreSQL database (port 5432)
- **redis**: Redis cache (port 6379)

## Database Setup

After starting services, run migrations:

```bash
# From project root
cd backend
DATABASE_URL=postgresql://scheduler:your_password@localhost:5432/scheduler_staging \
  pnpm db:migrate
```

Optional: Seed test data:

```bash
DATABASE_URL=postgresql://scheduler:your_password@localhost:5432/scheduler_staging \
  pnpm db:seed
```

## Testing

### Manual Testing

1. Access http://localhost
2. Create a test account (if registration is enabled)
3. Create a test project
4. Test lookahead workflow:
   - Pull lookahead
   - Mark activities as "Will Do"
   - Commit changes
   - Approve (as different user)

### E2E Testing

Run Playwright tests against local staging:

```bash
FRONTEND_URL=http://localhost \
  pnpm test:e2e
```

## Troubleshooting

### Services won't start

1. Check if ports are already in use:
   ```bash
   lsof -i :4000
   lsof -i :80
   lsof -i :5432
   lsof -i :6379
   ```

2. Check logs:
   ```bash
   docker compose logs
   ```

### Backend connection errors

1. Verify database is running:
   ```bash
   docker compose ps postgres
   ```

2. Check database connection:
   ```bash
   docker compose exec postgres psql -U scheduler -d scheduler_staging
   ```

3. Verify DATABASE_URL in .env matches docker-compose settings

### Frontend can't reach backend

1. Check VITE_API_URL in .env
2. Verify backend is running: `curl http://localhost:4000/health`
3. Check CORS settings in backend

### Health checks failing

1. Check container logs:
   ```bash
   docker compose logs backend
   docker compose logs frontend
   ```

2. Manually test health endpoints:
   ```bash
   curl http://localhost:4000/health
   curl http://localhost/health
   ```

## Cleanup

Stop and remove containers:
```bash
docker compose down
```

Stop and remove containers + volumes (⚠️ deletes data):
```bash
docker compose down -v
```

## Next Steps

After local staging is validated:
1. Deploy to Azure using `scripts/azure-setup.sh`
2. Configure App Service environment variables
3. Run database migrations on Azure
4. Verify deployment
5. Run E2E tests against Azure staging
