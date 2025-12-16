/**
 * Notification Model 单元测试
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const Notification = require('../../../src/models/Notification');

describe('Notification Model', () => {
  let userId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
    userId = new mongoose.Types.ObjectId();
  });

  afterEach(async () => {
    await Notification.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  describe('Schema Validation', () => {
    it('应该创建有效的通知', async () => {
      const notification = await Notification.create({
        userId,
        type: 'checkin',
        title: '打卡提醒',
        content: '快来完成今天的打卡'
      });

      expect(notification._id).to.exist;
      expect(notification.userId.toString()).to.equal(userId.toString());
      expect(notification.type).to.equal('checkin');
      expect(notification.isRead).to.be.false;
    });

    it('应该使用默认值', async () => {
      const notification = await Notification.create({
        userId: new mongoose.Types.ObjectId(),
        type: 'system',
        title: '系统通知',
        content: '内容'
      });

      expect(notification.isRead).to.be.false;
    });
  });

  describe('Data Persistence', () => {
    it('应该保存并检索通知数据', async () => {
      const notification = await Notification.create({
        userId,
        type: 'checkin',
        title: '打卡提醒',
        content: '快来完成打卡',
        isRead: false
      });

      const retrieved = await Notification.findById(notification._id);
      expect(retrieved.title).to.equal('打卡提醒');
      expect(retrieved.isRead).to.be.false;
    });

    it('应该支持按userId查询', async () => {
      const u1 = new mongoose.Types.ObjectId();

      await Notification.create({
        userId: u1,
        type: 'checkin',
        title: '通知1',
        content: '内容1'
      });

      await Notification.create({
        userId: u1,
        type: 'system',
        title: '通知2',
        content: '内容2'
      });

      const notifications = await Notification.find({ userId: u1 });
      expect(notifications).to.have.lengthOf(2);
    });

    it('应该支持标记为已读', async () => {
      const notification = await Notification.create({
        userId,
        type: 'checkin',
        title: '通知',
        content: '内容',
        isRead: false
      });

      notification.isRead = true;
      await notification.save();

      const updated = await Notification.findById(notification._id);
      expect(updated.isRead).to.be.true;
    });
  });

  describe('Timestamps', () => {
    it('应该自动创建createdAt和updatedAt', async () => {
      const notification = await Notification.create({
        userId,
        type: 'system',
        title: '时间测试',
        content: '内容'
      });

      expect(notification.createdAt).to.exist;
      expect(notification.updatedAt).to.exist;
    });
  });
});
