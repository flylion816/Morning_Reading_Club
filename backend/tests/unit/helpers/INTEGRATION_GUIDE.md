# Mock Helpers Integration Guide

Guide for refactoring existing controller tests to use the mock helpers library, reducing boilerplate code and improving maintainability.

## Before and After Comparison

### Before: Manual Mock Setup (Duplicated Code)

```javascript
// ❌ payment.controller.test.js - duplicated chain setup
const mockQuery = {
  populate: sandbox.stub().returnsThis(),
  exec: sandbox.stub().resolves(mockPayment)
};
mockQuery.then = function (onFulfilled, onRejected) {
  return mockQuery.exec().then(onFulfilled, onRejected);
};
PaymentStub.findOne.returns(mockQuery);

// ❌ Repeated again in another test
const mockQuery2 = {
  populate: sandbox.stub().returnsThis(),
  exec: sandbox.stub().resolves(null)
};
mockQuery2.then = function (onFulfilled, onRejected) {
  return mockQuery2.exec().then(onFulfilled, onRejected);
};
PaymentStub.findOne.returns(mockQuery2);

// ❌ And again in response mock
res = {
  status: sandbox.stub().returnsThis(),
  json: sandbox.stub().returnsThis(),
  send: sandbox.stub().returnsThis()
};
```

**Problems:**
- 15+ lines of boilerplate per mock
- Easy to miss methods (forgot `lean()`?)
- Inconsistent patterns across tests
- Hard to maintain when patterns change

---

### After: Using Mock Helpers (Clean Code)

```javascript
// ✅ payment.controller.test.js - using helpers
const {
  setupFindOneChain,
  createMockResponse
} = require('../helpers/mock-helpers');

beforeEach(() => {
  sandbox = sinon.createSandbox();
  res = createMockResponse(sandbox);
});

// First test
const chain1 = setupFindOneChain(sandbox, mockPayment);
PaymentStub.findOne.returns(chain1);

// Second test
const chain2 = setupFindOneChain(sandbox, null);
PaymentStub.findOne.returns(chain2);
```

**Benefits:**
- ✅ 1-2 lines per mock instead of 15+
- ✅ All methods included automatically
- ✅ Consistent pattern across all tests
- ✅ Easy to update when patterns change

**Result: ~60% reduction in test boilerplate code** 📉

---

## Step-by-Step Integration

### Step 1: Import Helpers at Top of Test File

```javascript
// Add this import
const {
  setupFindChain,
  setupFindByIdChain,
  setupPopulateChain,
  setupAggregateChain,
  createMockResponse,
  createMockNotificationService,
  createMockPublishSyncEvent,
  createMockLogger
} = require('../helpers/mock-helpers');
```

### Step 2: Replace Response Mock Creation

**Before:**
```javascript
res = {
  status: sandbox.stub().returnsThis(),
  json: sandbox.stub().returnsThis(),
  send: sandbox.stub().returnsThis()
};
```

**After:**
```javascript
res = createMockResponse(sandbox);
```

### Step 3: Replace Query Chain Mocks

**Before:**
```javascript
// Find chain
const findChain = {
  populate: sandbox.stub().returnsThis(),
  sort: sandbox.stub().returnsThis(),
  skip: sandbox.stub().returnsThis(),
  limit: sandbox.stub().returnsThis(),
  lean: sandbox.stub().returnsThis(),
  exec: sandbox.stub().resolves(mockUsers)
};
findChain.then = function(onFulfilled, onRejected) {
  return this.exec().then(onFulfilled, onRejected);
};
UserModel.find.returns(findChain);
```

**After:**
```javascript
const findChain = setupFindChain(sandbox, mockUsers);
UserModel.find.returns(findChain);
```

### Step 4: Replace FindById Mocks

**Before:**
```javascript
const findByIdChain = {
  populate: sandbox.stub().returnsThis(),
  select: sandbox.stub().returnsThis(),
  lean: sandbox.stub().returnsThis(),
  exec: sandbox.stub().resolves(mockUser)
};
findByIdChain.then = function(onFulfilled, onRejected) {
  return this.exec().then(onFulfilled, onRejected);
};
UserModel.findById.returns(findByIdChain);
```

**After:**
```javascript
const findByIdChain = setupFindByIdChain(sandbox, mockUser);
UserModel.findById.returns(findByIdChain);
```

### Step 5: Replace Aggregation Mocks

