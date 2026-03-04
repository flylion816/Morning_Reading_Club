# Mock Helpers Library

A comprehensive collection of reusable mock helper functions for unit testing. These helpers reduce code duplication and standardize mocking patterns across all controller tests.

## Overview

The mock helpers library provides factory functions for creating properly chained Mongoose query mocks and common mock patterns. Instead of duplicating complex mock setup code in each test file, simply call the appropriate helper function.

**File:** `backend/tests/unit/helpers/mock-helpers.js`
**Tests:** `backend/tests/unit/helpers/mock-helpers.test.js`
**Status:** ✅ 43/43 tests passing

## Quick Start

```javascript
const {
  setupFindChain,
  createMockResponse,
  createMockNotificationService
} = require('../helpers/mock-helpers');

// Setup test
beforeEach(() => {
  sandbox = sinon.createSandbox();
  res = createMockResponse(sandbox);
  const mockData = [{ _id: '1', name: 'User1' }];
  const chain = setupFindChain(sandbox, mockData);
  UserModel.find.returns(chain);
});

// Use in test
it('should find users', async () => {
  const users = await UserModel.find().populate('profile').exec();
  expect(users).to.have.lengthOf(1);
});
```

## Available Helpers

### Query Chain Helpers

#### `setupFindChain(sandbox, resolveValue)`

Creates a chainable `find()` mock that supports populate, sort, skip, limit, and lean.

```javascript
const mockUsers = [{ _id: '1', name: 'John' }, { _id: '2', name: 'Jane' }];
const chain = setupFindChain(sandbox, mockUsers);
UserModel.find.returns(chain);

// Supports chaining
const results = await UserModel.find()
  .populate('profile')
  .sort({ name: 1 })
  .skip(10)
  .limit(5)
  .exec();
```

**Chainable methods:**
- `populate(field)` - Populate references
- `select(fields)` - Select specific fields
- `sort(order)` - Sort results
- `skip(n)` - Skip n documents
- `limit(n)` - Limit to n documents
- `lean()` - Return plain objects
- `exec()` - Execute query and resolve

---

#### `setupFindByIdChain(sandbox, resolveValue)`

Creates a chainable `findById()` mock for single document queries.

```javascript
const mockUser = { _id: '123', name: 'John', email: 'john@example.com' };
const chain = setupFindByIdChain(sandbox, mockUser);
UserModel.findById.returns(chain);

// Supports chaining
const user = await UserModel.findById('123')
  .populate('profile')
  .select('name email')
  .lean()
  .exec();
```

**Returns:** `null` if document not found, otherwise the resolved value

**Chainable methods:**
- `populate(field)` - Populate references
- `select(fields)` - Select specific fields
- `lean()` - Return plain object
- `exec()` - Execute query and resolve

---

#### `setupFindOneChain(sandbox, resolveValue)`

Creates a chainable `findOne()` mock for conditional single document queries.

```javascript
const mockUser = { _id: '123', email: 'john@example.com' };
const chain = setupFindOneChain(sandbox, mockUser);
UserModel.findOne.returns(chain);

// Supports chaining
const user = await UserModel.findOne({ email: 'john@example.com' })
  .populate('profile')
  .select('name email')
  .exec();
```

---

#### `setupPopulateChain(sandbox, populateFields, resolveValue)`

Creates a populate chain that supports multiple `populate()` calls.

```javascript
const mockInsight = {
  _id: '1',
  userId: { _id: 'u1', name: 'User1' },
  periodId: { _id: 'p1', name: 'Period1' },
  sectionId: { _id: 's1', name: 'Section1' }
};
const chain = setupPopulateChain(
  sandbox,
  ['userId', 'periodId', 'sectionId'],
  mockInsight
);
InsightModel.findById.returns(chain);

// Supports multiple populate calls
const insight = await InsightModel.findById(id)
  .populate('userId')
  .populate('periodId')
  .populate('sectionId')
  .exec();
```

**Parameters:**
- `populateFields` - String or array of field names (for documentation)
- `resolveValue` - The document with populated fields

