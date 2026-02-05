# Quick Fix: Login 500 Error

## Immediate Steps

### 1. Restart Frontend Dev Server
The port changes require a restart to take effect:

```bash
# Stop frontend (Ctrl+C)
# Restart
pnpm dev:frontend
```

Or restart both:
```bash
pnpm dev
```

### 2. Check Backend Logs
The 500 error means the backend is running but encountering an error. Check the backend console for the actual error message.

Common causes:
- **Database connection error** - PostgreSQL not running
- **User doesn't exist** - Need to create admin user
- **Missing environment variables** - JWT_SECRET, DATABASE_URL, etc.

### 3. Verify Database is Running
```bash
# Check Docker services
docker ps
# Should show: scheduler-postgres and scheduler-redis

# If not running, start them
pnpm docker:up
```

### 4. Check Database Migrations
```bash
cd backend
pnpm db:migrate
```

### 5. Create Admin User
If no users exist, you need to create one:

**Option A: Use seed script**
```bash
cd backend
pnpm db:seed
```

**Option B: Register via API**
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!",
    "firstName": "Admin",
    "lastName": "User",
    "companyName": "Test Company"
  }'
```

**Option C: Use Prisma Studio**
```bash
cd backend
pnpm db:studio
# Opens browser - create user manually
```

### 6. Check Environment Variables
Verify `backend/.env` has:
```env
DATABASE_URL=postgresql://scheduler:scheduler_dev_password@localhost:5432/scheduler
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

## Debugging the 500 Error

### View Backend Error Details
Check the backend console output. The error handler should show:
- Error message
- Stack trace (in development mode)

### Common 500 Errors

**"Cannot connect to database"**
- Solution: Start PostgreSQL with `pnpm docker:up`

**"JWT_SECRET is not defined"**
- Solution: Add JWT_SECRET to backend/.env

**"User not found" or "Invalid password"**
- Solution: Create a user (see step 5 above)

**"Prisma Client validation error"**
- Solution: Run `pnpm db:generate` in backend directory

## After Fixing

1. **Clear browser cache** (optional but recommended)
2. **Try login again**
3. **Check browser console** for any remaining errors
4. **Check backend logs** for successful login message

## Still Having Issues?

1. Share the **exact error message** from backend console
2. Verify all steps above are completed
3. Check `TROUBLESHOOTING.md` for more detailed help
