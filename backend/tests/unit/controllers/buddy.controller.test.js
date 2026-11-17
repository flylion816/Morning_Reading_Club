const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('buddy.controller', () => {
  let service;
  let createNotification;
  let controller;
  let res;
  const req = { user: { id: 'u2' }, params: { periodId: 'p1' }, wsManager: {} };

  beforeEach(() => {
    service = {
      getState: sinon.stub(),
      join: sinon.stub(),
      cancel: sinon.stub(),
      leave: sinon.stub(),
      nudge: sinon.stub(),
      highFive: sinon.stub(),
      gift: sinon.stub(),
      getSouvenir: sinon.stub(),
      rematch: sinon.stub(),
      react: sinon.stub(),
      listCandidates: sinon.stub(),
      invite: sinon.stub(),
      respondInvite: sinon.stub(),
      cancelInvite: sinon.stub(),
      setDiscoverable: sinon.stub(),
      getActiveBuddyId: sinon.stub()
    };
    createNotification = sinon.stub().resolves();
    res = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
    controller = proxyquire('../../../src/controllers/buddy.controller', {
      '../utils/response': {
        success: data => ({ code: 0, data }),
        errors: {
          badRequest: m => ({ code: 400, message: m }),
          forbidden: m => ({ code: 403, message: m }),
          notFound: m => ({ code: 404, message: m }),
          serverError: m => ({ code: 500, message: m }),
          serviceUnavailable: m => ({ code: 503, message: m })
        }
      },
      '../utils/logger': { error: () => {}, warn: () => {} },
      '../services/buddy.service': service,
      './notification.controller': { createNotification }
    });
  });

  it('getBuddyState 返回服务层状态', async () => {
    service.getState.resolves({ state: 'none' });
    await controller.getBuddyState(req, res);
    expect(service.getState.calledWith('u2', 'p1')).to.equal(true);
    expect(res.json.firstCall.args[0].data).to.deep.equal({ state: 'none' });
  });

  it('nudgeBuddy 给读伴发一条 buddy_nudge 站内通知', async () => {
    service.nudge.resolves({ buddyUserId: 'u1', senderName: '小二', state: { state: 'paired' } });
    await controller.nudgeBuddy(req, res);
    const args = createNotification.firstCall.args;
    expect(args.slice(0, 4)).to.deep.equal(['u1', 'buddy_nudge', '你的读伴轻拍了你一下', '小二在等你一起读']);
    expect(res.json.firstCall.args[0].data).to.deep.equal({ state: 'paired' });
  });

  it('通知失败不影响轻拍结果', async () => {
    service.nudge.resolves({ buddyUserId: 'u1', senderName: '小二', state: { state: 'paired' } });
    createNotification.rejects(new Error('x'));
    await controller.nudgeBuddy(req, res);
    expect(res.json.firstCall.args[0].code).to.equal(0);
  });

  it('业务错误按状态码返回，不泄露内部异常', async () => {
    const err = new Error('TA 今天已经读过了');
    Object.assign(err, { isBuddyError: true, kind: 'badRequest', status: 400 });
    service.nudge.rejects(err);
    await controller.nudgeBuddy(req, res);
    expect(res.status.calledWith(400)).to.equal(true);
    expect(res.json.firstCall.args[0].message).to.equal('TA 今天已经读过了');
    expect(createNotification.called).to.equal(false);

    service.join.rejects(new Error('db down'));
    await controller.joinBuddy(req, res);
    expect(res.status.calledWith(500)).to.equal(true);
  });
  it('轻拍通知标题带上期次名，两期各有读伴时不会混', async () => {
    service.nudge.resolves({ buddyUserId: 'u1', senderName: '小二', state: { state: 'paired', periodName: '连接之力' } });
    await controller.nudgeBuddy(req, res);
    expect(createNotification.firstCall.args[2]).to.equal('你的读伴轻拍了你一下 · 连接之力');
  });

  it('highFiveBuddy 给读伴发 buddy_highfive 通知，通知失败不影响结果', async () => {
    service.highFive.resolves({ buddyUserId: 'u1', senderName: '小二', state: { state: 'paired', periodName: '连接之力' } });
    await controller.highFiveBuddy(req, res);
    const args = createNotification.firstCall.args;
    expect(args[0]).to.equal('u1');
    expect(args[1]).to.equal('buddy_highfive');
    expect(args[2]).to.equal('你的读伴和你击了个掌 · 连接之力');
    expect(res.json.firstCall.args[0].data.state).to.equal('paired');

    createNotification.rejects(new Error('x'));
    await controller.highFiveBuddy(req, res);
    expect(res.json.secondCall.args[0].code).to.equal(0);
  });

  it('giftBuddy 把 messageKey 交给服务层，并把送的话写进通知', async () => {
    service.gift.resolves({ buddyUserId: 'u1', senderName: '小二', giftText: '不用赶，我在这儿。', state: { state: 'paired' } });
    await controller.giftBuddy({ ...req, body: { messageKey: 'noRush' } }, res);
    expect(service.gift.calledWith('u2', 'p1', { messageKey: 'noRush', text: undefined })).to.equal(true);
    const args = createNotification.firstCall.args;
    expect(args[1]).to.equal('buddy_gift');
    expect(args[3]).to.equal('小二：「不用赶，我在这儿。」');
  });

  it('giftBuddy 自己写的话：text 原样交给服务层，通知里就是这句话', async () => {
    service.gift.resolves({ buddyUserId: 'u1', senderName: '小二', giftText: '我也读了', state: { state: 'paired' } });
    await controller.giftBuddy({ ...req, body: { text: '我也读了' } }, res);
    expect(service.gift.calledWith('u2', 'p1', { messageKey: undefined, text: '我也读了' })).to.equal(true);
    expect(createNotification.firstCall.args[3]).to.equal('小二：「我也读了」');
  });

  it('giftBuddy 内容没通过返回 400、检查服务不可用返回 503，都不发通知', async () => {
    service.gift.rejects(Object.assign(new Error('这句话暂时送不出去，换一句试试'), { isBuddyError: true, kind: 'badRequest', status: 400 }));
    await controller.giftBuddy({ ...req, body: { text: '不行的话' } }, res);
    expect(res.status.firstCall.args[0]).to.equal(400);
    expect(res.json.firstCall.args[0]).to.deep.equal({ code: 400, message: '这句话暂时送不出去，换一句试试' });

    service.gift.rejects(
      Object.assign(new Error('暂时没法送自己写的话，先选一句预设的吧'), { isBuddyError: true, kind: 'serviceUnavailable', status: 503 })
    );
    await controller.giftBuddy({ ...req, body: { text: '想说的话' } }, res);
    expect(res.status.secondCall.args[0]).to.equal(503);
    expect(res.json.secondCall.args[0]).to.deep.equal({ code: 503, message: '暂时没法送自己写的话，先选一句预设的吧' });
    expect(createNotification.called).to.equal(false);
  });

  it('getBuddySouvenir 和 rematchBuddy 返回服务层结果', async () => {
    service.getSouvenir.resolves({ togetherDays: 3 });
    await controller.getBuddySouvenir(req, res);
    expect(res.json.firstCall.args[0].data).to.deep.equal({ togetherDays: 3 });
    service.rematch.resolves({ rematch: { mine: true, both: false } });
    await controller.rematchBuddy(req, res);
    expect(service.rematch.calledWith('u2', 'p1')).to.equal(true);
  });
  it('reactBuddy 把打卡和短句交给服务层，并给读伴发 buddy_reaction 通知，带上跳转页', async () => {
    service.react.resolves({
      buddyUserId: 'u1',
      senderName: '小二',
      reactionText: '这句也打动我。',
      checkinId: 'c1',
      sectionId: 's1',
      state: { state: 'paired', periodName: '连接之力' }
    });
    await controller.reactBuddy({ ...req, body: { checkinId: 'c1', messageKey: 'moved' } }, res);
    expect(service.react.calledWith('u2', 'p1', 'c1', 'moved')).to.equal(true);
    const args = createNotification.firstCall.args;
    expect(args[0]).to.equal('u1');
    expect(args[1]).to.equal('buddy_reaction');
    expect(args[2]).to.equal('你的读伴回应了你的打卡 · 连接之力');
    expect(args[3]).to.equal('小二：「这句也打动我。」');
    expect(args[4].data).to.include({ checkinId: 'c1', sectionId: 's1' });
    expect(args[4].data.targetPage).to.equal('/pages/course-detail/course-detail?id=s1&periodId=p1&checkinId=c1&focus=comments');
  });
  it('候选名单、邀请：邀请给对方发 buddy_invite 通知，带 inviteId', async () => {
    service.listCandidates.resolves({ list: [{ userId: 'u3', nickname: '小三' }], hasMore: false });
    await controller.listBuddyCandidates({ ...req, query: { q: '三' } }, res);
    expect(service.listCandidates.calledWith('u2', 'p1', { q: '三', page: undefined })).to.equal(true);
    expect(res.json.firstCall.args[0].data.list).to.have.length(1);

    service.invite.resolves({ targetUserId: 'u3', inviteId: 'i1', senderName: '小二', state: { state: 'none', periodName: '连接之力' } });
    await controller.inviteBuddy({ ...req, body: { targetUserId: 'u3' } }, res);
    const args = createNotification.firstCall.args;
    expect(args.slice(0, 4)).to.deep.equal(['u3', 'buddy_invite', '有书友邀请你做读伴 · 连接之力', '小二邀请你做读伴']);
    expect(args[4].data).to.include({ inviteId: 'i1' });
  });

  it('同意邀请：通知邀请人；婉拒不通知；对方先邀请时直接结成并通知', async () => {
    service.respondInvite.resolves({ accepted: true, buddyUserId: 'u1', senderName: '小二', state: { state: 'paired' } });
    await controller.respondBuddyInvite({ ...req, params: { periodId: 'p1', inviteId: 'i1' }, body: { accept: true } }, res);
    expect(service.respondInvite.calledWith('u2', 'p1', 'i1', true)).to.equal(true);
    expect(createNotification.firstCall.args.slice(0, 2)).to.deep.equal(['u1', 'buddy_invite_accepted']);

    createNotification.resetHistory();
    service.respondInvite.resolves({ declined: true, state: { state: 'none' } });
    await controller.respondBuddyInvite({ ...req, params: { periodId: 'p1', inviteId: 'i2' }, body: { accept: false } }, res);
    expect(createNotification.called).to.equal(false);

    service.invite.resolves({ autoAccepted: true, accepted: true, buddyUserId: 'u3', senderName: '小二', state: { state: 'paired' } });
    await controller.inviteBuddy({ ...req, body: { targetUserId: 'u3' } }, res);
    expect(createNotification.firstCall.args.slice(0, 2)).to.deep.equal(['u3', 'buddy_invite_accepted']);
  });

  it('撤回邀请返回最新状态', async () => {
    service.cancelInvite.resolves({ state: 'none', invitesSent: [] });
    await controller.cancelBuddyInvite({ ...req, params: { periodId: 'p1', inviteId: 'i1' } }, res);
    expect(service.cancelInvite.calledWith('u2', 'p1', 'i1')).to.equal(true);
  });
  it('结束读伴：给对方发一条很轻的 buddy_ended 通知，没有读伴时不通知', async () => {
    service.getActiveBuddyId.resolves('u1');
    service.leave.resolves({ state: 'ended' });
    await controller.leaveBuddy(req, res);
    const args = createNotification.firstCall.args;
    expect(args.slice(0, 2)).to.deep.equal(['u1', 'buddy_ended']);
    expect(args[3]).to.not.include('小二');

    createNotification.resetHistory();
    service.getActiveBuddyId.resolves(null);
    await controller.leaveBuddy(req, res);
    expect(createNotification.called).to.equal(false);
  });

  it('设置是否出现在邀请名单里', async () => {
    service.setDiscoverable.resolves({ discoverable: false });
    await controller.setBuddyDiscoverable({ ...req, body: { discoverable: false } }, res);
    expect(service.setDiscoverable.calledWith('u2', false)).to.equal(true);
    await controller.setBuddyDiscoverable({ ...req, body: {} }, res);
    expect(service.setDiscoverable.lastCall.args[1]).to.equal(true);
  });
});