---

#### `setupAggregateChain(sandbox, pipelineStages, resolveValue)`

Creates an aggregation pipeline mock supporting all MongoDB pipeline stages.

```javascript
const mockResult = [
  { _id: 'userId1', totalCheckins: 15 },
  { _id: 'userId2', totalCheckins: 10 }
];
const chain = setupAggregateChain(
  sandbox,
  ['$match', '$group', '$sort'],
  mockResult
);
UserModel.aggregate.returns(chain);

// Supports complex pipelines
const results = await UserModel.aggregate([...])
  .match({ status: 'active' })
  .group({ _id: '$userId', totalCheckins: { $sum: 1 } })
  .sort({ totalCheckins: -1 })
  .skip(20)
  .limit(10)
  .exec();
```

**Chainable methods:**
- `match(condition)` - Filter documents
- `group(groupBy)` - Group documents
- `sort(order)` - Sort results
- `skip(n)` - Skip n documents
- `limit(n)` - Limit to n documents
- `lookup(options)` - Join with another collection
- `unwind(field)` - Deconstruct array fields
- `project(projection)` - Select/transform fields
- `facet(facets)` - Multi-faceted aggregation
- `exec()` - Execute pipeline and resolve

---

#### `setupCountChain(sandbox, resolveValue)`

Creates a `countDocuments()` mock that resolves to a count.

```javascript
const chain = setupCountChain(sandbox, 42);
UserModel.countDocuments.returns(chain);

const count = await UserModel.countDocuments({ status: 'active' }).exec();
// count === 42
```

---

### Mock Object Helpers

#### `createMockResponse(sandbox)`

Creates a complete HTTP response mock with all necessary methods for Express handlers.

```javascript
const res = createMockResponse(sandbox);

// All these chains work
res.status(200).json({ message: 'success' });
res.status(404).send('Not found');
res.status(500).type('application/json').json({ error: 'Server error' });

// Assertions
expect(res.status.calledWith(200)).to.be.true;
expect(res.json.called).to.be.true;
```

**Available methods:**
- `status(code)` - Set HTTP status code
- `json(data)` - Send JSON response
- `send(data)` - Send response
- `redirect(url)` - Redirect to URL
- `set(field, value)` - Set header
- `type(type)` - Set Content-Type
- `cookie(name, value)` - Set cookie
- `clearCookie(name)` - Clear cookie
- `locals` - Local variables object
- `headers` - Response headers

**Example with assertions:**
```javascript
res.status(201).json({ _id: '123', name: 'Created' });

expect(res.status.calledWith(201)).to.be.true;
expect(res.json.calledOnce).to.be.true;
const responseData = res.json.firstCall.args[0];
expect(responseData._id).to.equal('123');
```

---

#### `createMockNotificationService(sandbox)`

Creates a notification service mock with all common notification methods.

```javascript
const notifService = createMockNotificationService(sandbox);

await notifService.createNotification('userId123', 'You have a new message');
await notifService.createNotifications(['u1', 'u2'], 'Broadcast message');
await notifService.markAsRead('notificationId');
await notifService.markAsReadBatch(['id1', 'id2']);

// Verify calls
expect(notifService.createNotification.called).to.be.true;
expect(notifService.createNotifications.callCount).to.equal(1);
```

**Available methods:**
- `createNotification(userId, message)` - Create single notification
- `createNotifications(userIds, message)` - Batch create
- `deleteNotification(id)` - Delete by ID
- `deleteNotifications(ids)` - Batch delete
- `markAsRead(id)` - Mark single as read
- `markAsReadBatch(ids)` - Batch mark as read
- `getNotifications(userId)` - Get user notifications (returns empty array by default)

**Customizing return values:**
```javascript
const notifService = createMockNotificationService(sandbox);
const mockNotifications = [
  { _id: '1', message: 'Notification 1' },
  { _id: '2', message: 'Notification 2' }
];
notifService.getNotifications.resolves(mockNotifications);

const result = await notifService.getNotifications('userId');
// result === mockNotifications
```

---

