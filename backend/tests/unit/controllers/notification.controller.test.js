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
      countDocuments: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      updateMany: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data })
    };

    notificationController = proxyquire(
      '../../../src/controllers/notification.controller',
      {
        '../models/Notification': NotificationStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getUserNotifications', () => {
    it('应该返回用户的通知列表', async () => {
      const userId = new mongoose.Types.ObjectId();
      req.params = { userId };
      req.query = { page: 1, limit: 10 };

      NotificationStub.countDocuments.resolves(5);
      NotificationStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await notificationController.getUserNotifications(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('pagination');
    });
  });

  describe('markNotificationAsRead', () => {
    it('应该标记通知为已读', async () => {
      const userId = new mongoose.Types.ObjectId();
      const notificationId = new mongoose.Types.ObjectId();
      req.user = { userId };
      req.params = { notificationId };

      const mockNotification = {
        _id: notificationId,
        userId,
        isRead: true,
        save: sandbox.stub().resolves()
      };

      NotificationStub.findById.resolves(mockNotification);

      await notificationController.markNotificationAsRead(req, res, next);

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
});
