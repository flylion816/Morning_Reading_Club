/**
 * Mock Helper Functions Library for Unit Tests
 *
 * This module provides reusable helper functions for setting up complex
 * Mongoose query chains and common mock patterns used across all controller tests.
 * It reduces code duplication and standardizes mocking patterns.
 *
 * Usage:
 *   const { setupFindChain, createMockResponse } = require('./helpers/mock-helpers');
 *   const mockChain = setupFindChain(sandbox, mockData);
 *   MyModel.find.returns(mockChain);
 */

const sinon = require('sinon');

/**
 * Creates a proper mocked find() chain that supports populate, sort, skip, limit, exec
 *
 * Supports method chaining like:
 *   Model.find().populate('field').sort({...}).skip(10).limit(5).exec()
 *
 * @param {sinon.SinonSandbox} sandbox - Sinon sandbox for creating stubs
 * @param {*} resolveValue - The value that exec() should resolve with
 * @returns {Object} A chainable mock query object with exec() that resolves to resolveValue
 *
 * @example
 * const mockChain = setupFindChain(sandbox, [mockUser1, mockUser2]);
 * UserModel.find.returns(mockChain);
 * const results = await UserModel.find().populate('profile').exec();
 * // results will be [mockUser1, mockUser2]
 */
function setupFindChain(sandbox, resolveValue) {
  const chainableStub = {
    populate: sandbox.stub().returnsThis(),
    select: sandbox.stub().returnsThis(),
    sort: sandbox.stub().returnsThis(),
    skip: sandbox.stub().returnsThis(),
    limit: sandbox.stub().returnsThis(),
    lean: sandbox.stub().returnsThis(),
    exec: sandbox.stub().resolves(resolveValue),
    // Support promise-like behavior for async/await
    then: function(onFulfilled, onRejected) {
      return this.exec().then(onFulfilled, onRejected);
    }
  };
  return chainableStub;
}

/**
 * Creates a proper mocked findById() chain for single document queries
 *
 * Supports method chaining like:
 *   Model.findById(id).populate('user').select('field1 field2').exec()
 *
 * @param {sinon.SinonSandbox} sandbox - Sinon sandbox for creating stubs
 * @param {*} resolveValue - The document that exec() should resolve with
 * @returns {Object} A chainable mock query object with exec() that resolves to resolveValue
 *
 * @example
 * const mockChain = setupFindByIdChain(sandbox, mockUser);
 * UserModel.findById.returns(mockChain);
 * const user = await UserModel.findById(userId).populate('profile').exec();
 * // user will be mockUser
 */
function setupFindByIdChain(sandbox, resolveValue) {
  const chainableStub = {
    populate: sandbox.stub().returnsThis(),
    select: sandbox.stub().returnsThis(),
    lean: sandbox.stub().returnsThis(),
    exec: sandbox.stub().resolves(resolveValue),
    // Support promise-like behavior
    then: function(onFulfilled, onRejected) {
      return this.exec().then(onFulfilled, onRejected);
    }
  };
  return chainableStub;
}

/**
 * Creates a populate() chain with proper stubbing for multiple populate calls
 *
 * Supports chaining multiple populate() calls:
 *   Model.findById(id).populate('userId').populate('periodId').populate('sectionId').exec()
 *
 * @param {sinon.SinonSandbox} sandbox - Sinon sandbox for creating stubs
 * @param {string|string[]} populateFields - Field(s) to be populated (can be single string or array)
 * @param {*} resolveValue - The document that exec() should resolve with
 * @returns {Object} A chainable mock query object supporting multiple populate() calls
 *
 * @example
 * const mockChain = setupPopulateChain(
 *   sandbox,
 *   ['userId', 'periodId', 'sectionId'],
 *   mockInsightWithPopulatedData
 * );
 * InsightModel.findById.returns(mockChain);
 * const insight = await InsightModel.findById(id)
 *   .populate('userId')
 *   .populate('periodId')
 *   .populate('sectionId')
 *   .exec();
 */