#### `createMockPublishSyncEvent(sandbox)`

Creates a sync event publisher mock for real-time update events.

```javascript
const publishSync = createMockPublishSyncEvent(sandbox);

await publishSync({
  type: 'create',
  collection: 'insights',
  documentId: '123',
  data: { /* ... */ }
});

// Verify
expect(publishSync.called).to.be.true;
const syncData = publishSync.firstCall.args[0];
expect(syncData.type).to.equal('create');
```

**Tracking calls:**
```javascript
publishSync.call(1, { type: 'create', collection: 'insights' });
publishSync.call(2, { type: 'update', collection: 'users' });
publishSync.call(3, { type: 'delete', collection: 'checkins' });

expect(publishSync.callCount).to.equal(3);
expect(publishSync.firstCall.args[0].type).to.equal('create');
expect(publishSync.secondCall.args[0].type).to.equal('update');
expect(publishSync.thirdCall.args[0].type).to.equal('delete');
```

---

#### `createMockLogger(sandbox)`

Creates a logger mock for testing logging behavior.

```javascript
const logger = createMockLogger(sandbox);

logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warn message');
logger.error('Error occurred');

// Assertions
expect(logger.error.calledWith('Error occurred')).to.be.true;
expect(logger.error.callCount).to.equal(1);
```

**Available methods:**
- `debug(message)` - Log debug level
- `info(message)` - Log info level
- `warn(message)` - Log warn level
- `error(message)` - Log error level
- `log(message)` - Generic log

---

## Real-World Examples

### Example 1: Testing an Insight CRUD Controller

```javascript
const { setupFindByIdChain, setupPopulateChain, createMockResponse } =
  require('../helpers/mock-helpers');

describe('Insight Controller', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  it('should get insight with populated relationships', async () => {
    // Setup mocks
    const mockInsight = {
      _id: new mongoose.Types.ObjectId(),
      userId: { _id: 'u1', name: 'John' },
      periodId: { _id: 'p1', name: 'Period1' },
      content: 'Test insight'
    };

    const chain = setupPopulateChain(
      sandbox,
      ['userId', 'periodId'],
      mockInsight
    );
    InsightModel.findById.returns(chain);

    const res = createMockResponse(sandbox);

    // Execute
    await insightController.getInsight(
      { params: { insightId: mockInsight._id } },
      res
    );

    // Assert
    expect(res.json.called).to.be.true;
    const responseData = res.json.firstCall.args[0].data;
    expect(responseData.userId.name).to.equal('John');
  });
});
```

### Example 2: Testing Aggregation and Statistics

```javascript
const { setupAggregateChain } = require('../helpers/mock-helpers');

describe('Ranking Controller', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  it('should get period ranking with aggregation', async () => {
    const mockRanking = [
      { _id: 'u1', checkinCount: 30, lastCheckinDate: new Date() },
      { _id: 'u2', checkinCount: 25, lastCheckinDate: new Date() }
    ];

    const chain = setupAggregateChain(
      sandbox,
      ['$match', '$group', '$sort'],
      mockRanking
    );
    CheckinModel.aggregate.returns(chain);

    const res = createMockResponse(sandbox);

    // Execute
    await rankingController.getPeriodRanking(
      { params: { periodId: 'p1' } },
      res
    );

    // Assert
    expect(res.json.called).to.be.true;
    const ranking = res.json.firstCall.args[0].data;
    expect(ranking[0].checkinCount).to.equal(30);
  });
});
```

### Example 3: Testing with Notifications and Sync Events

```javascript
const {
  createMockNotificationService,
  createMockPublishSyncEvent
} = require('../helpers/mock-helpers');

describe('Insight Creation with Side Effects', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  it('should create insight and trigger notifications', async () => {
    // Setup mocks
    const notifService = createMockNotificationService(sandbox);
    const publishSync = createMockPublishSyncEvent(sandbox);

    // Mock model
    const mockInsight = { _id: '1', userId: 'u1', content: 'Test' };
    InsightModel.create.resolves(mockInsight);

    // Execute
    await insightController.createInsight(
      { user: { userId: 'u1' }, body: { /* ... */ } },
      {}
    );

    // Assert side effects
    expect(publishSync.called).to.be.true;
    const syncData = publishSync.firstCall.args[0];
    expect(syncData.type).to.equal('create');
    expect(syncData.collection).to.equal('insights');
  });
});
```

