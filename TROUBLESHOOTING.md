# Troubleshooting Guide

Common issues and solutions for the Construction Scheduling Application.

## Backend Connection Refused

### Symptoms
- `ERR_CONNECTION_REFUSED` when trying to login
- Frontend can't reach backend API

### Solutions

#### 1. Start the Backend Server

The backend must be running before the frontend can connect.

**Option A: Start both services together**
```bash
# From project root
pnpm dev
```

**Option B: Start services separately**
```bash
# Terminal 1: Start backend
pnpm dev:backend
# Should see: "🚀 Server running on port 4000"

# Terminal 2: Start frontend
pnpm dev:frontend
# Should see: "Local: http://localhost:5173"
```

#### 2. Verify Backend is Running

Check if backend is listening:
```bash
curl http://localhost:4000/health
# Should return: {"status":"ok","timestamp":"..."}
```

#### 3. Check Port Configuration

**Backend default port:** 4000
**Frontend expects:** Set via `VITE_API_URL` or defaults to `http://localhost:4000/api/v1`

If you need to change the backend port:
```bash
# Set environment variable
PORT=3001 pnpm dev:backend
```

Then update frontend `.env`:
```env
VITE_API_URL=http://localhost:3001/api/v1
```

#### 4. Check Database Connection

Backend requires PostgreSQL and Redis to be running.

**Start infrastructure:**
```bash
pnpm docker:up
```

**Verify database:**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check if Redis is running
docker ps | grep redis
```

#### 5. Check Backend Logs

Look for errors in backend console:
- Database connection errors
- Redis connection errors
- Port already in use errors

## Application Insights Disabled in Development

### Symptoms
- Console message: "Application Insights disabled (development mode)"

### Explanation
This is **expected behavior**. Application Insights is automatically disabled in development mode to:
- Avoid sending test data to Azure
- Reduce costs
- Improve development performance

### To Enable in Development (Optional)

**Backend:**
```env
ENABLE_INSIGHTS=true
APPLICATIONINSIGHTS_CONNECTION_STRING=your-connection-string
```

**Frontend:**
```env
VITE_APPINSIGHTS_KEY=your-instrumentation-key
```

## Port Already in Use

### Symptoms
- Backend fails to start
- Error: "EADDRINUSE: address already in use"

### Solutions

#### 1. Find and Kill Process
```bash
# Find process using port 4000
lsof -i :4000

# Kill the process (replace PID with actual process ID)
kill -9 <PID>
```

#### 2. Use Different Port
```bash
PORT=4001 pnpm dev:backend
```

Update frontend `.env`:
```env
VITE_API_URL=http://localhost:4001/api/v1
```

## Database Connection Errors

### Symptoms
- Backend starts but can't connect to database
- Errors in backend logs about PostgreSQL

### Solutions

#### 1. Start Docker Services
```bash
pnpm docker:up
```

#### 2. Check Database URL
Verify `.env` file in `backend/` directory:
```env
DATABASE_URL=postgresql://scheduler:scheduler_dev_password@localhost:5432/scheduler
```

#### 3. Run Migrations
```bash
cd backend
pnpm db:migrate
```

#### 4. Verify Database is Running
```bash
docker ps | grep postgres
# Should show postgres container running
```

## CORS Errors

### Symptoms
- Browser console shows CORS errors
- Frontend can't make API requests

### Solutions

#### 1. Check FRONTEND_URL in Backend
Backend `.env` should have:
```env
FRONTEND_URL=http://localhost:5173
```

#### 2. Verify CORS Configuration
Backend allows requests from `FRONTEND_URL`. Make sure it matches your frontend URL.

## Frontend Build Errors

### Symptoms
- `pnpm build` fails
- TypeScript errors
- Missing dependencies

### Solutions

#### 1. Install Dependencies
```bash
pnpm install
```

#### 2. Check TypeScript Errors
```bash
cd frontend
pnpm build
# Fix any TypeScript errors shown
```

#### 3. Clear Cache and Rebuild
```bash
cd frontend
rm -rf node_modules dist
pnpm install
pnpm build
```

## Environment Variables Not Loading

### Symptoms
- API calls fail
- Wrong URLs being used
- Missing configuration

### Solutions

#### 1. Check .env File Location
- Backend: `backend/.env`
- Frontend: `frontend/.env` (or root `.env`)

#### 2. Restart Dev Server
Environment variables are loaded at startup. Restart after changing:
```bash
# Stop server (Ctrl+C)
# Start again
pnpm dev
```

#### 3. Verify Variable Names
- Backend: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, etc.
- Frontend: Must be prefixed with `VITE_` (e.g., `VITE_API_URL`)

## Quick Health Check

Run these commands to verify everything is working:

```bash
# 1. Check Docker services
docker ps
# Should show: postgres, redis

# 2. Check backend health
curl http://localhost:4000/health
# Should return: {"status":"ok",...}

# 3. Check frontend
curl http://localhost:5173
# Should return HTML

# 4. Check database connection
cd backend
pnpm db:studio
# Should open Prisma Studio
```

## Getting Help

If issues persist:
1. Check backend logs for detailed error messages
2. Check browser console for frontend errors
3. Verify all environment variables are set correctly
4. Ensure Docker services are running
5. Review relevant documentation:
   - `docs/DEPLOYMENT.md` - Deployment guide
   - `docs/MONITORING.md` - Monitoring setup
   - `README.md` - General setup
