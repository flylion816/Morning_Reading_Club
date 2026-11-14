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

  it('还没开营时只返回 period 与 daysLeft', async () => {
    stubs.Period.findById = () => chain({ _id: 'p1', name: 'P', status: 'ongoing', startDate: new Date('2026-11-18T00:00:00Z'), endDate: new Date('2026-11-20T00:00:00Z') });
    service = load();
    const data = await service.getPeriodKeepsake('me', 'p1', new Date('2026-11-15T04:00:00Z'));
    expect(data.ready).to.equal(false);
    expect(data.notStarted).to.equal(true);
    expect(data.daysLeft).to.equal(5);
    expect(data.checkinDays).to.equal(undefined);
  });

  it('营期进行中也能翻：ready 为 true、finished 为 false，并带上还剩几天', async () => {
    stubs.Period.findById = () => chain({ _id: 'p1', name: 'P', status: 'ongoing', startDate: new Date('2026-11-10T00:00:00Z'), endDate: new Date('2026-11-20T00:00:00Z') });
    service = load();
    const data = await service.getPeriodKeepsake('me', 'p1', new Date('2026-11-15T04:00:00Z'));
    expect(data.ready).to.equal(true);
    expect(data.finished).to.equal(false);
    expect(data.daysLeft).to.equal(5);
    expect(data.checkinDays).to.equal(3);
  });

  it('每一天按时间从早到晚列出打卡，小凡的信全部列出', async () => {
    const data = await service.getPeriodKeepsake('me', 'p1', new Date('2026-11-20T00:00:00Z'));
    expect(data.finished).to.equal(true);
    expect(data.days.map(item => item.checkinId)).to.deep.equal(['c3', 'c1', 'c2']);
    expect(data.days[1]).to.include({ sectionId: 's1', sectionTitle: '第一课', excerpt: '你好世界' });
    expect(data.insights).to.have.length(1);
    expect(data.insights[0]).to.include({ id: 'i1', title: '看见' });
    expect(data.insightExcerpt.id).to.equal('i1');
  });

  it('读伴只给昵称头像和同行天数；实修给出每周做到几天；模型不存在时为空', async () => {
    let data = await service.getPeriodKeepsake('me', 'p1', new Date('2026-11-20T00:00:00Z'));
    expect(data.buddy).to.equal(null);
    expect(data.practices).to.deep.equal([]);

    stubs.optional.BuddyPair = {
      find: () => chain([{ userA: 'me2', userB: 'u9', createdAt: new Date('2026-10-05T02:00:00Z'), endedAt: null, active: true }])
    };
    stubs.optional.Practice = {
      find: () => chain([
        { weekIndex: 1, text: '先听完再说', logs: [{ date: '2026-10-06', done: true }, { date: '2026-10-07', done: false }] },
        { weekIndex: 2, text: '  ', logs: [] }
      ])
    };
    stubs.User.findById = id => chain(id === 'u9' ? { nickname: '阿泰', avatarUrl: 'a.png' } : { nickname: '小明' });
    service = load();
    data = await service.getPeriodKeepsake('me2', 'p1', new Date('2026-11-20T00:00:00Z'));
    // 结束日 10-23 之后仍在一起，只算到结营那天：10-05 到 10-23 共 19 天
    expect(data.buddy).to.deep.equal({ nickname: '阿泰', avatarUrl: 'a.png', days: 19, active: true });
    expect(data.buddy).to.not.have.property('userId');
    expect(data.practices).to.deep.equal([{ weekIndex: 1, text: '先听完再说', loggedDays: 2, doneDays: 1 }]);
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
    expect(data.earliestReading).to.deep.equal({ time: '09:00', date: '2026-10-02' });
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

  it('最早打卡使用实际 checkinDate，不使用较晚的 createdAt 覆盖', async () => {
    stubs.Checkin.find.returns(chain([
      {
        _id: 'imported',
        sectionId: 's1',
        day: 1,
        checkinDate: new Date('2026-09-13T01:57:00Z'),
        createdAt: new Date('2026-09-13T09:57:00Z'),
        note: '补录打卡',
        likes: []
      }
    ]));
    service = load();
    const data = await service.getPeriodKeepsake('me', 'p1', new Date('2026-11-20T00:00:00Z'));
    expect(data.earliestCheckin).to.deep.equal({ time: '09:57', date: '2026-09-13' });
  });

  it('最早晨读优先使用首次进入时间，没有时回退到阅读完成时间', async () => {
    stubs.Completion.find = () => chain([
      {
        startedAt: new Date('2026-09-10T23:15:00Z'),
        completedAt: new Date('2026-09-11T01:00:00Z'),
        durationMs: 60000
      },
      {
        completedAt: new Date('2026-09-11T02:00:00Z'),
        durationMs: 60000
      }
    ]);
    service = load();
    const data = await service.getPeriodKeepsake('me', 'p1', new Date('2026-11-20T00:00:00Z'));
    expect(data.earliestReading).to.deep.equal({ time: '07:15', date: '2026-09-11' });
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

  it('信还没拆或还在路上：只给状态，不给内容', async () => {
    let query;
    stubs.optional.Letter = { find: q => { query = q; return chain([{ content: '秘密', status: 'delivered' }]); } };
    service = load();
    expect((await service.getPeriodKeepsake('me', 'p1')).letter).to.deep.equal({ status: 'delivered' });
    expect(query).to.deep.equal({ userId: 'me', periodId: 'p1', status: { $in: ['sealed', 'delivered', 'opened'] } });
    stubs.optional.Letter = { find: () => chain([{ content: '秘密', status: 'sealed' }]) };
    service = load();
    expect((await service.getPeriodKeepsake('me', 'p1')).letter).to.deep.equal({ status: 'sealed' });
  });

  it('已结束期次缓存主体，但送达、拆信、回信和删除会立即反映在信件上', async () => {
    let letter = { status: 'sealed', content: '信的全文' };
    stubs.optional.Letter = { find: () => chain(letter ? [letter] : []) };
    service = load();
    const now = new Date('2026-11-20T00:00:00Z');

    expect((await service.getPeriodKeepsake('me', 'p1', now)).letter).to.deep.equal({ status: 'sealed' });
    letter.status = 'delivered';
    expect((await service.getPeriodKeepsake('me', 'p1', now)).letter).to.deep.equal({ status: 'delivered' });
    letter = { ...letter, status: 'opened', writtenAt: new Date('2026-10-29T16:30:00Z') };
    let result = await service.getPeriodKeepsake('me', 'p1', now);
    expect(result.letter).to.include({ status: 'opened', content: '信的全文', daysSinceWritten: 21, reply: '' });
    letter.reply = '谢谢那时的自己';
    result = await service.getPeriodKeepsake('me', 'p1', now);
    expect(result.letter.reply).to.equal('谢谢那时的自己');
    letter = null;
    expect((await service.getPeriodKeepsake('me', 'p1', now)).letter).to.equal(null);
    expect(stubs.Checkin.find.callCount).to.equal(1);
  });

  it('没有可靠写信日期时不猜测过去了多少天', async () => {
    stubs.optional.Letter = { find: () => chain([{ status: 'opened', content: '信', writtenAt: 'invalid' }]) };
    service = load();
    const result = await service.getPeriodKeepsake('me', 'p1', new Date('2026-11-20T00:00:00Z'));
    expect(result.letter.daysSinceWritten).to.equal(null);
  });

  it('可选模型存在时读取摘抄、已拆开的信和看见卡数量', async () => {
    stubs.optional.Highlight = { find: () => chain([{ text: '句子' }]) };
    stubs.optional.Letter = { find: () => chain([{ content: '信', sealedAt: 'S', status: 'opened', reply: '回' }]) };
    const countSeenCards = sandbox.stub().resolves(4);
    stubs.optional.SeenCard = { countDocuments: countSeenCards };
    service = load();
    const data = await service.getPeriodKeepsake('me', 'p1');
    expect(data.highlights).to.deep.equal([{ text: '句子' }]);
    expect(data.letter).to.deep.equal({
      status: 'opened', content: '信', writtenAt: null, daysSinceWritten: null, sealedAt: 'S', reply: '回', repliedAt: null
    });
    expect(data.seenCount).to.equal(4);
    expect(countSeenCards.firstCall.args[0]).to.include({ periodId: 'p1', receiverId: 'me', withdrawnAt: null });
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
