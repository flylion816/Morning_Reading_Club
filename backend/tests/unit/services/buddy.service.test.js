const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

// 内存假模型：只实现 buddy.service 用到的查询形态
let seq = 0;
const nextId = () => `id_${String(++seq).padStart(6, '0')}`;
const S = v => (v == null ? v : String(v));

function matchValue(doc, key, cond) {
  const val = doc[key];
  if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
    if ('$lt' in cond && cond.$lt instanceof Date) return val instanceof Date && val < cond.$lt;
    if ('$lt' in cond) return S(val) < S(cond.$lt);
    if ('$nin' in cond) return !cond.$nin.map(S).includes(S(val));
    if ('$ne' in cond) return S(val) !== S(cond.$ne);
    if ('$gte' in cond) return val instanceof Date && val >= cond.$gte;
    if ('$regex' in cond) return new RegExp(cond.$regex, cond.$options).test(S(val));
    if ('$in' in cond) return cond.$in.map(S).includes(S(val));
    if ('$not' in cond) return !(val || []).some(e => Object.keys(cond.$not.$elemMatch).every(k => S(e[k]) === S(cond.$not.$elemMatch[k])));
  }
  if (Array.isArray(val)) return val.map(S).includes(S(cond));
  return S(val) === S(cond);
}
const matches = (doc, q) => Object.keys(q).every(k => matchValue(doc, k, q[k]));

function makeModel(uniqueCheck) {
  const docs = [];
  const chain = result => ({ select: () => chain(result), sort: () => chain(result), limit: () => chain(result), populate: () => chain(result), lean: () => Promise.resolve(result), then: (a, b) => Promise.resolve(result).then(a, b) });
  const model = {
    docs,
    findOne: q => chain(docs.find(d => matches(d, q)) || null),
    find: q => chain(docs.filter(d => matches(d, q))),
    async create(data) {
      const doc = { _id: nextId(), ...data };
      if (uniqueCheck) uniqueCheck(docs, doc);
      docs.push(doc);
      return doc;
    },
    async findOneAndUpdate(q, update, opts = {}) {
      let list = docs.filter(d => matches(d, q));
      if (opts.sort) list = list.sort((a, b) => (a._id < b._id ? -1 : 1));
      let doc = list[0];
      if (!doc && opts.upsert) {
        doc = { _id: nextId(), ...update.$setOnInsert };
        if (uniqueCheck) uniqueCheck(docs, doc);
        docs.push(doc);
        return doc;
      }
      if (doc && update.$set) Object.assign(doc, update.$set);
      return doc || null;
    },
    async updateOne(q, update) {
      const doc = docs.find(d => matches(d, q));
      if (!doc) return { modifiedCount: 0 };
      if (update.$set) Object.assign(doc, update.$set);
      if (update.$push) Object.keys(update.$push).forEach(k => { doc[k] = (doc[k] || []).concat(update.$push[k]); });
      return { modifiedCount: 1 };
    },
    async updateMany(q, update) {
      docs.filter(d => matches(d, q)).forEach(d => Object.assign(d, update.$set));
      return {};
    }
  };
  return model;
}

function dup() {
  const e = new Error('dup');
  e.code = 11000;
  return e;
}

const PID = '64b000000000000000000001';
const PID2 = '64b000000000000000000002';

