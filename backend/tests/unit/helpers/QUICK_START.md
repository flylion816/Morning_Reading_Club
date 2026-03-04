# Mock Helpers - Quick Start Guide (2 Minutes)

Get up and running with the mock helpers library in 2 minutes.

## Installation

Already included! Just import:

```javascript
const {
  setupFindChain,
  setupFindByIdChain,
  createMockResponse,
  createMockNotificationService
} = require('../helpers/mock-helpers');
```

## 30-Second Example

```javascript
describe('User Controller', () => {
  let sandbox, res;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    res = createMockResponse(sandbox);
  });

  it('should get user by ID', async () => {
    const mockUser = { _id: '123', name: 'John' };
    const chain = setupFindByIdChain(sandbox, mockUser);
    UserModel.findById.returns(chain);

    await userController.getUserById(
      { params: { userId: '123' } },
      res
    );

    expect(res.json.called).to.be.true;
  });
});
```

## 5 Most Common Helpers

### 1. Mock Find Query

```javascript
const mockUsers = [{ _id: '1', name: 'John' }];
const chain = setupFindChain(sandbox, mockUsers);
UserModel.find.returns(chain);

// Now supports:
await UserModel.find()
  .populate('profile')
  .sort({ name: 1 })
  .skip(10)
  .limit(5)
  .exec();
```

### 2. Mock FindById Query

```javascript
const mockUser = { _id: '123', name: 'John' };
const chain = setupFindByIdChain(sandbox, mockUser);
UserModel.findById.returns(chain);

// Now supports:
await UserModel.findById('123')
  .populate('profile')
  .select('name email')
  .exec();
```

### 3. Mock Response

```javascript
const res = createMockResponse(sandbox);

// All of these work:
res.status(200).json({ data: user });
res.status(404).send('Not found');
res.type('application/json').status(500).json({ error: 'Server error' });

// Verify calls:
expect(res.status.calledWith(200)).to.be.true;
```

### 4. Mock Aggregation Pipeline

```javascript
const mockResult = [
  { _id: 'userId1', count: 15 },
  { _id: 'userId2', count: 10 }
];
const chain = setupAggregateChain(sandbox, ['$match', '$group'], mockResult);
CheckinModel.aggregate.returns(chain);

// Now supports:
await CheckinModel.aggregate([])
  .match({ status: 'active' })
  .group({ _id: '$userId', count: { $sum: 1 } })
  .sort({ count: -1 })
  .exec();
```

### 5. Mock Notification Service

```javascript
const notifService = createMockNotificationService(sandbox);

// Auto-stubs all notification methods:
await notifService.createNotification('userId', 'message');
await notifService.markAsRead('notificationId');

// Verify:
expect(notifService.createNotification.called).to.be.true;
```

## Before vs After

### Before (❌ 12 lines)
```javascript
const mockQuery = {
  populate: sandbox.stub().returnsThis(),
  sort: sandbox.stub().returnsThis(),
  skip: sandbox.stub().returnsThis(),
  limit: sandbox.stub().returnsThis(),
  exec: sandbox.stub().resolves(mockUsers)
};
mockQuery.then = function(onFulfilled, onRejected) {
  return mockQuery.exec().then(onFulfilled, onRejected);
};
UserModel.find.returns(mockQuery);
```

### After (✅ 2 lines)
```javascript
const chain = setupFindChain(sandbox, mockUsers);
UserModel.find.returns(chain);
```

## All Available Helpers

| Helper | What it does |
|--------|-------------|
| `setupFindChain()` | Mock `find()` queries |
| `setupFindByIdChain()` | Mock `findById()` queries |
| `setupFindOneChain()` | Mock `findOne()` queries |
| `setupPopulateChain()` | Mock multiple `populate()` calls |
| `setupAggregateChain()` | Mock aggregation pipelines |
| `setupCountChain()` | Mock `countDocuments()` |
| `createMockResponse()` | Mock Express response object |
| `createMockNotificationService()` | Mock notification service |
| `createMockPublishSyncEvent()` | Mock sync event publisher |
| `createMockLogger()` | Mock logger |

## Common Query Methods

Once you have a chain, these methods are automatically available:

**For find/findById/findOne:**
- `.populate(field)` - Load referenced documents
- `.select(fields)` - Choose specific fields
- `.lean()` - Return plain objects
- `.exec()` - Execute query

**For aggregation:**
- `.match(filter)` - Filter documents
- `.group(groupBy)` - Group documents
- `.sort(order)` - Sort results
- `.skip(n)` - Skip n documents
- `.limit(n)` - Limit to n documents
- `.lookup(options)` - Join collections
- `.project(projection)` - Transform fields
- `.exec()` - Execute pipeline

**For response:**
- `.status(code)` - Set HTTP status
- `.json(data)` - Send JSON
- `.send(data)` - Send response
- `.redirect(url)` - Redirect
- `.set(field, value)` - Set header
- `.type(type)` - Set Content-Type

## Real-World Pattern

```javascript
const {
  setupFindByIdChain,
  setupPopulateChain,
  createMockResponse,
  createMockNotificationService
} = require('../helpers/mock-helpers');

describe('Insight Controller', () => {
  let sandbox, res, notifService;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    res = createMockResponse(sandbox);
    notifService = createMockNotificationService(sandbox);
  });

  it('should create insight with notifications', async () => {
    // Setup model
    const mockInsight = {
      _id: '1',
      userId: { _id: 'u1', name: 'John' },
      periodId: { _id: 'p1', name: 'Period1' }
    };
    InsightModel.create.resolves(mockInsight);

    // Setup controller dependencies
    const chain = setupPopulateChain(
      sandbox,
      ['userId', 'periodId'],
      mockInsight
    );
    InsightModel.findById.returns(chain);

    // Execute
    await insightController.createInsight(
      { user: { userId: 'u1' }, body: { /* ... */ } },
      res
    );

    // Verify
    expect(res.status.calledWith(201)).to.be.true;
    expect(notifService.createNotification.called).to.be.true;
  });
});
```

## Verify Installation

Run the helper tests to confirm everything works:

```bash
npm test -- tests/unit/helpers/mock-helpers.test.js
```

Should see: **✅ 43 passing**

## Next Steps

1. ✅ Import helpers in your test file
2. ✅ Replace manual mock setup with helper calls
3. ✅ Run tests to verify they pass
4. ✅ See code reduction (typically 50-70% less boilerplate)

## Documentation

- **Full API Reference:** `README.md`
- **Integration Guide:** `INTEGRATION_GUIDE.md` (how to refactor existing tests)
- **Tests & Examples:** `mock-helpers.test.js` (43 examples)

## FAQ

**Q: Do I need to install anything?**
A: No! The helpers are already in the codebase. Just import them.

**Q: Why use helpers instead of manual mocks?**
A: Less code duplication, consistency, easier maintenance, and automatic support for all query methods.

**Q: Can I mix helpers with manual mocks?**
A: Yes! Use helpers for common patterns, manual mocks for special cases.

**Q: What if I need a helper that doesn't exist?**
A: Check the [README.md](./README.md) or add a new one following the pattern in `mock-helpers.js`.

---

**Ready to use?** Start with one of the 5 most common helpers above! 🚀
