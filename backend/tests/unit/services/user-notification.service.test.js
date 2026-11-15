const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('user-notification.service 读伴标记', () => {
  let createNotification;
  let buddyService;
  let service;

  beforeEach(() => {
    createNotification = sinon.stub().resolves();
    buddyService = { areBuddies: sinon.stub().resolves(false) };
    service = proxyquire('../../../src/services/user-notification.service', {
      '../controllers/notification.controller': { createNotification },
      './subscribe-message.service': { sendSceneMessage: sinon.stub().resolves() },
      './buddy.service': buddyService,
      '../utils/logger': { warn: () => {} }
    });
  });

  const payload = {
    recipientUserId: 'u1',
    notificationType: 'like_received',
    title: 't',
    content: 'c',
    senderId: 'u2',
    data: { checkinId: 'c1' }
  };

  it('发送人是收件人的读伴时，通知数据里标记 fromBuddy', async () => {
    buddyService.areBuddies.resolves(true);
    await service.dispatchNotificationWithSubscribe({ wsManager: {} }, payload);
    expect(buddyService.areBuddies.calledWith('u2', 'u1')).to.equal(true);
    expect(createNotification.firstCall.args[4].data).to.include({ checkinId: 'c1', fromBuddy: true });
  });

  it('不是读伴时不带标记；查询失败也照常发通知', async () => {
    await service.dispatchNotificationWithSubscribe({ wsManager: {} }, payload);
    expect(createNotification.firstCall.args[4].data).to.not.have.property('fromBuddy');

    buddyService.areBuddies.rejects(new Error('db'));
    await service.dispatchNotificationWithSubscribe({ wsManager: {} }, payload);
    expect(createNotification.calledTwice).to.equal(true);
    expect(createNotification.secondCall.args[4].data).to.not.have.property('fromBuddy');
  });

  it('没有发送人（系统通知）时不查读伴关系', async () => {
    await service.dispatchNotificationWithSubscribe({ wsManager: {} }, { ...payload, senderId: null });
    expect(buddyService.areBuddies.called).to.equal(false);
  });
});