**Before:**
```javascript
const aggChain = {
  match: sandbox.stub().returnsThis(),
  group: sandbox.stub().returnsThis(),
  sort: sandbox.stub().returnsThis(),
  skip: sandbox.stub().returnsThis(),
  limit: sandbox.stub().returnsThis(),
  exec: sandbox.stub().resolves(mockAggResult)
};
aggChain.then = function(onFulfilled, onRejected) {
  return this.exec().then(onFulfilled, onRejected);
};
CheckinModel.aggregate.returns(aggChain);
```

**After:**
```javascript
const aggChain = setupAggregateChain(
  sandbox,
  ['$match', '$group', '$sort'],
  mockAggResult
);
CheckinModel.aggregate.returns(aggChain);
```

### Step 6: Replace Service Mocks

**Before:**
```javascript
notificationServiceStub = {
  createNotification: sandbox.stub().resolves(),
  createNotifications: sandbox.stub().resolves()
};
```

**After:**
```javascript
notificationServiceStub = createMockNotificationService(sandbox);
```

---

## Real Example: Refactoring payment.controller.test.js

### Original Code (Payment Controller Test)

```javascript
describe('Payment Controller', () => {
  let sandbox;
  let req, res;
  let PaymentStub, UserStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      user: { userId: 'user123' },
      params: {},
      body: {}
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis(),
      send: sandbox.stub().returnsThis()
    };

    PaymentStub = {
      findOne: sandbox.stub(),
      findById: sandbox.stub(),
      create: sandbox.stub()
    };

    UserStub = {
      findById: sandbox.stub()
    };
  });

  describe('getPaymentStatus', () => {
    it('should return payment status when found', async () => {
      const mockPayment = {
        _id: 'payment123',
        enrollmentId: { name: 'Enrollment 1' },
        periodId: { name: 'Period 1' }
      };

      // ❌ Manual mock chain
      const mockQuery = {
        populate: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(mockPayment)
      };
      mockQuery.then = function (onFulfilled, onRejected) {
        return mockQuery.exec().then(onFulfilled, onRejected);
      };
      PaymentStub.findOne.returns(mockQuery);

      await paymentController.getPaymentStatus(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('should return 404 when payment not found', async () => {
      // ❌ Duplicated manual mock chain
      const mockQuery = {
        populate: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(null)
      };
      mockQuery.then = function (onFulfilled, onRejected) {
        return mockQuery.exec().then(onFulfilled, onRejected);
      };
      PaymentStub.findOne.returns(mockQuery);

      await paymentController.getPaymentStatus(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });
});
```

### Refactored Code (Using Helpers)

```javascript
const {
  setupFindOneChain,
  createMockResponse
} = require('../helpers/mock-helpers');

describe('Payment Controller', () => {
  let sandbox;
  let req, res;
  let PaymentStub, UserStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      user: { userId: 'user123' },
      params: {},
      body: {}
    };

    // ✅ Using helper instead of manual mock
    res = createMockResponse(sandbox);

    PaymentStub = {
      findOne: sandbox.stub(),
      findById: sandbox.stub(),
      create: sandbox.stub()
    };

    UserStub = {
      findById: sandbox.stub()
    };
  });

  describe('getPaymentStatus', () => {
    it('should return payment status when found', async () => {
      const mockPayment = {
        _id: 'payment123',
        enrollmentId: { name: 'Enrollment 1' },
        periodId: { name: 'Period 1' }
      };

      // ✅ Using helper - just 1 line instead of 8
      const chain = setupFindOneChain(sandbox, mockPayment);
      PaymentStub.findOne.returns(chain);

      await paymentController.getPaymentStatus(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('should return 404 when payment not found', async () => {
      // ✅ Using helper - clean and consistent
      const chain = setupFindOneChain(sandbox, null);
      PaymentStub.findOne.returns(chain);

      await paymentController.getPaymentStatus(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });
});
```

**Changes Made:**
- ✅ Added 1 line import at top
- ✅ Replaced manual `res` mock with `createMockResponse()`
- ✅ Replaced 8 lines of manual chain mocks with 1-line helper calls
- ✅ Removed duplicated mock chain code
- ✅ Added consistency to response mock

**Code Reduction:**
- Before: 24 lines of setup + boilerplate per test file
- After: 8 lines of setup + 1 line per mock
- **Savings: ~70% of boilerplate code**

---

## Common Migration Patterns

### Pattern 1: Find with Populate

**Find:**
```javascript
Model.find().populate('field1').populate('field2').exec()
```

**Use:**
```javascript
const chain = setupFindChain(sandbox, mockData);
Model.find.returns(chain);
```

### Pattern 2: FindById with Populate

**Find:**
```javascript
Model.findById(id).populate('field').select('f1 f2').exec()
```

