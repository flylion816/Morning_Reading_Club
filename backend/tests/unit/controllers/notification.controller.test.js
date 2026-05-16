/**
 * Notification Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');
const {
  setupFindChain,
  setupFindByIdChain,
  createMockResponse
} = require('../helpers/mock-helpers');

describe('Notification Controller', () => {
  let notificationController;
  let sandbox;
  let req;
  let res;
  let next;
  let NotificationStub;
  let publishSyncEventStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = { body: {}, params: {}, query: {}, user: {} };
    res = createMockResponse(sandbox);
    next = sandbox.stub();

    // Mock publishSyncEvent to prevent errors
    publishSyncEventStub = sandbox.stub().resolves();

    NotificationStub = {
      find: sandbox.stub(),
      findOne: sandbox.stub(),
      findById: sandbox.stub(),
      countDocuments: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      updateMany: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      deleteMany: sandbox.stub(),
      collection: {
        updateOne: sandbox.stub().resolves()
      }
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg })
      }
    };

    const UserStub = {
      findById: sandbox.stub()
    };

    const loggerStub = {
      error: sandbox.stub(),
      warn: sandbox.stub(),
      info: sandbox.stub()
    };

    const syncServiceStub = {
      publishSyncEvent: publishSyncEventStub
    };

    notificationController = proxyquire(
      '../../../src/controllers/notification.controller',
      {
        '../models/Notification': NotificationStub,
        '../models/User': UserStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub,
        '../services/sync.service': syncServiceStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getUserNotifications', () => {
    it('应该返回用户的通知列表', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.query = { page: 1, limit: 10 };

      const mockNotifications = [{
        _id: new mongoose.Types.ObjectId(),
        userId,
        senderId: { nickname: 'User1', avatar: 'avatar1' },
        message: 'Test notification',
        isRead: false,
        createdAt: new Date()
      }];

      // Setup mocks using helper functions
      NotificationStub.countDocuments.resolves(5);
      const chain = setupFindChain(sandbox, mockNotifications);
      NotificationStub.find.returns(chain);

      await notificationController.getUserNotifications(req, res, next);

      expect(res.json.called).to.be.true;
      expect(NotificationStub.countDocuments.calledWith({ userId, isArchived: false })).to.be.true;
      expect(NotificationStub.find.calledWith({ userId, isArchived: false })).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('notifications');
      expect(responseData.data).to.have.property('pagination');
    });
  });

  describe('markNotificationAsRead', () => {
    it('应该标记通知为已读', async () => {
      const userId = new mongoose.Types.ObjectId().toString(); // Convert to string
      const notificationId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { notificationId };

      const mockNotification = {
        _id: notificationId,
        userId: { toString: () => userId }, // Return the string userId
        isRead: false,
        readAt: null,
        toObject: sandbox.stub().returns({}),
        save: sandbox.stub().resolves()
      };

      // Use setupFindByIdChain helper for proper chaining
      const chain = setupFindByIdChain(sandbox, mockNotification);
      NotificationStub.findById.returns(chain);

      await notificationController.markNotificationAsRead(req, res, next);

      expect(mockNotification.save.called).to.be.true;
      expect(res.json.called).to.be.true;
    });
  });

  describe('markAllAsRead', () => {
    it('应该标记所有通知为已读', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };

      NotificationStub.updateMany.resolves({ modifiedCount: 5 });

      await notificationController.markAllAsRead(req, res, next);

      expect(res.json.called).to.be.true;
      expect(
        NotificationStub.updateMany.calledWithMatch({ userId, isRead: false, isArchived: false })
      ).to.be.true;
    });
  });

  describe('getUnreadCount', () => {
    it('应该返回未读通知数量', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };

      NotificationStub.countDocuments.resolves(3);

      await notificationController.getUnreadCount(req, res, next);

      expect(res.json.called).to.be.true;
      expect(
        NotificationStub.countDocuments.calledWith({ userId, isRead: false, isArchived: false })
      ).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('unreadCount');
    });
  });

  describe('deleteNotification', () => {
    it('应该删除自己的通知', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const notificationId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { notificationId };

      const mockNotification = {
        _id: notificationId,
        userId,  // 使用字符串形式的 userId
        title: '通知',
        isRead: false,
        toString: function() { return this.userId; },  // 提供 toString 方法
        toObject: sandbox.stub().returns({
          _id: notificationId,
          userId,
          title: '通知',
          isRead: false
        })
      };

      NotificationStub.findById.resolves(mockNotification);
      NotificationStub.findByIdAndDelete.resolves(mockNotification);

      await notificationController.deleteNotification(req, res, next);

      expect(res.json.called).to.be.true;
      expect(NotificationStub.findByIdAndDelete.called).to.be.true;
    });

    it('应该返回403当删除他人的通知', async () => {
      const userId = req.user.userId;
      const otherUserId = new mongoose.Types.ObjectId().toString();
      const notificationId = new mongoose.Types.ObjectId();
      req.params = { notificationId };

      const mockNotification = {
        _id: notificationId,
        userId: otherUserId,
        title: '通知'
      };

      NotificationStub.findById.resolves(mockNotification);

      await notificationController.deleteNotification(req, res, next);

      expect(res.status.calledWith(403)).to.be.true;
    });

    it('应该返回404当通知不存在', async () => {
      const notificationId = new mongoose.Types.ObjectId();
      req.params = { notificationId };

      NotificationStub.findById.resolves(null);

      await notificationController.deleteNotification(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('deleteAllNotifications', () => {
    it('应该删除所有通知', async () => {
      const userId = req.user.userId;

      const mockNotifications = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          toObject: sandbox.stub().returnsThis()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          toObject: sandbox.stub().returnsThis()
        }
      ];

      NotificationStub.find.resolves(mockNotifications);
      NotificationStub.deleteMany.resolves({ deletedCount: 2 });

      await notificationController.deleteAllNotifications(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('deletedCount');
      expect(responseData.data.deletedCount).to.equal(2);
    });
  });

  describe('archiveNotification', () => {
    it('应该归档自己的通知', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const notificationId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { notificationId };

      const mockNotification = {
        _id: notificationId,
        userId,
        title: '通知',
        isArchived: false,
        archivedAt: null,
        save: sandbox.stub().resolves(),
        toString: function() { return this.userId; },
        toObject: sandbox.stub().returnsThis()
      };

      NotificationStub.findById.resolves(mockNotification);

      await notificationController.archiveNotification(req, res, next);

      expect(res.json.called).to.be.true;
      expect(mockNotification.save.called).to.be.true;
    });

    it('应该返回404当通知不存在', async () => {
      const notificationId = new mongoose.Types.ObjectId();
      req.params = { notificationId };

      NotificationStub.findById.resolves(null);

      await notificationController.archiveNotification(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('getArchivedNotifications', () => {
    it('应该返回已归档的通知列表', async () => {
      const userId = req.user.userId;
      req.query = { page: 1, limit: 20 };

      const mockArchivedNotifications = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          title: '归档通知',
          isArchived: true,
          archivedAt: new Date()
        }
      ];

      NotificationStub.countDocuments.resolves(1);
      NotificationStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        resolves: sandbox.stub().resolves(mockArchivedNotifications)
      });

      await notificationController.getArchivedNotifications(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('notifications');
      expect(responseData.data).to.have.property('pagination');
    });
  });

  describe('createNotification', () => {
    it('重复的小凡看见申请通知应更新原站内信而不是新建', async () => {
      const userId = new mongoose.Types.ObjectId();
      const requestId = new mongoose.Types.ObjectId();
      const notificationId = new mongoose.Types.ObjectId();
      const existingNotification = {
        _id: notificationId,
        title: '旧标题',
        content: '旧内容',
        senderId: null,
        data: {},
        isRead: true,
        readAt: new Date('2026-05-10T12:00:00.000Z'),
        isArchived: true,
        archivedAt: new Date('2026-05-10T12:00:00.000Z'),
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
        save: sandbox.stub().resolves(),
        toObject: sandbox.stub().returns({ _id: notificationId, title: '新申请' })
      };

      NotificationStub.findOne.resolves(existingNotification);

      const result = await notificationController.createNotification(
        userId,
        'request_created',
        '新申请',
        '用户申请查看你的小凡看见',
        {
          requestId,
          upsertExisting: true,
          data: { insightRequestId: requestId.toString() }
        }
      );

      expect(NotificationStub.findOne.calledWithMatch({ userId, type: 'request_created' })).to.be.true;
      expect(NotificationStub.findOne.firstCall.args[0].$or).to.deep.equal([
        { requestId },
        { 'data.insightRequestId': requestId.toString() }
      ]);
      expect(existingNotification.save.calledOnce).to.be.true;
      expect(result).to.equal(existingNotification);
      expect(existingNotification.title).to.equal('新申请');
      expect(existingNotification.content).to.equal('用户申请查看你的小凡看见');
      expect(existingNotification.requestId).to.equal(requestId);
      expect(existingNotification.isRead).to.equal(false);
      expect(existingNotification.readAt).to.equal(null);
      expect(existingNotification.isArchived).to.equal(false);
      expect(existingNotification.archivedAt).to.equal(null);
      expect(NotificationStub.collection.updateOne.calledOnce).to.be.true;
      expect(NotificationStub.collection.updateOne.firstCall.args[0]).to.deep.equal({
        _id: notificationId
      });
      expect(NotificationStub.collection.updateOne.firstCall.args[1].$set.createdAt).to.be.an.instanceOf(
        Date
      );
      expect(publishSyncEventStub.calledWithMatch({ type: 'update', collection: 'notifications' })).to.be
        .true;
    });

    it('重复的小凡看见发布通知应按 insightId 更新原站内信', async () => {
      const userId = new mongoose.Types.ObjectId();
      const insightId = new mongoose.Types.ObjectId();
      const notificationId = new mongoose.Types.ObjectId();
      const existingNotification = {
        _id: notificationId,
        title: '旧标题',
        content: '旧内容',
        requestId: null,
        senderId: null,
        data: {},
        isRead: true,
        readAt: new Date('2026-05-10T12:00:00.000Z'),
        isArchived: true,
        archivedAt: new Date('2026-05-10T12:00:00.000Z'),
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
        save: sandbox.stub().resolves(),
        toObject: sandbox.stub().returns({ _id: notificationId, title: '你被小凡看见了' })
      };

      NotificationStub.findOne.resolves(existingNotification);

      const result = await notificationController.createNotification(
        userId,
        'insight_created',
        '你被小凡看见了',
        '秩序之锚 · 第1天',
        {
          upsertExisting: true,
          data: { insightId: insightId.toString(), periodName: '秩序之锚' }
        }
      );

      expect(NotificationStub.findOne.calledWithMatch({ userId, type: 'insight_created' })).to.be.true;
      expect(NotificationStub.findOne.firstCall.args[0].$or).to.deep.equal([
        { 'data.insightId': insightId.toString() }
      ]);
      expect(existingNotification.save.calledOnce).to.be.true;
      expect(result).to.equal(existingNotification);
      expect(existingNotification.title).to.equal('你被小凡看见了');
      expect(existingNotification.content).to.equal('秩序之锚 · 第1天');
      expect(existingNotification.isRead).to.equal(false);
      expect(existingNotification.isArchived).to.equal(false);
      expect(publishSyncEventStub.calledWithMatch({ type: 'update', collection: 'notifications' })).to.be
        .true;
    });
  });
});
