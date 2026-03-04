/**
 * Mock Helpers Library - Unit Tests
 *
 * Comprehensive tests for all mock helper functions to ensure they work correctly
 * in various scenarios.
 */

const { expect } = require('chai');
const sinon = require('sinon');
const {
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
} = require('./mock-helpers');

describe('Mock Helpers Library', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  // ========================================
  // setupFindChain Tests
  // ========================================

  describe('setupFindChain', () => {
    it('should create a chainable find() mock', async () => {
      const mockData = [{ _id: '1', name: 'User1' }, { _id: '2', name: 'User2' }];
      const chain = setupFindChain(sandbox, mockData);

      const result = await chain.populate('profile').sort({ name: 1 }).exec();

      expect(result).to.deep.equal(mockData);
      expect(chain.populate.calledOnce).to.be.true;
      expect(chain.sort.calledOnce).to.be.true;
    });

    it('should support skip and limit chaining', async () => {
      const mockData = [{ _id: '1', name: 'User1' }];
      const chain = setupFindChain(sandbox, mockData);

      const result = await chain.skip(10).limit(5).exec();

      expect(result).to.deep.equal(mockData);
      expect(chain.skip.calledWith(10)).to.be.true;
      expect(chain.limit.calledWith(5)).to.be.true;
    });

    it('should support lean() method', async () => {
      const mockData = { _id: '1', name: 'User1' };
      const chain = setupFindChain(sandbox, mockData);

      const result = await chain.lean().exec();

      expect(result).to.deep.equal(mockData);
      expect(chain.lean.calledOnce).to.be.true;
    });

    it('should work with promise-like then() syntax', (done) => {
      const mockData = [{ _id: '1', name: 'User1' }];
      const chain = setupFindChain(sandbox, mockData);

      chain.then((result) => {
        expect(result).to.deep.equal(mockData);
        done();
      });
    });

    it('should return empty array when resolving empty data', async () => {
      const chain = setupFindChain(sandbox, []);
      const result = await chain.exec();
      expect(result).to.deep.equal([]);
    });
  });

  // ========================================
  // setupFindByIdChain Tests
  // ========================================

  describe('setupFindByIdChain', () => {
    it('should create a chainable findById() mock', async () => {
      const mockUser = { _id: '123', name: 'John', email: 'john@example.com' };
      const chain = setupFindByIdChain(sandbox, mockUser);

      const result = await chain.populate('profile').select('name email').exec();

      expect(result).to.deep.equal(mockUser);
      expect(chain.populate.calledOnce).to.be.true;
      expect(chain.select.calledOnce).to.be.true;
    });

    it('should return null when document not found', async () => {
      const chain = setupFindByIdChain(sandbox, null);
      const result = await chain.exec();
      expect(result).to.be.null;
    });

    it('should support lean() for plain objects', async () => {
      const mockUser = { _id: '123', name: 'John' };
      const chain = setupFindByIdChain(sandbox, mockUser);

      const result = await chain.lean().exec();

      expect(result).to.deep.equal(mockUser);
      expect(chain.lean.calledOnce).to.be.true;
    });

    it('should work with promise-like then() syntax', (done) => {
      const mockUser = { _id: '123', name: 'John' };
      const chain = setupFindByIdChain(sandbox, mockUser);

      chain.then((result) => {
        expect(result).to.deep.equal(mockUser);
        done();
      });
    });
  });

  // ========================================
  // setupFindOneChain Tests
  // ========================================

  describe('setupFindOneChain', () => {
    it('should create a chainable findOne() mock', async () => {
      const mockUser = { _id: '123', email: 'john@example.com' };
      const chain = setupFindOneChain(sandbox, mockUser);

      const result = await chain.populate('profile').exec();

      expect(result).to.deep.equal(mockUser);
      expect(chain.populate.calledOnce).to.be.true;
    });

    it('should return null when no document matches', async () => {
      const chain = setupFindOneChain(sandbox, null);
      const result = await chain.exec();
      expect(result).to.be.null;
    });

    it('should support select and lean together', async () => {
      const mockUser = { _id: '123', name: 'John' };
      const chain = setupFindOneChain(sandbox, mockUser);

      const result = await chain.select('name').lean().exec();

      expect(result).to.deep.equal(mockUser);
      expect(chain.select.calledOnce).to.be.true;
      expect(chain.lean.calledOnce).to.be.true;
    });
  });

  // ========================================
  // setupPopulateChain Tests
  // ========================================

  describe('setupPopulateChain', () => {
    it('should support single populate field as string', async () => {
      const mockData = { _id: '1', userId: { _id: 'u1', name: 'User1' } };
      const chain = setupPopulateChain(sandbox, 'userId', mockData);

      const result = await chain.populate('userId').exec();

      expect(result).to.deep.equal(mockData);
      expect(chain.populate.calledOnce).to.be.true;
    });

    it('should support multiple populate calls', async () => {
      const mockData = {
        _id: '1',
        userId: { _id: 'u1', name: 'User1' },
        periodId: { _id: 'p1', name: 'Period1' }
      };
      const chain = setupPopulateChain(sandbox, ['userId', 'periodId'], mockData);

      const result = await chain
        .populate('userId')
        .populate('periodId')
        .exec();

      expect(result).to.deep.equal(mockData);
      expect(chain.populate.calledTwice).to.be.true;
    });

    it('should support multiple populate fields as array', async () => {
      const mockData = {
        _id: '1',
        userId: { _id: 'u1', name: 'User1' },
        periodId: { _id: 'p1', name: 'Period1' },
        sectionId: { _id: 's1', name: 'Section1' }
      };
      const chain = setupPopulateChain(
        sandbox,
        ['userId', 'periodId', 'sectionId'],
        mockData
      );

      const result = await chain
        .populate('userId')
        .populate('periodId')
        .populate('sectionId')
        .exec();

      expect(result).to.deep.equal(mockData);
      expect(chain.populate.callCount).to.equal(3);
    });

    it('should support select with populate', async () => {
      const mockData = { _id: '1', userId: { _id: 'u1', name: 'User1' } };
      const chain = setupPopulateChain(sandbox, 'userId', mockData);

      const result = await chain.populate('userId').select('userId').exec();

      expect(result).to.deep.equal(mockData);
      expect(chain.select.calledOnce).to.be.true;
    });
  });

  // ========================================
  // setupAggregateChain Tests
  // ========================================

  describe('setupAggregateChain', () => {
    it('should create a chainable aggregation pipeline mock', async () => {
      const mockResult = [
        { _id: 'userId1', totalCheckins: 15 },
        { _id: 'userId2', totalCheckins: 10 }
      ];
      const chain = setupAggregateChain(
        sandbox,
        ['$match', '$group', '$sort'],
        mockResult
      );

      const result = await chain
        .match({ status: 'active' })
        .group({ _id: '$userId', totalCheckins: { $sum: 1 } })
        .sort({ totalCheckins: -1 })
        .exec();

      expect(result).to.deep.equal(mockResult);
      expect(chain.match.calledOnce).to.be.true;
      expect(chain.group.calledOnce).to.be.true;
      expect(chain.sort.calledOnce).to.be.true;
    });

    it('should support skip and limit on aggregation', async () => {
      const mockResult = [{ _id: 'userId1', count: 15 }];
      const chain = setupAggregateChain(sandbox, ['$skip', '$limit'], mockResult);

      const result = await chain.skip(20).limit(10).exec();

      expect(result).to.deep.equal(mockResult);
      expect(chain.skip.calledWith(20)).to.be.true;
      expect(chain.limit.calledWith(10)).to.be.true;
    });

    it('should support lookup for joins', async () => {
      const mockResult = [
        { _id: 'userId1', user: { _id: 'u1', name: 'User1' } }
      ];
      const chain = setupAggregateChain(sandbox, ['$lookup'], mockResult);

      const result = await chain
        .lookup({
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        })
        .exec();

      expect(result).to.deep.equal(mockResult);
      expect(chain.lookup.calledOnce).to.be.true;
    });

    it('should support complex pipelines with multiple stages', async () => {
      const mockResult = [{ _id: null, count: 150 }];
      const chain = setupAggregateChain(sandbox, ['$match', '$group', '$project'], mockResult);

      const result = await chain
        .match({ active: true })
        .group({ _id: null, count: { $sum: 1 } })
        .project({ _id: 1, count: 1 })
        .exec();

      expect(result).to.deep.equal(mockResult);
      expect(chain.match.calledOnce).to.be.true;
      expect(chain.group.calledOnce).to.be.true;
      expect(chain.project.calledOnce).to.be.true;
    });

    it('should work with promise-like then() syntax', (done) => {
      const mockResult = [{ _id: 'user1', count: 10 }];
      const chain = setupAggregateChain(sandbox, [], mockResult);

      chain.then((result) => {
        expect(result).to.deep.equal(mockResult);
        done();
      });
    });
  });

  // ========================================
  // setupCountChain Tests
  // ========================================

  describe('setupCountChain', () => {
    it('should return count from exec()', async () => {
      const chain = setupCountChain(sandbox, 42);
      const result = await chain.exec();
      expect(result).to.equal(42);
    });

    it('should work with promise-like then() syntax', (done) => {
      const chain = setupCountChain(sandbox, 100);

      chain.then((result) => {
        expect(result).to.equal(100);
        done();
      });
    });

    it('should return 0 for no documents', async () => {
      const chain = setupCountChain(sandbox, 0);
      const result = await chain.exec();
      expect(result).to.equal(0);
    });
  });

  // ========================================
  // createMockResponse Tests
  // ========================================

  describe('createMockResponse', () => {
    it('should create a response mock with status().json() chaining', () => {
      const res = createMockResponse(sandbox);

      res.status(200).json({ message: 'success' });

      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
    });

    it('should track all method calls', () => {
      const res = createMockResponse(sandbox);

      res.status(404).send('Not found');

      expect(res.status.calledWith(404)).to.be.true;
      expect(res.send.calledWith('Not found')).to.be.true;
    });

    it('should support multiple chaining patterns', () => {
      const res = createMockResponse(sandbox);

      res.type('application/json').set('Content-Length', '100').status(200).json({});

      expect(res.type.calledWith('application/json')).to.be.true;
      expect(res.set.calledWith('Content-Length', '100')).to.be.true;
      expect(res.status.calledWith(200)).to.be.true;
    });

    it('should support redirect', () => {
      const res = createMockResponse(sandbox);

      res.redirect('/home');

      expect(res.redirect.calledWith('/home')).to.be.true;
    });

    it('should support cookie methods', () => {
      const res = createMockResponse(sandbox);

      res.cookie('session', 'abc123').clearCookie('old');

      expect(res.cookie.calledWith('session', 'abc123')).to.be.true;
      expect(res.clearCookie.calledWith('old')).to.be.true;
    });
  });

  // ========================================
  // createMockNotificationService Tests
  // ========================================

  describe('createMockNotificationService', () => {
    it('should create a notification service mock', async () => {
      const notifService = createMockNotificationService(sandbox);

      await notifService.createNotification('userId123', 'You have a new message');

      expect(notifService.createNotification.calledOnce).to.be.true;
    });

    it('should support batch operations', async () => {
      const notifService = createMockNotificationService(sandbox);

      await notifService.createNotifications(['user1', 'user2'], 'Broadcast message');

      expect(notifService.createNotifications.calledOnce).to.be.true;
    });

    it('should support delete operations', async () => {
      const notifService = createMockNotificationService(sandbox);

      await notifService.deleteNotification('notificationId123');

      expect(notifService.deleteNotification.calledOnce).to.be.true;
    });

    it('should support read status operations', async () => {
      const notifService = createMockNotificationService(sandbox);

      await notifService.markAsRead('notificationId123');
      await notifService.markAsReadBatch(['id1', 'id2']);

      expect(notifService.markAsRead.calledOnce).to.be.true;
      expect(notifService.markAsReadBatch.calledOnce).to.be.true;
    });

    it('should return empty array from getNotifications', async () => {
      const notifService = createMockNotificationService(sandbox);

      const result = await notifService.getNotifications('userId');

      expect(result).to.deep.equal([]);
    });

    it('should allow customizing getNotifications return value', async () => {
      const notifService = createMockNotificationService(sandbox);
      const mockNotifications = [
        { _id: '1', message: 'Notification 1' },
        { _id: '2', message: 'Notification 2' }
      ];
      notifService.getNotifications.resolves(mockNotifications);

      const result = await notifService.getNotifications('userId');

      expect(result).to.deep.equal(mockNotifications);
    });
  });

  // ========================================
  // createMockPublishSyncEvent Tests
  // ========================================

  describe('createMockPublishSyncEvent', () => {
    it('should create a publish sync event stub', async () => {
      const publishSync = createMockPublishSyncEvent(sandbox);

      await publishSync({
        type: 'create',
        collection: 'insights',
        documentId: '123'
      });

      expect(publishSync.calledOnce).to.be.true;
    });

    it('should track call arguments', async () => {
      const publishSync = createMockPublishSyncEvent(sandbox);

      const syncData = {
        type: 'update',
        collection: 'users',
        documentId: 'user123'
      };
      await publishSync(syncData);

      expect(publishSync.firstCall.args[0]).to.deep.equal(syncData);
    });

    it('should track multiple calls', async () => {
      const publishSync = createMockPublishSyncEvent(sandbox);

      await publishSync({ type: 'create', collection: 'insights' });
      await publishSync({ type: 'update', collection: 'users' });
      await publishSync({ type: 'delete', collection: 'checkins' });

      expect(publishSync.callCount).to.equal(3);
      expect(publishSync.secondCall.args[0].type).to.equal('update');
      expect(publishSync.thirdCall.args[0].type).to.equal('delete');
    });
  });

  // ========================================
  // createMockLogger Tests
  // ========================================

  describe('createMockLogger', () => {
    it('should create a logger mock with all levels', () => {
      const logger = createMockLogger(sandbox);

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(logger.debug.calledWith('Debug message')).to.be.true;
      expect(logger.info.calledWith('Info message')).to.be.true;
      expect(logger.warn.calledWith('Warn message')).to.be.true;
      expect(logger.error.calledWith('Error message')).to.be.true;
    });

    it('should track error messages for assertions', () => {
      const logger = createMockLogger(sandbox);

      logger.error('Database connection failed');
      logger.error('Invalid user ID');

      expect(logger.error.callCount).to.equal(2);
      expect(logger.error.firstCall.args[0]).to.equal('Database connection failed');
      expect(logger.error.secondCall.args[0]).to.equal('Invalid user ID');
    });

    it('should support log method', () => {
      const logger = createMockLogger(sandbox);

      logger.log('Generic log message');

      expect(logger.log.calledWith('Generic log message')).to.be.true;
    });
  });

  // ========================================
  // Integration Tests
  // ========================================

  describe('Integration - Combined Helper Usage', () => {
    it('should support complete CRUD operation mocking', async () => {
      const mockUser = {
        _id: '123',
        name: 'John',
        profile: { bio: 'Test bio' }
      };

      // Create
      const createStub = sandbox.stub().resolves(mockUser);

      // Read
      const findChain = setupFindByIdChain(sandbox, mockUser);

      // Update (using response mock)
      const res = createMockResponse(sandbox);

      // Delete (using count mock for verification)
      const countChain = setupCountChain(sandbox, 0);

      // Simulate operations
      const created = await createStub(mockUser);
      const found = await findChain.populate('profile').exec();

      res.status(200).json({ data: created });
      const deletedCount = await countChain.exec();

      expect(created).to.deep.equal(mockUser);
      expect(found).to.deep.equal(mockUser);
      expect(res.status.calledWith(200)).to.be.true;
      expect(deletedCount).to.equal(0);
    });

    it('should support complex insight workflow', async () => {
      const mockInsight = {
        _id: '1',
        userId: { _id: 'u1', name: 'User1' },
        periodId: { _id: 'p1', name: 'Period1' },
        content: 'Test insight'
      };

      // Find with multiple populates
      const findChain = setupPopulateChain(
        sandbox,
        ['userId', 'periodId'],
        mockInsight
      );

      // Aggregation for statistics
      const aggChain = setupAggregateChain(
        sandbox,
        ['$match', '$group'],
        [{ _id: 'u1', count: 5 }]
      );

      // Notification after creation
      const notifService = createMockNotificationService(sandbox);

      // Response to client
      const res = createMockResponse(sandbox);

      // Execute workflow
      const insight = await findChain
        .populate('userId')
        .populate('periodId')
        .exec();

      const stats = await aggChain
        .match({ status: 'active' })
        .group({ _id: '$userId', count: { $sum: 1 } })
        .exec();

      await notifService.createNotification('u1', 'New insight created');

      res.status(201).json({ data: insight });

      // Verify
      expect(insight).to.deep.equal(mockInsight);
      expect(stats).to.deep.equal([{ _id: 'u1', count: 5 }]);
      expect(notifService.createNotification.calledOnce).to.be.true;
      expect(res.status.calledWith(201)).to.be.true;
    });
  });
});
