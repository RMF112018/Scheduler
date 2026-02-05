# E2E Tests

End-to-end tests for the Construction Scheduling Application using Playwright.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

3. Ensure test database and Redis are running:
```bash
# Using Docker Compose
pnpm docker:up
```

## Running Tests

### Run all E2E tests
```bash
pnpm test:e2e
```

### Run tests in UI mode
```bash
pnpm test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
pnpm test:e2e:headed
```

### Run tests in debug mode
```bash
pnpm test:e2e:debug
```

### Run specific test file
```bash
npx playwright test tests/e2e/specs/offline-sync.spec.ts
```

## Test Structure

```
tests/e2e/
├── setup.ts              # Test fixtures and page object setup
├── pages/                # Page Object Models
│   ├── LoginPage.ts
│   ├── LookaheadPage.ts
│   ├── SchedulePage.ts
│   ├── DashboardPage.ts
│   └── ApprovalPage.ts
├── specs/                # Test specifications
│   ├── offline-sync.spec.ts
│   ├── approval-workflow.spec.ts
│   ├── import-export.spec.ts
│   ├── event-bus.spec.ts
│   └── role-landing.spec.ts
├── helpers/              # Test helpers
│   └── testData.ts       # Test data creation utilities
└── fixtures/             # Test fixtures (files, images, etc.)
```

## Critical Path Tests

### 1. Offline Sync → Merge Conflict Resolution
Tests the complete offline sync flow:
- Field crew goes offline
- Makes status changes to lookahead activities
- Returns online
- Sync triggers conflict detection
- User resolves conflicts
- Changes propagate correctly

### 2. Commit → Approval Workflow
Tests the approval workflow:
- Field crew commits lookahead changes
- Attachments uploaded and marked pending
- Superintendent reviews and approves/rejects
- Approved changes merge to master schedule
- Audit logs created

### 3. Import → Variance Export
Tests import/export functionality:
- Import XER/XLSX schedule
- Create baseline
- Update activities (dates, progress)
- Export PDF with variance analysis
- Verify critical path highlighting

### 4. Event Bus Flow
Tests event-driven architecture:
- Activity updated
- Event published to BullMQ
- Audit log created
- Webhook delivered (if subscribed)
- Notification sent

### 5. Role-Based Landing Pages
Smoke tests for role-based routing:
- Field crew → Lookahead view
- Scheduler → Schedule view
- Executive → Dashboard
- Superintendent → Approval queue

## Environment Variables

```env
# Test Database
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/scheduler_test
TEST_REDIS_URL=redis://localhost:6379/1

# JWT
JWT_SECRET=test-jwt-secret-key

# Frontend URL (default: http://localhost:5173)
FRONTEND_URL=http://localhost:5173
```

## Page Object Models

All page interactions are abstracted through Page Object Models (POMs) for maintainability:

- `LoginPage` - Login and authentication
- `LookaheadPage` - Lookahead schedule interactions
- `SchedulePage` - Master schedule management
- `DashboardPage` - Executive dashboard
- `ApprovalPage` - Approval workflow

## Test Data

Test data is created using helper functions in `helpers/testData.ts`:
- `createE2ECompany()` - Create test company
- `createE2EUser()` - Create test user with authentication
- `createE2EProject()` - Create test project
- `createE2ESchedule()` - Create test schedule
- `createE2EActivities()` - Create test activities
- `cleanE2EDatabase()` - Clean up test data

## CI/CD Integration

E2E tests run automatically on:
- Push to `main`, `develop`, or `phase-10-beta-readiness` branches
- Pull requests to `main` or `develop`

Test results and Playwright reports are uploaded as artifacts.

## Debugging

1. **Run in headed mode** to see the browser:
   ```bash
   pnpm test:e2e:headed
   ```

2. **Use debug mode** to step through tests:
   ```bash
   pnpm test:e2e:debug
   ```

3. **Use UI mode** for interactive debugging:
   ```bash
   pnpm test:e2e:ui
   ```

4. **View test traces** after a failed test:
   ```bash
   npx playwright show-trace trace.zip
   ```

## Best Practices

1. **Use Page Object Models** - All page interactions should go through POMs
2. **Wait for network idle** - Use `waitForLoadState('networkidle')` after navigation
3. **Use data-testid attributes** - Prefer `data-testid` over CSS selectors
4. **Clean up test data** - Always clean up in `afterAll` hooks
5. **Use meaningful test names** - Describe what the test validates
6. **Keep tests independent** - Each test should be able to run in isolation
