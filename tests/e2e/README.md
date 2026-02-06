# Phase 13: Production-Grade E2E Test Suite

## Overview

This directory contains a comprehensive, tiered End-to-End (E2E) test suite using Playwright for the Construction Scheduling Application. The suite is organized into three tiers based on priority and execution frequency.

## Test Structure

### Tier 1: Core Critical Paths (Smoke Suite)
**Priority:** Immediate  
**Goal:** Prevent broken "plumbing" in Login/Import/Export  
**Browsers:** Chromium, WebKit  
**Location:** `specs/tier1-smoke.spec.ts`

**Tests:**
- Full workflow: Login → Import XER → Update Activity → Verify CPM → Export PDF
- Gantt chart rendering verification
- Activity update handling

### Tier 2: GUID Persistence & Offline Integrity (Anti-Planera Suite)
**Priority:** Critical  
**Goal:** Prove field data survives P6 re-imports (GUID mapping)  
**Browsers:** Chromium, Mobile Chrome  
**Location:** `specs/tier2-guid-persistence.spec.ts`

**Tests:**
- Offline sync with attachment preservation
- GUID persistence across XER re-imports
- 44x44px touch target verification on mobile

### Tier 3: Security & Performance (Vulnerability Suite)
**Priority:** Beta-Gate  
**Goal:** Ensure Procore-style RBAC protects the Master Schedule  
**Browsers:** Chromium only  
**Location:** `specs/tier3-security-performance.spec.ts`

**Tests:**
- RBAC enforcement (new_user redirect)
- Load performance (1000+ activities)
- API response time verification

### Visual Regression Tests
**Location:** `specs/visual-regression.spec.ts`

**Tests:**
- Gantt chart screenshot comparison
- Activity card screenshot comparison
- Pending assignment landing page screenshot

## Test Infrastructure

### Page Object Models (POM)
Located in `pages/`:
- `LoginPage.ts` - Authentication flows
- `ScheduleDetailPage.ts` - Schedule management, CPM verification, import/export
- `LookaheadViewPage.ts` - Lookahead workflows, offline sync, attachments
- `PendingAssignmentPage.ts` - New user landing screen
- `SchedulePage.ts` - Schedule list operations
- `LookaheadPage.ts` - Legacy lookahead operations
- `DashboardPage.ts` - Dashboard interactions
- `ApprovalPage.ts` - Approval workflow

### Test Data Factories
Located in `fixtures/`:
- `ScheduleFactory.ts` - Create schedules with activities, relationships, baselines
- `UserFactory.ts` - Create users with various roles (new_user, field_crew, scheduler, etc.)

### Helpers
Located in `helpers/`:
- `testData.ts` - Database setup/teardown utilities

## Running Tests

### Run All Tests
```bash
pnpm exec playwright test
```

### Run Specific Tier
```bash
# Tier 1 (Smoke)
pnpm exec playwright test tests/e2e/specs/tier1-smoke.spec.ts

# Tier 2 (GUID Persistence)
pnpm exec playwright test tests/e2e/specs/tier2-guid-persistence.spec.ts

# Tier 3 (Security & Performance)
pnpm exec playwright test tests/e2e/specs/tier3-security-performance.spec.ts
```

### Run on Specific Browser
```bash
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=webkit
pnpm exec playwright test --project="Mobile Chrome"
```

### Run Visual Regression Tests
```bash
pnpm exec playwright test tests/e2e/specs/visual-regression.spec.ts
```

### Update Screenshots
```bash
pnpm exec playwright test --update-snapshots
```

### Run in UI Mode
```bash
pnpm exec playwright test --ui
```

## CI/CD Integration

Tests run automatically on:
- Push to `main`, `phase-10-beta-readiness`, or `phase-13-e2e` branches
- Pull requests to `main` or `phase-10-beta-readiness`
- Manual workflow dispatch

**Workflow:** `.github/workflows/e2e-tests.yml`

**Test Execution:**
- Tier 1: Runs on Chromium and WebKit (parallel)
- Tier 2: Runs on Chromium and Mobile Chrome (parallel)
- Tier 3: Runs on Chromium only
- Visual Regression: Runs on Chromium only

## Test Data Management

### Database Setup
Tests use a separate test database (`scheduler_test`) to avoid conflicts with development data.

**Environment Variables:**
- `TEST_DATABASE_URL` - PostgreSQL connection string for test database
- `TEST_REDIS_URL` - Redis connection string for test database
- `JWT_SECRET` - JWT secret for test authentication

### Test Isolation
Each test suite:
1. Creates fresh test data in `beforeAll`
2. Cleans up all data in `afterAll`
3. Uses unique identifiers (timestamps, random strings) to avoid conflicts

## Key Test Scenarios

### CPM Verification
Tests verify that Retained Logic CPM calculations work correctly:
- Activity duration updates trigger CPM recalculation
- Critical path is correctly identified
- Finish dates update based on predecessor relationships

### GUID Persistence
Tests verify the "Anti-Planera" import resilience:
- Field attachments (photos, notes) remain linked via `persistentInternalGuid`
- Offline changes sync correctly
- Re-importing XER with different external IDs preserves field data

### RBAC Enforcement
Tests verify security boundaries:
- `new_user` role redirects to pending assignment page
- `new_user` cannot access project data
- Authorized users can access their assigned projects

### Performance
Tests verify application performance:
- Gantt chart renders smoothly with 1000+ activities
- API responses complete within 500ms
- Page remains interactive during large data loads

## Critical Path Tests (Legacy)

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

## Best Practices

1. **Use Page Object Models** - Encapsulate selectors and actions in POM classes
2. **Use Test Factories** - Create test data programmatically using factories
3. **Verify Touch Targets** - Mobile tests verify 44x44px minimum touch targets
4. **Wait for Network Idle** - Use `waitForLoadState('networkidle')` after navigation
5. **Clean Up Test Data** - Always clean up in `afterAll` hooks
6. **Use Meaningful Assertions** - Verify business logic, not just UI presence

## Troubleshooting

### Tests Failing Locally
1. Ensure test database is running: `docker-compose up -d postgres redis`
2. Run migrations: `cd backend && pnpm prisma migrate deploy`
3. Check environment variables match test configuration

### Visual Regression Failures
1. Review screenshot diffs in `test-results/`
2. If change is intentional, update baseline: `pnpm exec playwright test --update-snapshots`
3. Check viewport size matches expected (1280x720 default)

### Flaky Tests
1. Add explicit waits for async operations
2. Use `waitForLoadState('networkidle')` after navigation
3. Increase timeout for slow operations
4. Check for race conditions in test data setup

## Next Steps

- [ ] Add more visual regression tests for all major screens
- [ ] Expand Tier 2 tests to cover more offline scenarios
- [ ] Add performance benchmarks for different schedule sizes
- [ ] Create test data seed scripts for manual testing
- [ ] Document test coverage metrics
