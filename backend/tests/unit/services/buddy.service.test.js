const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

// 内存假模型：只实现 buddy.service 用到的查询形态
let seq = 0;
const nextId = () => `id_${String(++seq).padStart(6, '0')}`;
const S = v => (v == null ? v : String(v));

function matchValue(doc, key, cond) {
  const val = doc[key];
  if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
    if ('$lt' in cond) return S(val) < S(cond.$lt);
    if ('$nin' in cond) return !cond.$nin.map(S).includes(S(val));
    if ('$in' in cond) return cond.$in.map(S).includes(S(val));
    if ('$not' in cond) return !(val || []).some(e => Object.keys(cond.$not.$elemMatch).every(k => S(e[k]) === S(cond.$not.$elemMatch[k])));
  }
  if (Array.isArray(val)) return val.map(S).includes(S(cond));
  return S(val) === S(cond);
}
const matches = (doc, q) => Object.keys(q).every(k => matchValue(doc, k, q[k]));

function makeModel(uniqueCheck) {
  const docs = [];
  const chain = result => ({ select: () => chain(result), lean: () => Promise.resolve(result), then: (a, b) => Promise.resolve(result).then(a, b) });
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

describe('buddy.service', () => {
  let pairs;
  let requests;
  let checkins;
  let completions;
  let enrolled;
  let ongoing;
  let service;

  const users = {
    u1: { _id: 'u1', nickname: '小一', avatarUrl: 'a1' },
    u2: { _id: 'u2', nickname: '小二', avatarUrl: 'a2' },
    u3: { _id: 'u3', nickname: '小三', avatarUrl: 'a3' }
  };
  // 2026-11-10 12:00 东八区
  const NOW = new Date('2026-11-10T12:00:00+08:00');

  beforeEach(() => {
    seq = 0;
    enrolled = new Set(['u1', 'u2', 'u3']);
    ongoing = true;
    pairs = makeModel((docs, doc) => {
      if (doc.active && docs.some(d => d.active && d.members.some(m => doc.members.includes(m)))) throw dup();
    });
    requests = makeModel((docs, doc) => {
      if (doc.status === 'waiting' && docs.some(d => d.status === 'waiting' && S(d.userId) === S(doc.userId))) throw dup();
    });
    checkins = makeModel();
    completions = makeModel();
    // Checkin / Completion 的日期过滤在假模型里不区分，测试里直接按 userId 放数据
    const rangeless = model => ({
      find: q => model.find({ userId: q.userId })
    });
    const UserStub = {
      findById: id => ({ select: () => ({ lean: () => Promise.resolve(users[id] || null) }) })
    };
    service = proxyquire('../../../src/services/buddy.service', {
      '../models/BuddyPair': pairs,
      '../models/BuddyRequest': requests,
      '../models/Checkin': rangeless(checkins),
      '../models/UserReadingCompletion': rangeless(completions),
      '../models/User': UserStub,
      '../models/Period': { findById: () => ({ select: () => ({ lean: () => Promise.resolve({ _id: PID }) }) }) },
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

  it('canJoin：进行中且没有配对、不在等待时为 true，期次结束后为 false', async () => {
    expect((await service.getState('u1', PID, NOW)).canJoin).to.equal(true);
    expect((await service.join('u1', PID, NOW)).canJoin).to.equal(false);
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
});
