# Test Helpers Documentation

## Phase 9: Integration Test Utilities

This directory contains test utilities for integration testing, particularly for Phase 9 event-driven architecture.

## Event Bus Test Utilities (`eventBus.ts`)

### `createTestEventQueue()`
Creates a test BullMQ queue for event testing.

### `waitForEvent(queue, eventType, entityId?, timeout?)`
Waits for an event of a specific type to appear in the queue. Useful for verifying events are published correctly.

### `getEventsByType(queue, eventType)`
Retrieves all events of a specific type from the queue.

### `clearTestQueue(queue)`
Clears all events from a test queue.

### `TestEventCollector`
A class that collects events as they are processed. Useful for integration tests that need to verify event processing.

**Example:**
```typescript
const collector = new TestEventCollector('events');
// ... publish events ...
const events = collector.getEventsByType('approval.completed');
expect(events.length).toBe(1);
await collector.close();
```

## Audit Log Test Utilities (`auditLog.ts`)

### `getEntityAuditLogs(entityType, entityId)`
Gets all audit logs for a specific entity.

### `getLatestAuditLog(entityType, entityId)`
Gets the most recent audit log for an entity.

### `verifyAuditLog(entityType, entityId, action, options?)`
Waits for and verifies that an audit log exists for a specific action. Includes timeout support.

### `verifyAuditLogChanges(entityType, entityId, expectedChanges)`
Verifies that specific changes are logged in the audit log.

### `getAuditLogCount(userId, options?)`
Gets the count of audit logs for a user with optional filters.

### `clearAuditLogs()`
Clears all audit logs (for test cleanup).

**Example:**
```typescript
// Verify audit log was created
const auditLog = await verifyAuditLog(
  'Activity',
  activityId,
  'update',
  { userId: user.id, timeout: 3000 }
);
expect(auditLog).toBeDefined();
expect(auditLog?.changes).toBeDefined();
```

## Test Patterns

### Testing Event Flows

1. **Publish Event** → **Wait for Processing** → **Verify Audit Log**
```typescript
await eventBus.publish(event);
const auditLog = await verifyAuditLog('Entity', 'id', 'update', { timeout: 3000 });
expect(auditLog).toBeDefined();
```

2. **Publish Event** → **Wait for Webhook Delivery** → **Verify Webhook Called**
```typescript
const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
global.fetch = fetchMock;
await eventBus.publish(event);
await new Promise(resolve => setTimeout(resolve, 1000));
expect(fetchMock).toHaveBeenCalled();
```

3. **Cross-Module Flow**: **Service Action** → **Event Published** → **Audit Logged** → **Webhook Delivered**
```typescript
// Perform action that triggers event
await workflowController.approve(approvalId);

// Verify event was published
const event = await waitForEvent(queue, 'approval.completed', approvalId);

// Verify audit log
const auditLog = await verifyAuditLog('WorkflowApproval', approvalId, 'update');

// Verify webhook
expect(fetchMock).toHaveBeenCalled();
```

### Testing Webhooks

1. **Create Subscription** → **Publish Event** → **Verify Delivery**
2. **Test Failure Handling** → **Verify Retry Logic**
3. **Test HMAC Signing** → **Verify Signature Header**

### Best Practices

- Always clean up test data in `afterEach`
- Use timeouts when waiting for async operations
- Mock external services (fetch, email, etc.)
- Test both success and failure scenarios
- Verify event ordering when order matters
- Test with multiple subscriptions to verify filtering
