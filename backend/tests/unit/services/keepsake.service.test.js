const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

const chain = value => {
  const q = { select: () => q, sort: () => q, limit: () => q, lean: () => Promise.resolve(value) };
  return q;
};

describe('Keepsake Service', () => {
  let sandbox;
  let stubs;
  let service;
  const load = () =>
    proxyquire('../../../src/services/keepsake.service', {
      mongoose: { models: stubs.optional },
      '../models/Period': stubs.Period,
      '../models/Checkin': stubs.Checkin,
      '../models/Comment': stubs.Comment,
      '../models/Insight': stubs.Insight,
      '../models/User': stubs.User,
      '../models/UserReadingCompletion': stubs.Completion,
      '../models/Section': stubs.Section,
      '../utils/logger': { warn: () => {}, error: () => {}, info: () => {} }
    });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    stubs = {
      optional: {},
      Period: { findById: () => chain({ _id: 'p1', name: '第十期', totalDays: 23, status: 'completed', startDate: new Date('2026-10-01'), endDate: new Date('2026-10-23') }) },
      Checkin: {
        find: sandbox.stub().returns(chain([
          { _id: 'c1', sectionId: 's1', day: 1, checkinDate: new Date('2026-11-11T22:30:00Z'), createdAt: new Date('2026-11-11T22:30:00Z'), note: '你好世界', likeCount: 2, mood: 'happy', likes: [{ userId: 'u2' }, { userId: 'u3' }] },
          { _id: 'c2', sectionId: 's1', day: 2, checkinDate: new Date('2026-11-12T22:30:00Z'), createdAt: new Date('2026-11-12T22:30:00Z'), contentHtml: '<p>很长很长的内容</p>', likeCount: 0, mood: 'calm', likes: [] },
          { _id: 'c3', sectionId: 's1', day: 3, checkinDate: new Date('2026-10-01T00:00:00Z'), createdAt: new Date('2026-10-01T00:00:00Z'), note: 'x', mood: 'happy', likes: [] }
        ]))
      },
      Comment: { find: () => chain([{ userId: 'u2', replies: [{ userId: 'me' }, { userId: 'u3' }] }, { userId: 'me', replies: [] }]) },
      Insight: { find: () => chain([{ _id: 'i1', title: '看见', content: '<p>' + 'a'.repeat(100) + '</p>' }]) },
      User: {
        findById: () => chain({ nickname: '小明' }),
        find: () => chain([{ _id: 'u2', nickname: 'B', avatarUrl: 'b.png' }, { _id: 'u3', nickname: 'C' }])
      },
      Completion: { find: () => chain([{ durationMs: 90000, completedAt: new Date('2026-10-02T01:00:00Z') }, { durationMs: 60000, completedAt: new Date('2026-10-03T01:00:00Z') }]) },
      Section: { find: () => chain([{ _id: 's1', title: '第一课' }]) }
    };
    service = load();
  });

  afterEach(() => sandbox.restore());

  it('期次未结束时只返回 period 与 daysLeft', async () => {
    stubs.Period.findById = () => chain({ _id: 'p1', name: 'P', status: 'ongoing', endDate: new Date('2026-11-20T00:00:00Z') });
    service = load();
    const data = await service.getPeriodKeepsake('me', 'p1', new Date('2026-11-15T04:00:00Z'));
    expect(data.ready).to.equal(false);
    expect(data.daysLeft).to.equal(5);
    expect(data.checkinDays).to.equal(undefined);
  });

  it('今天已是最后一天时 ready 为 true', () => {
    const r = service.resolveReadiness({ status: 'ongoing', endDate: new Date('2026-11-15T00:00:00Z') }, new Date('2026-11-15T04:00:00Z'));
    expect(r.ready).to.equal(true);
  });

  it('聚合出数字、最早打卡、心情、最佳打卡与书友', async () => {
    const data = await service.getPeriodKeepsake('me', 'p1', new Date('2026-11-20T00:00:00Z'));
    expect(data.ready).to.equal(true);
    expect(data.nickname).to.equal('小明');
    expect(data.checkinDays).to.equal(3);
    expect(data.checkinCount).to.equal(3);
    expect(data.totalWords).to.equal(4 + 7 + 1);
    expect(data.readingMinutes).to.equal(3);
    expect(data.readingDays).to.equal(2);
    expect(data.earliestCheckin).to.deep.equal({ time: '06:30', date: '2026-11-12' });
    expect(data.moods.map(m => m.mood)).to.deep.equal(['happy', 'calm']);
    expect(data.topCheckin.id).to.equal('c1');
    expect(data.topCheckin.sectionTitle).to.equal('第一课');
    expect(data.companions.map(c => c.userId)).to.deep.equal(['u2', 'u3']);
    expect(data.companions[0].count).to.equal(2);
    expect(data.insightExcerpt.excerpt.length).to.be.at.most(81);
    expect(data.highlights).to.deep.equal([]);
    expect(data.letter).to.equal(null);
    expect(data.seenCount).to.equal(0);
  });

  it('没有赞时取最长的一篇，没有打卡时 topCheckin 为 null', async () => {
    stubs.Checkin.find.returns(chain([
      { _id: 'a', sectionId: 's1', day: 1, checkinDate: new Date('2026-11-12T01:00:00Z'), note: '短' },
      { _id: 'b', sectionId: 's1', day: 2, checkinDate: new Date('2026-11-13T01:00:00Z'), note: '长长长长' }
    ]));
    service = load();
    expect((await service.getPeriodKeepsake('me', 'p1')).topCheckin.id).to.equal('b');
    stubs.Checkin.find.returns(chain([]));
    service = load();
    expect((await service.getPeriodKeepsake('me', 'p1')).topCheckin).to.equal(null);
  });

  it('可选模型存在时读取摘抄、已拆开的信和看见卡数量', async () => {
    stubs.optional.Highlight = { find: () => chain([{ text: '句子' }]) };
    stubs.optional.Letter = { find: () => chain([{ content: '信', sealedAt: 'S', status: 'opened', reply: '回' }]) };
    stubs.optional.SeenCard = { countDocuments: () => Promise.resolve(4) };
    service = load();
    const data = await service.getPeriodKeepsake('me', 'p1');
    expect(data.highlights).to.deep.equal([{ text: '句子' }]);
    expect(data.letter).to.deep.equal({ content: '信', sealedAt: 'S', reply: '回' });
    expect(data.seenCount).to.equal(4);
  });

  it('某一块失败不影响整体', async () => {
    stubs.Comment.find = () => { throw new Error('boom'); };
    service = load();
    const data = await service.getPeriodKeepsake('me', 'p1');
    expect(data.companions).to.deep.equal([]);
    expect(data.checkinDays).to.equal(3);
  });

  it('已结束的期次结果会缓存', async () => {
    await service.getPeriodKeepsake('me', 'p1');
    await service.getPeriodKeepsake('me', 'p1');
    expect(stubs.Checkin.find.callCount).to.equal(1);
  });

  it('缓存清理过期项并限制条数', async () => {
    const t0 = new Date('2026-11-20T00:00:00Z');
    for (let i = 0; i < service.CACHE_MAX_ENTRIES + 5; i++) {
      await service.getPeriodKeepsake(`u${i}`, 'p1', t0);
    }
    expect(service.getCacheSize()).to.equal(service.CACHE_MAX_ENTRIES);
    await service.getPeriodKeepsake('late', 'p1', new Date(t0.getTime() + 11 * 60 * 1000));
    expect(service.getCacheSize()).to.equal(1);
  });

  it('期次不存在返回 null', async () => {
    stubs.Period.findById = () => chain(null);
    service = load();
    expect(await service.getPeriodKeepsake('me', 'x')).to.equal(null);
  });
});