function setupPopulateChain(sandbox, populateFields, resolveValue) {
  // Normalize input to always be an array
  const fields = Array.isArray(populateFields) ? populateFields : [populateFields];

  const chainableStub = {
    // Each populate call returns the same stub for chaining
    populate: sandbox.stub().returnsThis(),
    select: sandbox.stub().returnsThis(),
    lean: sandbox.stub().returnsThis(),
    exec: sandbox.stub().resolves(resolveValue),
    then: function(onFulfilled, onRejected) {
      return this.exec().then(onFulfilled, onRejected);
    }
  };

  return chainableStub;
}

/**
 * Creates a proper aggregation pipeline mock
 *
 * Supports method chaining for aggregation pipelines:
 *   Model.aggregate([...stages]).match({...}).group({...}).sort({...}).exec()
 *
 * @param {sinon.SinonSandbox} sandbox - Sinon sandbox for creating stubs
 * @param {string[]|Object[]} pipelineStages - The aggregation pipeline stages (for documentation)
 * @param {*} resolveValue - The aggregation result that exec() should resolve with
 * @returns {Object} A chainable mock aggregation pipeline object
 *
 * @example
 * const mockChain = setupAggregateChain(
 *   sandbox,
 *   ['$match', '$group', '$sort'],
 *   [{ _id: userId, count: 10 }, { _id: userId2, count: 8 }]
 * );
 * UserModel.aggregate.returns(mockChain);
 * const results = await UserModel.aggregate([
 *   { $match: { status: 'active' } },
 *   { $group: { _id: '$userId', count: { $sum: 1 } } },
 *   { $sort: { count: -1 } }
 * ]);
 */
function setupAggregateChain(sandbox, pipelineStages, resolveValue) {
  const chainableStub = {
    match: sandbox.stub().returnsThis(),
    group: sandbox.stub().returnsThis(),
    sort: sandbox.stub().returnsThis(),
    skip: sandbox.stub().returnsThis(),
    limit: sandbox.stub().returnsThis(),
    lookup: sandbox.stub().returnsThis(),
    unwind: sandbox.stub().returnsThis(),
    project: sandbox.stub().returnsThis(),
    facet: sandbox.stub().returnsThis(),
    exec: sandbox.stub().resolves(resolveValue),
    // Support promise-like behavior
    then: function(onFulfilled, onRejected) {
      return this.exec().then(onFulfilled, onRejected);
    }
  };

  return chainableStub;
}

/**
 * Creates a complete HTTP response mock with all necessary methods
 *
 * Sets up a mock response object that:
 * - Chains status().json() and status().send()
 * - Tracks all method calls for assertions
 * - Supports both sync and async patterns
 *
 * @param {sinon.SinonSandbox} sandbox - Sinon sandbox for creating stubs
 * @returns {Object} A complete response mock with status, json, send methods
 *
 * @example
 * const res = createMockResponse(sandbox);
 * res.status(200).json({ message: 'success' });
 * expect(res.status.calledWith(200)).to.be.true;
 * expect(res.json.calledOnce).to.be.true;
 */
function createMockResponse(sandbox) {
  const res = {
    status: sandbox.stub().returnsThis(),
    json: sandbox.stub().returnsThis(),
    send: sandbox.stub().returnsThis(),
    redirect: sandbox.stub().returnsThis(),
    set: sandbox.stub().returnsThis(),
    type: sandbox.stub().returnsThis(),
    cookie: sandbox.stub().returnsThis(),
    clearCookie: sandbox.stub().returnsThis(),
    // Additional headers support
    headers: {},
    locals: {},
    statusCode: 200
  };
  return res;
}

/**
 * Creates a complete notification service mock with proper async handling
 *
 * Sets up a mock that includes:
 * - createNotification() - creates a single notification
 * - createNotifications() - creates multiple notifications
 * - Both resolve to undefined by default
 *
 * @param {sinon.SinonSandbox} sandbox - Sinon sandbox for creating stubs
 * @returns {Object} A notification service mock with async methods
 *
 * @example
 * const notifService = createMockNotificationService(sandbox);
 * await notifService.createNotification(userId, message);
 * expect(notifService.createNotification.called).to.be.true;
 */
function createMockNotificationService(sandbox) {
  const notificationService = {
    createNotification: sandbox.stub().resolves(),
    createNotifications: sandbox.stub().resolves(),
    deleteNotification: sandbox.stub().resolves(),
    deleteNotifications: sandbox.stub().resolves(),
    markAsRead: sandbox.stub().resolves(),
    markAsReadBatch: sandbox.stub().resolves(),
    getNotifications: sandbox.stub().resolves([])
  };
  return notificationService;
}