---

## Best Practices

### 1. Always Use Helpers for Query Chains

❌ **Avoid duplicating mock setup:**
```javascript
// BAD - Duplicated in many test files
const chain = {
  populate: sandbox.stub().returnsThis(),
  sort: sandbox.stub().returnsThis(),
  skip: sandbox.stub().returnsThis(),
  limit: sandbox.stub().returnsThis(),
  exec: sandbox.stub().resolves(mockData),
  then: function(onFulfilled, onRejected) {
    return this.exec().then(onFulfilled, onRejected);
  }
};
```

✅ **Use helpers instead:**
```javascript
const chain = setupFindChain(sandbox, mockData);
```

### 2. Maintain Consistency Across Tests

All controller tests should use the same mock helpers to ensure consistency:

```javascript
// In every controller test
const res = createMockResponse(sandbox);
const chain = setupFindByIdChain(sandbox, mockData);
const notifService = createMockNotificationService(sandbox);
```

### 3. Test Both Success and Null Cases

```javascript
// Test successful find
const chain = setupFindByIdChain(sandbox, mockUser);
// ... test success case

// Test not found
const chainNull = setupFindByIdChain(sandbox, null);
// ... test not found case
```

### 4. Verify Call Arguments for Assertions

```javascript
const res = createMockResponse(sandbox);
res.status(200).json({ data: results });

// Verify specific calls
expect(res.status.calledWith(200)).to.be.true;
expect(res.json.firstCall.args[0].data).to.deep.equal(results);
```

### 5. Use Aggregation for Complex Queries

```javascript
const chain = setupAggregateChain(
  sandbox,
  ['$match', '$group', '$sort'],
  mockAggregateResult
);
```

---

## Testing the Helpers

Run the helper tests:

```bash
npm test -- tests/unit/helpers/mock-helpers.test.js
```

All 43 tests should pass, covering:
- ✅ All query chain methods
- ✅ Multiple chaining combinations
- ✅ Promise and callback patterns
- ✅ Response mock chaining
- ✅ Service mock async operations
- ✅ Integration scenarios

---

## Adding New Helpers

To add a new helper function:

1. **Identify the pattern** - What mock setup do you keep repeating?
2. **Create the factory function** - Return a properly structured mock object
3. **Add documentation** - JSDoc comments with usage examples
4. **Add tests** - Create corresponding test cases in `mock-helpers.test.js`
5. **Export from module** - Add to `module.exports`

---

## API Reference Summary

| Helper | Purpose | Returns |
|--------|---------|---------|
| `setupFindChain()` | Mock `Model.find()` | Chainable query with exec() |
| `setupFindByIdChain()` | Mock `Model.findById()` | Chainable query with exec() |
| `setupFindOneChain()` | Mock `Model.findOne()` | Chainable query with exec() |
| `setupPopulateChain()` | Mock multiple populate() | Chainable query supporting multiple populates |
| `setupAggregateChain()` | Mock aggregation pipeline | Chainable aggregation with exec() |
| `setupCountChain()` | Mock `Model.countDocuments()` | Chainable count query |
| `createMockResponse()` | Mock HTTP response | Response object with status(), json(), send() |
| `createMockNotificationService()` | Mock notification service | Service with createNotification(), etc. |
| `createMockPublishSyncEvent()` | Mock sync event publisher | Stub function for event publishing |
| `createMockLogger()` | Mock logger | Logger with debug(), info(), warn(), error() |

---

## Contributing

When adding new tests that would benefit from mocking, check if a helper exists before creating custom mocks. If you create custom mocks that could be reused, consider adding them as helpers.

---

**Status:** Production Ready ✅
**Test Coverage:** 43/43 tests passing
**Last Updated:** 2026-03-03