**Use:**
```javascript
const chain = setupFindByIdChain(sandbox, mockDoc);
Model.findById.returns(chain);
```

### Pattern 3: Multiple Populates

**Find:**
```javascript
Model.findById(id).populate('u1').populate('u2').populate('u3').exec()
```

**Use:**
```javascript
const chain = setupPopulateChain(sandbox, ['u1', 'u2', 'u3'], mockDoc);
Model.findById.returns(chain);
```

### Pattern 4: Complex Aggregation

**Find:**
```javascript
Model.aggregate([...])
  .match({...})
  .group({...})
  .sort({...})
  .skip(10)
  .limit(20)
  .exec()
```

**Use:**
```javascript
const chain = setupAggregateChain(sandbox, [...stages], mockResult);
Model.aggregate.returns(chain);
```

### Pattern 5: Response with Chaining

**Find:**
```javascript
res.status(200).json({...});
res.status(404).send('Not found');
```

**Use:**
```javascript
const res = createMockResponse(sandbox);
res.status(200).json({...});
res.status(404).send('Not found');
```

---

## Controller Tests to Refactor (Priority Order)

Listed by number of lines that can be saved:

| File | Est. Savings | Pattern |
|------|-------------|---------|
| `insight.controller.test.js` | ~200 lines | find/findById/populate/agg |
| `checkin.controller.test.js` | ~150 lines | find/findById/agg |
| `payment.controller.test.js` | ~80 lines | findOne/findById |
| `ranking.controller.test.js` | ~60 lines | agg/find |
| `user.controller.test.js` | ~50 lines | findById |
| `period.controller.test.js` | ~40 lines | find/findById |
| `admin.controller.test.js` | ~40 lines | find/aggregate |
| `enrollment.controller.test.js` | ~35 lines | findById |

---

## Testing Your Refactored Tests

After refactoring, verify:

1. **Tests still pass:**
   ```bash
   npm test -- tests/unit/controllers/your-controller.test.js
   ```

2. **Mock methods still tracked:**
   ```javascript
   expect(Model.find.called).to.be.true;
   expect(res.status.calledWith(200)).to.be.true;
   ```

3. **Promise chains work:**
   ```javascript
   // Both should work
   await Model.find().exec();
   await Model.find().then(result => { /* ... */ });
   ```

---

## Troubleshooting

### Issue: "populate is not a function"

**Problem:** Trying to call methods on the resolved value instead of the chain.

**Wrong:**
```javascript
const result = await setupFindChain(sandbox, mockData).exec();
result.populate('field'); // ❌ Error: result is an array, not a chain
```

**Right:**
```javascript
const chain = setupFindChain(sandbox, mockData);
const result = await chain.populate('field').exec();
```

### Issue: "Expected method to be called once"

**Problem:** Returned chain is not used for mocking.

**Wrong:**
```javascript
const chain = setupFindByIdChain(sandbox, mockUser);
// Forgot to assign to model!
// Model.findById.returns(chain);
```

**Right:**
```javascript
const chain = setupFindByIdChain(sandbox, mockUser);
Model.findById.returns(chain); // ✅ Now Model.findById returns the chain
```

### Issue: "then is not a function"

**Problem:** Trying to use promise-like syntax on resolved value.

**Wrong:**
```javascript
const result = await setupFindChain(sandbox, mockData);
// result.then(...) ❌ Error: result is the resolved data
```

**Right:**
```javascript
const chain = setupFindChain(sandbox, mockData);
const result = await chain.then(data => { /* ... */ });
```

---

## Next Steps

1. ✅ Review the mock helpers: `backend/tests/unit/helpers/mock-helpers.js`
2. ✅ Read the full documentation: `backend/tests/unit/helpers/README.md`
3. ✅ Run the helper tests to verify they work: `npm test -- tests/unit/helpers/mock-helpers.test.js`
4. 🔄 Start refactoring existing controller tests (start with `insight.controller.test.js`)
5. 📝 Update team documentation once all tests are refactored

---

## Quick Reference

| Old Code | New Code | Saves |
|----------|----------|-------|
| `15 lines of chain mock` | `const chain = setupFindChain(sandbox, data);` | 14 lines |
| `12 lines of response mock` | `const res = createMockResponse(sandbox);` | 11 lines |
| `10 lines of service mock` | `const service = createMockNotificationService(sandbox);` | 9 lines |

**Total savings per 25-test file: ~300 lines of boilerplate** 📉

---

**Last Updated:** 2026-03-03
**Status:** Ready for Implementation ✅