describe('buddy.service', () => {
  let pairs;
  let requests;
  let checkins;
  let completions;
  let reactions;
  let invites;
  let usersModel;
  let enrolled;
  let ongoing;
  let periodDoc;
  let service;

  const users = {
    u1: { _id: 'u1', nickname: '小一', avatarUrl: 'a1' },
    u2: { _id: 'u2', nickname: '小二', avatarUrl: 'a2' },
    u3: { _id: 'u3', nickname: '小三', avatarUrl: 'a3' },
    u4: { _id: 'u4', nickname: '小四', avatarUrl: 'a4' }
  };
  // 2026-11-10 12:00 东八区
  const NOW = new Date('2026-11-10T12:00:00+08:00');

  beforeEach(() => {
    seq = 0;
    enrolled = new Set(['u1', 'u2', 'u3', 'u4']);
    ongoing = true;
    periodDoc = { _id: PID, name: '连接之力' };
    pairs = makeModel((docs, doc) => {
      if (doc.active && docs.some(d => d.active && S(d.periodId) === S(doc.periodId) && d.members.some(m => doc.members.includes(m)))) throw dup();
    });
    requests = makeModel((docs, doc) => {
      if (doc.status === 'waiting' && docs.some(d => d.status === 'waiting' && S(d.userId) === S(doc.userId))) throw dup();
    });
    checkins = makeModel();
    completions = makeModel();
    // 邀请：同一个人对同一个人同时只能有一条待回复；ID 换成 24 位十六进制，和真实库一致
    invites = makeModel((docs, doc) => {
      if (doc.status === 'pending' && docs.some(d => d.status === 'pending' && S(d.fromUserId) === S(doc.fromUserId) && S(d.toUserId) === S(doc.toUserId))) throw dup();
    });
    const createInvite = invites.create;
    let inviteSeq = 0;
    invites.create = async data => {
      const doc = await createInvite({ createdAt: new Date(), updatedAt: new Date(), ...data });
      inviteSeq += 1;
      doc._id = `64b0000000000000000100${String(inviteSeq).padStart(2, '0')}`;
      return doc;
    };
    usersModel = makeModel();
    reactions = makeModel((docs, doc) => {
      if (docs.some(d => S(d.checkinId) === S(doc.checkinId) && S(d.fromUserId) === S(doc.fromUserId))) throw dup();
    });
    // Checkin / Completion 的日期过滤在假模型里不区分，测试里直接按 userId 放数据
    const rangeless = model => ({
      find: q => model.find({ userId: q.userId }),
      findOne: q => model.findOne({ _id: q._id, userId: q.userId })
    });
    Object.values(users).forEach(user => usersModel.docs.push(user));
    const UserStub = {
      findById: id => ({ select: () => ({ lean: () => Promise.resolve(users[id] || null) }) }),
      find: q => usersModel.find(q),
      updateOne: async (q, update) => {
        const doc = users[q._id];
        if (doc && update.$set) Object.assign(doc, update.$set);
        return { modifiedCount: doc ? 1 : 0 };
      }
    };
    service = proxyquire('../../../src/services/buddy.service', {
      '../models/BuddyPair': pairs,
      '../models/BuddyRequest': requests,
      '../models/Checkin': rangeless(checkins),
      '../models/UserReadingCompletion': rangeless(completions),
      '../models/User': UserStub,
      '../models/BuddyReaction': reactions,
      '../models/BuddyInvite': invites,
      '../models/Enrollment': { find: () => ({ select: () => ({ lean: () => Promise.resolve([...enrolled].map(userId => ({ userId }))) }) }) },
      '../models/Insight': { find: () => makeModel().find({}) },
      '../models/Period': { findById: () => ({ select: () => ({ lean: () => Promise.resolve(periodDoc) }) }) },
      './community-access.service': {
        findCommunityEnrollment: async userId => (enrolled.has(userId) ? { paymentStatus: 'paid' } : null)
      },
      './period-status.service': { calculatePeriodStatus: () => (ongoing ? 'ongoing' : 'completed') },
      '../utils/tenantContext': { getCurrentTenantId: () => 'tenant_1' }
    });
  });

  it('未报名的人不能使用读伴', async () => {
    enrolled.delete('u1');
    let err;
    try { await service.join('u1', PID, NOW); } catch (e) { err = e; }
    expect(err.status).to.equal(403);
  });

  it('期次不在进行中时不能申请', async () => {
    ongoing = false;
    let err;
    try { await service.join('u1', PID, NOW); } catch (e) { err = e; }
    expect(err.status).to.equal(400);
  });

  it('没有别人时保持等待，下一位加入时配成一对', async () => {
    const first = await service.join('u1', PID, NOW);
    expect(first.state).to.equal('waiting');
    const second = await service.join('u2', PID, NOW);
    expect(second.state).to.equal('paired');
    expect(second.buddy.nickname).to.equal('小一');
    expect(second.buddy).to.not.have.property('userId');
    expect((await service.getState('u1', PID, NOW)).state).to.equal('paired');
    expect(pairs.docs).to.have.length(1);
  });

  it('重复申请不会产生第二条等待记录', async () => {
    await service.join('u1', PID, NOW);
    await service.join('u1', PID, NOW);
    expect(requests.docs.filter(r => r.status === 'waiting')).to.have.length(1);
  });

  it('已配对的人再次申请不会再配新的一对', async () => {
    await service.join('u1', PID, NOW);
    await service.join('u2', PID, NOW);
    await service.join('u3', PID, NOW);
    const again = await service.join('u1', PID, NOW);
    expect(again.state).to.equal('paired');
    expect(pairs.docs.filter(p => p.active)).to.have.length(1);
    expect((await service.getState('u3', PID, NOW)).state).to.equal('waiting');
  });

  it('并发加入时只会配出一对，没有人落单重复', async () => {
    await service.join('u1', PID, NOW);
    const [a, b] = await Promise.all([service.join('u2', PID, NOW), service.join('u3', PID, NOW)]);
    expect(pairs.docs.filter(p => p.active)).to.have.length(1);
    const active = pairs.docs.filter(p => p.active);
    const members = active[0].members;
    expect(new Set(members).size).to.equal(2);
    // 无论谁和谁配上，落单的那位仍在等待、没有人同时在两对里
    const left = ['u1', 'u2', 'u3'].filter(u => !members.includes(u))[0];
    expect((await service.getState(left, PID, NOW)).state).to.equal('waiting');
    expect([a.state, b.state]).to.not.include('none');
  });

  it('唯一索引冲突时放回对方的等待，不丢人', async () => {
    await service.join('u1', PID, NOW);
    const realCreate = pairs.create;
    pairs.create = async () => { throw dup(); };
    const result = await service.join('u2', PID, NOW);
    pairs.create = realCreate;
    expect(result.state).to.equal('waiting');
    expect(requests.docs.find(r => r.userId === 'u1').status).to.not.equal('matched');
  });

  it('取消等待后状态回到 none，且不会被别人配到', async () => {
    await service.join('u1', PID, NOW);
    const cancelled = await service.cancel('u1', PID, NOW);
    expect(cancelled.state).to.equal('none');
    const next = await service.join('u2', PID, NOW);
    expect(next.state).to.equal('waiting');
  });

  it('结束后对方看到已结束，重新申请不会再配到同一个人', async () => {
    await service.join('u1', PID, NOW);
    await service.join('u2', PID, NOW);
    const left = await service.leave('u1', PID, NOW);
    expect(left.state).to.equal('ended');
    expect(pairs.docs[0].endedBy).to.equal('u1');
    expect((await service.getState('u2', PID, NOW)).state).to.equal('ended');

    expect((await service.join('u2', PID, NOW)).state).to.equal('waiting');
    const again = await service.join('u1', PID, NOW);
    expect(again.state).to.equal('waiting');
    expect(pairs.docs.filter(p => p.active)).to.have.length(0);

    const third = await service.join('u3', PID, NOW);
    expect(third.state).to.equal('paired');
  });

  it('期次结束后读伴自然解散', async () => {
    await service.join('u1', PID, NOW);
    await service.join('u2', PID, NOW);
    ongoing = false;
    const state = await service.getState('u1', PID, NOW);
    expect(state.state).to.equal('ended');
    expect(state.buddy).to.equal(null);
  });

  it('状态只返回两个布尔值：读了没、打卡了没', async () => {
    await service.join('u1', PID, NOW);
    await service.join('u2', PID, NOW);
    checkins.docs.push({ userId: 'u1' });
    completions.docs.push({ userId: 'u2' });
    const s = await service.getState('u2', PID, NOW);
    expect(s.buddy).to.deep.equal({ nickname: '小一', avatar: '', avatarUrl: 'a1', readToday: true, checkedInToday: true });
    expect(s.me).to.deep.equal({ readToday: true, checkedInToday: false });
  });

  it('非法 periodId 返回 400 而不是抛 CastError', async () => {
    for (const fn of ['getState', 'join', 'cancel', 'leave', 'nudge']) {
      let err;
      try { await service[fn]('u1', 'not-an-id', NOW); } catch (e) { err = e; }
      expect(err.status, fn).to.equal(400);
    }
  });

  it('创建配对撞键且自己已在别的一对里时，自己的申请不回到等待', async () => {
    await service.join('u1', PID, NOW);
    const realCreate = pairs.create;
    pairs.create = async data => {
      // 模拟并发：自己此刻已被别处配进了一对
      pairs.docs.push({ _id: nextId(), periodId: PID, active: true, members: ['u2', 'u3'] });
      return realCreate(data);
    };
    await service.join('u2', PID, NOW);
    pairs.create = realCreate;
    expect(requests.docs.filter(r => r.userId === 'u2' && r.status === 'waiting')).to.have.length(0);
    expect(requests.docs.find(r => r.userId === 'u1').status).to.equal('waiting');
  });

  it('放回等待时撞到本人新的等待记录，旧记录标成 cancelled 而不报错', async () => {
    await service.join('u1', PID, NOW);
    const old = requests.docs.find(r => r.userId === 'u1');
    old.status = 'matched';
    requests.docs.push({ _id: nextId(), userId: 'u1', periodId: PID, status: 'waiting' });
    const realUpdate = requests.updateOne;
    requests.updateOne = async (q, update) => {
      if (update.$set.status === 'waiting') throw dup();
      return realUpdate(q, update);
    };
    pairs.create = async () => { throw dup(); };
    // u2 认领 u1 的旧记录失败回退路径：直接走 join 触发 releaseClaim
    old.status = 'waiting';
    requests.docs.splice(requests.docs.indexOf(requests.docs[requests.docs.length - 1]), 1);
    const result = await service.join('u2', PID, NOW);
    expect(result.state).to.not.equal(undefined);
    expect(old.status).to.equal('cancelled');
  });

  it('canJoin：进行中且没有配对时为 true（等待中也能去挑人），期次结束后为 false', async () => {
    expect((await service.getState('u1', PID, NOW)).canJoin).to.equal(true);
    expect((await service.join('u1', PID, NOW)).canJoin).to.equal(true);
    const paired = await service.join('u2', PID, NOW);
    expect(paired.canJoin).to.equal(false);
    const left = await service.leave('u2', PID, NOW);
    expect(left.state).to.equal('ended');
    expect(left.canJoin).to.equal(true);
    ongoing = false;
    expect((await service.getState('u2', PID, NOW)).canJoin).to.equal(false);
    expect((await service.getState('u3', PID, NOW)).canJoin).to.equal(false);
  });

  describe('nudge', () => {
    beforeEach(async () => {
      await service.join('u1', PID, NOW);
      await service.join('u2', PID, NOW);
    });

    it('轻拍成功返回通知对象，每人每天只能一次', async () => {
      const result = await service.nudge('u2', PID, NOW);
      expect(result.buddyUserId).to.equal('u1');
      expect(result.senderName).to.equal('小二');
      expect(result.state.nudgedToday).to.equal(true);
      let err;
      try { await service.nudge('u2', PID, NOW); } catch (e) { err = e; }
      expect(err.message).to.equal('今天已经拍过了');
    });

    it('对方先拍不影响自己今天还能拍一次', async () => {
      await service.nudge('u1', PID, NOW);
      const result = await service.nudge('u2', PID, NOW);
      expect(result.buddyUserId).to.equal('u1');
    });

    it('第二天可以再拍', async () => {
      await service.nudge('u2', PID, NOW);
      const next = await service.nudge('u2', PID, new Date('2026-11-11T09:00:00+08:00'));
      expect(next.state.nudgedToday).to.equal(true);
    });

    it('东八区跨日边界：UTC 同一天但东八区不同天可以各拍一次', async () => {
      await service.nudge('u2', PID, new Date('2026-11-10T15:00:00Z')); // 东八区 23:00 十号
      const next = await service.nudge('u2', PID, new Date('2026-11-10T17:00:00Z')); // 十一号 01:00
      expect(next.state.nudgedToday).to.equal(true);
    });

    it('对方今天已读或已打卡时不能轻拍', async () => {
      completions.docs.push({ userId: 'u1' });
      let err;
      try { await service.nudge('u2', PID, NOW); } catch (e) { err = e; }
      expect(err.message).to.equal('TA 今天已经读过了');
      expect(pairs.docs[0].nudgeLog || []).to.have.length(0);
    });

    it('没有读伴时不能轻拍', async () => {
      let err;
      try { await service.nudge('u3', PID, NOW); } catch (e) { err = e; }
      expect(err.status).to.equal(400);
    });
  });
  describe('状态补充信息', () => {
    it('配对后带上期次名和结伴第几天', async () => {
      await service.join('u1', PID, NOW);
      const state = await service.join('u2', PID, NOW);
      expect(state.periodName).to.equal('连接之力');
      expect(state.pairedDay).to.equal(1);
      expect(state.bothDone).to.equal(false);
      expect(state.canGift).to.equal(true);
      expect(state.giftFromBuddy).to.equal(null);
    });

    it('没有读伴时返回正在等待的人数', async () => {
      await service.join('u1', PID, NOW);
      const state = await service.getState('u2', PID, NOW);
      expect(state.state).to.equal('none');
      expect(state.waitingCount).to.equal(1);
    });
  });

  describe('highFive 击掌', () => {
    beforeEach(async () => {
      await service.join('u1', PID, NOW);
      await service.join('u2', PID, NOW);
    });

    it('对方还没读完时不能击掌', async () => {
      completions.docs.push({ userId: 'u2' });
      let err;
      try { await service.highFive('u2', PID, NOW); } catch (e) { err = e; }
      expect(err.status).to.equal(400);
      expect(err.message).to.equal('要等你们都读完，才能击掌');
      expect(pairs.docs[0].highFiveLog || []).to.have.length(0);
    });

    it('两人都读完后可以击掌，每人每天一次', async () => {
      completions.docs.push({ userId: 'u1' }, { userId: 'u2' });
      const before = await service.getState('u2', PID, NOW);
      expect(before.canHighFive).to.equal(true);
      const result = await service.highFive('u2', PID, NOW);
      expect(result.buddyUserId).to.equal('u1');
      expect(result.senderName).to.equal('小二');
      expect(result.state.highFivedToday).to.equal(true);
      expect(result.state.canHighFive).to.equal(false);
      let err;
      try { await service.highFive('u2', PID, NOW); } catch (e) { err = e; }
      expect(err.message).to.equal('今天已经击过掌了');
      // 对方也能击一次，并且看得到对方击过了
      const seen = await service.getState('u1', PID, NOW);
      expect(seen.buddyHighFivedToday).to.equal(true);
      expect(seen.canHighFive).to.equal(true);
    });

    it('没有读伴时不能击掌', async () => {
      let err;
      try { await service.highFive('u3', PID, NOW); } catch (e) { err = e; }
      expect(err.status).to.equal(400);
    });
  });

  describe('gift 送一句', () => {
    beforeEach(async () => {
      await service.join('u1', PID, NOW);
      await service.join('u2', PID, NOW);
    });

    it('只接受预设短句，不接受自由输入', async () => {
      for (const key of ['随便写点什么', undefined, '__proto__', 'toString']) {
        let err;
        try { await service.gift('u2', PID, key, NOW); } catch (e) { err = e; }
        expect(err.status, String(key)).to.equal(400);
      }
      expect(pairs.docs[0].gifts || []).to.have.length(0);
    });

    it('送出后对方当天能看到，每人每天一句，第二天可以再送', async () => {
      const result = await service.gift('u2', PID, 'noRush', NOW);
      expect(result.buddyUserId).to.equal('u1');
      expect(result.giftText).to.equal('不用赶，我在这儿。');
      expect(result.state.giftSentToday).to.equal('不用赶，我在这儿。');
      expect(result.state.canGift).to.equal(false);

      let err;
      try { await service.gift('u2', PID, 'here', NOW); } catch (e) { err = e; }
      expect(err.message).to.equal('今天已经送过一句了');

      const seen = await service.getState('u1', PID, NOW);
      expect(seen.giftFromBuddy).to.deep.equal({ text: '不用赶，我在这儿。' });
      expect(seen.canGift).to.equal(true);

      const nextDay = await service.gift('u2', PID, 'here', new Date('2026-11-11T09:00:00+08:00'));
      expect(nextDay.state.canGift).to.equal(false);
      // 昨天的那句不会出现在今天
      const tomorrow = await service.getState('u1', PID, new Date('2026-11-11T09:00:00+08:00'));
      expect(tomorrow.giftFromBuddy.text).to.equal('今天有你一起读，真好。');
    });
  });

  describe('overview 同行足迹', () => {
    it('返回每天一格的足迹和时间线，共同天数只统计结伴之后', async () => {
      periodDoc = { _id: PID, name: '连接之力', startDate: new Date('2026-11-08T00:00:00+08:00'), endDate: new Date('2026-11-12T00:00:00+08:00') };
      await service.join('u1', PID, NOW);
      await service.join('u2', PID, NOW);
      pairs.docs[0].createdAt = new Date('2026-11-10T08:00:00+08:00');
      // 结伴之前两人都读过一天（11-09）；结伴当天都读完（11-10）
      completions.docs.push(
        { userId: 'u1', completedAt: new Date('2026-11-09T07:00:00+08:00') },
        { userId: 'u2', completedAt: new Date('2026-11-09T07:00:00+08:00') },
        { userId: 'u1', completedAt: new Date('2026-11-10T07:00:00+08:00') },
        { userId: 'u2', completedAt: new Date('2026-11-10T07:30:00+08:00') }
      );
      await service.highFive('u2', PID, NOW);
      await service.gift('u1', PID, 'reread', NOW);

      const overview = await service.getOverview('u2', PID, NOW);
      expect(overview.sharedDays).to.equal(1);
      expect(overview.highFiveCount).to.equal(1);
      expect(overview.giftCount).to.equal(1);
      expect(overview.trail.map(t => t.status)).to.deep.equal(['before', 'before', 'both', 'none', 'none']);
      expect(overview.trail[2].isToday).to.equal(true);
      expect(overview.trail[3].future).to.equal(true);
      const texts = overview.timeline.map(t => t.text);
      expect(texts).to.include('你们成为读伴');
      expect(texts).to.include('第一次在同一天读完');
      expect(texts).to.include('你向小一击了个掌');
      expect(texts).to.include('小一送你一句：「你写的那段，我读了两遍。」');
    });
  });

  describe('souvenir 与续伴', () => {
    beforeEach(async () => {
      await service.join('u1', PID, NOW);
      await service.join('u2', PID, NOW);
    });

    it('没有读伴时不能看纪念', async () => {
      let err;
      try { await service.getSouvenir('u3', PID, NOW); } catch (e) { err = e; }
      expect(err.status).to.equal(400);
    });

    it('纪念里有天数、击掌次数和对方送的第一句', async () => {
      completions.docs.push({ userId: 'u1', completedAt: NOW }, { userId: 'u2', completedAt: NOW });
      await service.highFive('u1', PID, NOW);
      await service.gift('u1', PID, 'noRush', NOW);
      const souvenir = await service.getSouvenir('u2', PID, NOW);
      expect(souvenir.buddy.nickname).to.equal('小一');
      expect(souvenir.buddy).to.not.have.property('userId');
      expect(souvenir.togetherDays).to.equal(1);
      expect(souvenir.sharedDays).to.equal(1);
      expect(souvenir.highFiveCount).to.equal(1);
      expect(souvenir.firstGift).to.deep.equal({ text: '不用赶，我在这儿。' });
    });

    it('续伴意愿：只有双方都点了才对外可见', async () => {
      const mine = await service.rematch('u1', PID, NOW);
      expect(mine.rematch).to.deep.equal({ mine: true, both: false });
      expect(mine.canRematch).to.equal(false);

      const theirs = await service.getSouvenir('u2', PID, NOW);
      expect(theirs.rematch).to.deep.equal({ mine: false, both: false });
      expect(theirs.canRematch).to.equal(true);

      // 重复点不会重复记录
      await service.rematch('u1', PID, NOW);
      expect(pairs.docs[0].rematchVotes).to.have.length(1);

      const both = await service.rematch('u2', PID, NOW);
      expect(both.rematch).to.deep.equal({ mine: true, both: true });
    });

    it('下一期双方都点过续伴时，任意一方申请就直接配成一对', async () => {
      await service.rematch('u1', PID, NOW);
      await service.rematch('u2', PID, NOW);
      const state = await service.join('u2', PID2, NOW);
      expect(state.state).to.equal('paired');
      expect(state.buddy.nickname).to.equal('小一');
      expect(pairs.docs.filter(d => d.periodId === PID2 && d.active)).to.have.length(1);
    });

    it('只有一方点了续伴时，下一期仍然走正常等待', async () => {
      await service.rematch('u1', PID, NOW);
      const state = await service.join('u2', PID2, NOW);
      expect(state.state).to.equal('waiting');
      expect(pairs.docs.filter(d => d.periodId === PID2)).to.have.length(0);
    });

    it('对方没有报名下一期时不会配成一对', async () => {
      await service.rematch('u1', PID, NOW);
      await service.rematch('u2', PID, NOW);
      enrolled.delete('u1');
      const state = await service.join('u2', PID2, NOW);
      expect(state.state).to.equal('waiting');
    });
  });
  describe('react 读伴回应', () => {
    beforeEach(async () => {
      await service.join('u1', PID, NOW);
      await service.join('u2', PID, NOW);
      // u1 写了一篇公开打卡
      checkins.docs.push({ _id: 'c1', userId: 'u1', sectionId: 's1', isPublic: true, checkinDate: NOW });
    });

    it('只接受预设短句', async () => {
      for (const key of ['随便写', undefined, '__proto__']) {
        let err;
        try { await service.react('u2', PID, '64b0000000000000000000c1', key, NOW); } catch (e) { err = e; }
        expect(err.status, String(key)).to.equal(400);
      }
    });

    it('回应读伴的打卡：成功返回通知所需信息，同一篇只能回应一次', async () => {
      checkins.docs[0]._id = '64b0000000000000000000c1';
      const result = await service.react('u2', PID, '64b0000000000000000000c1', 'moved', NOW);
      expect(result.buddyUserId).to.equal('u1');
      expect(result.senderName).to.equal('小二');
      expect(result.reactionText).to.equal('这句也打动我。');
      expect(result.sectionId).to.equal('s1');
      expect(reactions.docs).to.have.length(1);
      expect(reactions.docs[0]).to.include({ fromUserId: 'u2', toUserId: 'u1', key: 'moved', dayKey: '2026-11-10' });

      let err;
      try { await service.react('u2', PID, '64b0000000000000000000c1', 'glad', NOW); } catch (e) { err = e; }
      expect(err.message).to.equal('这一篇已经回应过了');
    });

    it('不是读伴的打卡、私密打卡、没有读伴时都不能回应', async () => {
      checkins.docs[0]._id = '64b0000000000000000000c1';
      let err;
      try { await service.react('u2', PID, '64b0000000000000000000c9', 'moved', NOW); } catch (e) { err = e; }
      expect(err.status).to.equal(404);

      checkins.docs[0].isPublic = false;
      err = null;
      try { await service.react('u2', PID, '64b0000000000000000000c1', 'moved', NOW); } catch (e) { err = e; }
      expect(err.status).to.equal(404);

      err = null;
      try { await service.react('u3', PID, '64b0000000000000000000c1', 'moved', NOW); } catch (e) { err = e; }
      expect(err.status).to.equal(400);
    });

    it('读伴今天写了打卡、还没回应时，状态里提示去读；回应后不再提示', async () => {
      checkins.docs[0]._id = '64b0000000000000000000c1';
      const before = await service.getState('u2', PID, NOW);
      expect(before.buddyCheckinToday).to.deep.equal({ checkinId: '64b0000000000000000000c1', sectionId: 's1' });
      await service.react('u2', PID, '64b0000000000000000000c1', 'thanks', NOW);
      const after = await service.getState('u2', PID, NOW);
      expect(after.buddyCheckinToday).to.equal(null);
    });

    it('对方今天回应了我的打卡，状态里带上那句话', async () => {
      checkins.docs.push({ _id: '64b0000000000000000000c2', userId: 'u2', sectionId: 's1', isPublic: true, checkinDate: NOW });
      await service.react('u1', PID, '64b0000000000000000000c2', 'glad', NOW);
      const state = await service.getState('u2', PID, NOW);
      expect(state.buddyReactionToday).to.deep.equal({ text: '为你高兴。' });
    });

    it('概览里标出我回应过哪一篇、哪一篇是新的，回应进时间线和计数', async () => {
      checkins.docs[0]._id = '64b0000000000000000000c1';
      let overview = await service.getOverview('u2', PID, NOW);
      expect(overview.publicCheckins[0]).to.include({ myReaction: '', isNew: true });
      await service.react('u2', PID, '64b0000000000000000000c1', 'slow', NOW);
      checkins.docs.push({ _id: '64b0000000000000000000c2', userId: 'u2', sectionId: 's1', isPublic: true, checkinDate: NOW });
      await service.react('u1', PID, '64b0000000000000000000c2', 'glad', NOW);

      overview = await service.getOverview('u2', PID, NOW);
      expect(overview.publicCheckins[0]).to.include({ myReaction: '我读到了，读得很慢。', isNew: false });
      expect(overview.reactionCount).to.equal(2);
      const texts = overview.timeline.map(t => t.text);
      expect(texts).to.include('你回应了小一的打卡：「我读到了，读得很慢。」');
      expect(texts).to.include('小一回应了你的打卡：「为你高兴。」');
    });
  });

  describe('读伴标记查询', () => {
    it('getBuddyMap 返回期次里互为读伴的两个人，getActiveBuddyId 取对方', async () => {
      await service.join('u1', PID, NOW);
      await service.join('u2', PID, NOW);
      pairs.docs[0].periodId = PID;
      const map = await service.getBuddyMap([PID, 'bad-id']);
      expect(map.get(`${PID}:u1`)).to.equal('u2');
      expect(map.get(`${PID}:u2`)).to.equal('u1');
      expect(await service.getActiveBuddyId('u1', PID)).to.equal('u2');
      expect(await service.getActiveBuddyId('u3', PID)).to.equal(null);
      expect((await service.getBuddyMap([])).size).to.equal(0);
    });
  });
  describe('邀请读伴：从本期学员里挑', () => {
    const U2 = '64b0000000000000000000a2';
    // 用真实格式的用户 ID，邀请接口会校验 ObjectId 格式
    beforeEach(() => {
      ['u1', 'u2', 'u3', 'u4'].forEach((id, i) => {
        const real = `64b0000000000000000000a${i + 1}`;
        users[real] = { ...users[id], _id: real };
        usersModel.docs.push(users[real]);
        enrolled.add(real);
      });
    });
    const A1 = '64b0000000000000000000a1';
    const A2 = '64b0000000000000000000a2';
    const A3 = '64b0000000000000000000a3';
    const A4 = '64b0000000000000000000a4';

    it('候选名单：本期学员里没有读伴的人，排除自己，可按昵称搜，标出已邀请的', async () => {
      await service.invite(A1, PID, A2, NOW);
      await service.respondInvite(A2, PID, invites.docs[0]._id, true, NOW); // A1、A2 已结伴，不再出现
      await service.invite(A3, PID, A4, NOW);
      const all = (await service.listCandidates(A3, PID, {}, NOW)).list;
      const ids = all.map(c => c.userId);
      expect(ids).to.include(A4);
      expect(ids).to.not.include(A3);
      expect(ids).to.not.include(A1);
      expect(ids).to.not.include(A2);
      expect(all.find(c => c.userId === A4).invited).to.equal(true);
      const found = (await service.listCandidates(A3, PID, { q: '四' }, NOW)).list;
      expect(found.map(c => c.userId)).to.include(A4);
      expect(found.every(c => c.nickname.includes('四'))).to.equal(true);
    });

    it('邀请：对方还没有读伴、也在本期，发出一条待回复的邀请', async () => {
      const result = await service.invite(A1, PID, A2, NOW);
      expect(result.targetUserId).to.equal(A2);
      expect(result.senderName).to.equal('小一');
      expect(invites.docs).to.have.length(1);
      expect(invites.docs[0].status).to.equal('pending');
      const mine = await service.getState(A1, PID, NOW);
      expect(mine.invitesSent.map(i => i.nickname)).to.deep.equal(['小二']);
      const theirs = await service.getState(A2, PID, NOW);
      expect(theirs.invitesReceived.map(i => i.nickname)).to.deep.equal(['小一']);
      expect(theirs.invitesReceived[0]).to.not.have.property('userId');
    });

    it('等待中的人也能看到选人入口，发出邀请后不再等自动配对', async () => {
      await service.join(A1, PID, NOW);
      const waitingState = await service.getState(A1, PID, NOW);
      expect(waitingState.state).to.equal('waiting');
      expect(waitingState.canJoin).to.equal(true);

      await service.invite(A1, PID, A2, NOW);
      expect(requests.docs.find(r => r.userId === A1).status).to.equal('cancelled');
      const next = await service.getState(A1, PID, NOW);
      expect(next.state).to.equal('none');
      expect(next.invitesSent).to.have.length(1);
    });

    it('不能邀请自己、不在本期的人、已经有读伴的人，重复邀请也不行', async () => {
      const fail = async (...args) => { try { await service.invite(...args); } catch (e) { return e; } return null; };
      expect((await fail(A1, PID, A1, NOW)).message).to.equal('不能邀请自己');
      expect((await fail(A1, PID, 'bad', NOW)).status).to.equal(400);
      enrolled.delete(A4);
      expect((await fail(A1, PID, A4, NOW)).status).to.equal(404);
      await service.invite(A1, PID, A2, NOW);
      expect((await fail(A1, PID, A2, NOW)).message).to.equal('已经邀请过 TA 了，等 TA 回复');
      await service.join('u3', PID, NOW);
      await service.join('u2', PID, NOW);
      expect((await fail(A1, PID, 'u3'.length ? '64b0000000000000000000ff' : '', NOW)).status).to.equal(404);
    });

    it('同时最多 5 条待回复的邀请', async () => {
      for (let i = 0; i < 5; i += 1) {
        const id = `64b0000000000000000001${i}0`;
        users[id] = { _id: id, nickname: `学员${i}` };
        enrolled.add(id);
        await service.invite(A1, PID, id, NOW);
      }
      let err;
      try { await service.invite(A1, PID, A2, NOW); } catch (e) { err = e; }
      expect(err.message).to.include('最多邀请 5 位');
    });

    it('对方同意后结成读伴，其余待回复的邀请和等待申请作废', async () => {
      await service.invite(A1, PID, A2, NOW);
      await service.invite(A3, PID, A2, NOW);
      await service.invite(A1, PID, A4, NOW);
      const inviteId = invites.docs[0]._id;
      const result = await service.respondInvite(A2, PID, inviteId, true, NOW);
      expect(result.accepted).to.equal(true);
      expect(result.buddyUserId).to.equal(A1);
      expect(result.state.state).to.equal('paired');
      expect(result.state.buddy.nickname).to.equal('小一');
      expect(invites.docs[0].status).to.equal('accepted');
      expect(invites.docs.slice(1).every(d => d.status === 'cancelled')).to.equal(true);
      expect((await service.getState(A1, PID, NOW)).state).to.equal('paired');
    });

    it('同意之前对方已经有别的读伴：邀请作废，不会结成', async () => {
      await service.invite(A1, PID, A2, NOW);
      await service.join('u1', PID, NOW);
      await service.join('u3', PID, NOW); // u1 与 u3 结成另一对
      pairs.docs.forEach(d => { d.members = d.members.map(m => (m === 'u1' ? A1 : m)); });
      let err;
      try { await service.respondInvite(A2, PID, invites.docs[0]._id, true, NOW); } catch (e) { err = e; }
      expect(err.message).to.equal('TA 已经有别的读伴了');
      expect(invites.docs[0].status).to.equal('cancelled');
    });

    it('婉拒：邀请标为已婉拒，不结伴，也不能再次处理', async () => {
      await service.invite(A1, PID, A2, NOW);
      const inviteId = invites.docs[0]._id;
      const result = await service.respondInvite(A2, PID, inviteId, false, NOW);
      expect(result.declined).to.equal(true);
      expect(invites.docs[0].status).to.equal('declined');
      expect(result.state.state).to.not.equal('paired');
      let err;
      try { await service.respondInvite(A2, PID, inviteId, true, NOW); } catch (e) { err = e; }
      expect(err.status).to.equal(404);
    });

    it('只有收到邀请的人能处理；发出的人可以撤回', async () => {
      await service.invite(A1, PID, A2, NOW);
      const inviteId = invites.docs[0]._id;
      let err;
      try { await service.respondInvite(A3, PID, inviteId, true, NOW); } catch (e) { err = e; }
      expect(err.status).to.equal(404);
      const state = await service.cancelInvite(A1, PID, inviteId, NOW);
      expect(invites.docs[0].status).to.equal('cancelled');
      expect(state.invitesSent).to.deep.equal([]);
    });

    it('已经有读伴的人要先结束，才能邀请别人；结束后可以重新邀请同一个人', async () => {
      await service.invite(A1, PID, A2, NOW);
      await service.respondInvite(A2, PID, invites.docs[0]._id, true, NOW);
      let err;
      try { await service.invite(A1, PID, A3, NOW); } catch (e) { err = e; }
      expect(err.message).to.equal('你现在已经有读伴了，先结束这一段再邀请别人');
      await service.leave(A1, PID, NOW);
      const again = await service.invite(A1, PID, A2, NOW);
      expect(again.targetUserId).to.equal(A2);
    });

    it('对方先邀请了我，我再邀请对方，直接结成读伴', async () => {
      await service.invite(A2, PID, A1, NOW);
      const result = await service.invite(A1, PID, A2, NOW);
      expect(result.autoAccepted).to.equal(true);
      expect(result.state.state).to.equal('paired');
    });

    it('邀请当前状态查询：已同意、已婉拒、不存在', async () => {
      await service.invite(A1, PID, A2, NOW);
      const id = invites.docs[0]._id;
      expect(await service.getInviteStatuses([id, 'bad'])).to.deep.equal({ [id]: 'pending' });
      await service.respondInvite(A2, PID, id, false, NOW);
      expect((await service.getInviteStatuses([id]))[id]).to.equal('declined');
      expect(await service.getInviteStatuses([])).to.deep.equal({});
    });
  });
  describe('邀请的过期、结果、不出现在名单、名单排序翻页', () => {
    const B1 = '64b0000000000000000000b1';
    const B2 = '64b0000000000000000000b2';
    const B3 = '64b0000000000000000000b3';
    const B4 = '64b0000000000000000000b4';
    beforeEach(() => {
      [[B1, '甲', 0], [B2, '乙', 5], [B3, '丙', 2], [B4, '丁', 0]].forEach(([id, nickname, streak]) => {
        users[id] = { _id: id, nickname, currentStreak: streak };
        const stale = usersModel.docs.findIndex(d => d._id === id);
        if (stale >= 0) usersModel.docs.splice(stale, 1);
        usersModel.docs.push(users[id]);
        enrolled.add(id);
      });
    });

    it('7 天没回复的邀请过期：不再显示、不能同意、不占名额，也不挡住重新邀请', async () => {
      await service.invite(B1, PID, B2, NOW);
      const doc = invites.docs[0];
      doc.createdAt = new Date(NOW.getTime() - 8 * 86400000);
      expect((await service.getState(B2, PID, NOW)).invitesReceived).to.deep.equal([]);
      expect((await service.getState(B1, PID, NOW)).invitesSent).to.deep.equal([]);
      expect((await service.getInviteStatuses([doc._id], NOW))[doc._id]).to.equal('expired');
      let err;
      try { await service.respondInvite(B2, PID, doc._id, true, NOW); } catch (e) { err = e; }
      expect(err.message).to.equal('这条邀请已经过期了');
      expect(doc.status).to.equal('expired');
      const again = await service.invite(B1, PID, B2, NOW);
      expect(again.targetUserId).to.equal(B2);
    });

    it('婉拒后，邀请人一天内能看到「被婉拒」的结果，之后消失；不占 5 条名额', async () => {
      await service.invite(B1, PID, B2, NOW);
      await service.respondInvite(B2, PID, invites.docs[0]._id, false, NOW);
      const sent = (await service.getState(B1, PID, NOW)).invitesSent;
      expect(sent.map(i => [i.nickname, i.status])).to.deep.equal([['乙', 'declined']]);
      invites.docs[0].updatedAt = new Date(NOW.getTime() - 2 * 86400000);
      expect((await service.getState(B1, PID, NOW)).invitesSent).to.deep.equal([]);
    });

    it('选择「不出现在名单里」后，别人看不到、也邀请不了；可以再打开', async () => {
      expect((await service.getState(B3, PID, NOW)).discoverable).to.equal(true);
      await service.setDiscoverable(B3, false);
      expect((await service.getState(B3, PID, NOW)).discoverable).to.equal(false);
      const list = (await service.listCandidates(B1, PID, {}, NOW)).list;
      expect(list.map(c => c.userId)).to.not.include(B3);
      let err;
      try { await service.invite(B1, PID, B3, NOW); } catch (e) { err = e; }
      expect(err.message).to.equal('TA 暂时不接受读伴邀请');
      await service.setDiscoverable(B3, true);
      expect((await service.listCandidates(B1, PID, {}, NOW)).list.map(c => c.userId)).to.include(B3);
    });

    it('名单排序：最近读过的在前，再按连续天数，再按昵称；标出也在找读伴的人', async () => {
      completions.docs.push({ userId: B4, completedAt: NOW });
      await service.join('u3', PID, NOW);
      const list = (await service.listCandidates(B1, PID, {}, NOW)).list;
      const order = list.map(c => c.userId);
      expect(order[0]).to.equal(B4); // 只有丁最近读过
      expect(order.indexOf(B2)).to.be.below(order.indexOf(B3)); // 乙连续 5 天，丙 2 天
      expect(list.find(c => c.userId === B2).streak).to.equal(5);
      expect(list.find(c => c.userId === 'u3').waiting).to.equal(true);
    });

    it('名单分页：每页 20 位，有下一页时 hasMore 为 true', async () => {
      for (let i = 0; i < 25; i += 1) {
        const id = `64b0000000000000000002${String(i).padStart(2, '0')}`;
        users[id] = { _id: id, nickname: `学员${String(i).padStart(2, '0')}` };
        const stale = usersModel.docs.findIndex(d => d._id === id);
        if (stale >= 0) usersModel.docs.splice(stale, 1);
        usersModel.docs.push(users[id]);
        enrolled.add(id);
      }
      const first = await service.listCandidates(B1, PID, { page: 1 }, NOW);
      const second = await service.listCandidates(B1, PID, { page: 2 }, NOW);
      expect(first.list).to.have.length(20);
      expect(first.hasMore).to.equal(true);
      expect(second.list.length).to.be.above(0);
      expect(new Set([...first.list, ...second.list].map(c => c.userId)).size).to.equal(first.list.length + second.list.length);
    });

    it('邀请里的用户信息是批量查的，不是每条各查一次', async () => {
      await service.invite(B1, PID, B2, NOW);
      await service.invite(B1, PID, B3, NOW);
      await service.invite(B1, PID, B4, NOW);
      const before = usersModel.docs.length;
      const findCalls = [];
      const realFind = usersModel.find;
      usersModel.find = q => { findCalls.push(q); return realFind(q); };
      const state = await service.getState(B1, PID, NOW);
      usersModel.find = realFind;
      expect(state.invitesSent).to.have.length(3);
      expect(findCalls.filter(q => q._id && q._id.$in)).to.have.length(1);
      expect(usersModel.docs.length).to.equal(before);
    });
  });
});