/**
 * Creates a sync event publisher mock that tracks calls properly
 *
 * Sets up a mock for publishing sync events (used for real-time updates)
 * that:
 * - Tracks each call with its arguments
 * - Provides helper methods to retrieve call information
 * - Resolves successfully by default
 *
 * @param {sinon.SinonSandbox} sandbox - Sinon sandbox for creating stubs
 * @returns {sinon.SinonStub} A stub function that acts as the publishSyncEvent handler
 *
 * @example
 * const publishSync = createMockPublishSyncEvent(sandbox);
 * await publishSync({ type: 'create', collection: 'insights', documentId: '123' });
 * expect(publishSync.calledOnce).to.be.true;
 * const args = publishSync.firstCall.args[0];
 * expect(args.type).to.equal('create');
 */
function createMockPublishSyncEvent(sandbox) {
  const publishSync = sandbox.stub().resolves();
  return publishSync;
}

/**
 * Creates a complete logger mock for testing logging behavior
 *
 * Sets up a mock logger that supports all common logging levels:
 * - debug(), info(), warn(), error()
 * - Each method is a stub that tracks calls
 * - Useful for asserting that errors are logged correctly
 *
 * @param {sinon.SinonSandbox} sandbox - Sinon sandbox for creating stubs
 * @returns {Object} A logger mock with debug, info, warn, error methods
 *
 * @example
 * const logger = createMockLogger(sandbox);
 * logger.error('Something went wrong');
 * expect(logger.error.calledWith('Something went wrong')).to.be.true;
 */
function createMockLogger(sandbox) {
  const logger = {
    debug: sandbox.stub(),
    info: sandbox.stub(),
    warn: sandbox.stub(),
    error: sandbox.stub(),
    log: sandbox.stub()
  };
  return logger;
}

/**
 * Helper function to setup a chainable findOne() query
 *
 * Similar to findById but for findOne() queries with custom conditions:
 *   Model.findOne({ email: 'test@example.com' }).populate('profile').exec()
 *
 * @param {sinon.SinonSandbox} sandbox - Sinon sandbox for creating stubs
 * @param {*} resolveValue - The document that exec() should resolve with
 * @returns {Object} A chainable mock query object
 *
 * @example
 * const mockChain = setupFindOneChain(sandbox, mockUser);
 * UserModel.findOne.returns(mockChain);
 * const user = await UserModel.findOne({ email: 'test@example.com' }).exec();
 */
function setupFindOneChain(sandbox, resolveValue) {
  const chainableStub = {
    populate: sandbox.stub().returnsThis(),
    select: sandbox.stub().returnsThis(),
    lean: sandbox.stub().returnsThis(),
    exec: sandbox.stub().resolves(resolveValue),
    then: function(onFulfilled, onRejected) {
      return this.exec().then(onFulfilled, onRejected);
    }
  };
  return chainableStub;
}

/**
 * Helper function to setup a chainable countDocuments() query
 *
 * For counting documents with optional filtering:
 *   Model.countDocuments({ status: 'active' }).exec()
 *
 * @param {sinon.SinonSandbox} sandbox - Sinon sandbox for creating stubs
 * @param {number} resolveValue - The count that exec() should resolve with
 * @returns {Object} A chainable mock query object
 *
 * @example
 * const mockChain = setupCountChain(sandbox, 42);
 * UserModel.countDocuments.returns(mockChain);
 * const count = await UserModel.countDocuments({ status: 'active' }).exec();
 * // count will be 42
 */
function setupCountChain(sandbox, resolveValue) {
  const chainableStub = {
    exec: sandbox.stub().resolves(resolveValue),
    then: function(onFulfilled, onRejected) {
      return this.exec().then(onFulfilled, onRejected);
    }
  };
  return chainableStub;
}

module.exports = {
  setupFindChain,
  setupFindByIdChain,
  setupFindOneChain,
  setupPopulateChain,
  setupAggregateChain,
  setupCountChain,
  createMockResponse,
  createMockNotificationService,
  createMockPublishSyncEvent,
  createMockLogger
};
