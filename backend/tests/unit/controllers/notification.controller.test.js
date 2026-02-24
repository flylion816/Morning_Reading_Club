/**
 * Notification Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Notification Controller', () => {
  let notificationController;
  let sandbox;
  let req;
  let res;
  let next;
  let NotificationStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = { body: {}, params: {}, query: {}, user: {} };
    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };
    next = sandbox.stub();

    NotificationStub = {
      find: sandbox.stub(),
      findById: sandbox.stub(),
      countDocuments: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      updateMany: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      deleteMany: sandbox.stub()
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

    notificationController = proxyquire(
      '../../../src/controllers/notification.controller',
      {
        '../models/Notification': NotificationStub,
        '../models/User': UserStub,
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub
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

      NotificationStub.countDocuments.resolves(5);
      NotificationStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().resolves(mockNotifications)
      });

      await notificationController.getUserNotifications(req, res, next);

      expect(res.json.called).to.be.true;
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
        save: sandbox.stub().resolves()
      };

      NotificationStub.findById.resolves(mockNotification);

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
    });
  });

  describe('getUnreadCount', () => {
    it('应该返回未读通知数量', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.user = { userId };

      NotificationStub.countDocuments.resolves(3);

      await notificationController.getUnreadCount(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('unreadCount');
    });
  });

  describe('deleteNotification', () => {
    it('应该删除自己的通知', async () => {
      const userId = req.user.userId;
      const notificationId = new mongoose.Types.ObjectId();
      req.params = { notificationId };

      const mockNotification = {
        _id: notificationId,
        userId,
        title: '通知',
        isRead: false
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

      NotificationStub.deleteMany.resolves({ deletedCount: 5 });

      await notificationController.deleteAllNotifications(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('deletedCount');
      expect(responseData.data.deletedCount).to.equal(5);
    });
  });

  describe('archiveNotification', () => {
    it('应该归档自己的通知', async () => {
      const userId = req.user.userId;
      const notificationId = new mongoose.Types.ObjectId();
      req.params = { notificationId };

      const mockNotification = {
        _id: notificationId,
        userId,
        title: '通知',
        isArchived: false,
        save: sandbox.stub().resolves()
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
});
