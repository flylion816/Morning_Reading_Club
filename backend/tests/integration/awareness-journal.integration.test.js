const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Tenant = require('../../src/models/Tenant');
const User = require('../../src/models/User');
const Period = require('../../src/models/Period');
const Section = require('../../src/models/Section');
const Enrollment = require('../../src/models/Enrollment');
const JoyNote = require('../../src/models/JoyNote');
const Notification = require('../../src/models/Notification');
const revisitService = require('../../src/services/awareness-revisit.service');
const { withSystemContext } = require('../../src/utils/tenantContext');
const { generateAccessToken } = require('../../src/utils/jwt');

describe('觉察日记：实际接口、隔离与一周后回访', function () {
  this.timeout(30000);
  let tenant;
  let otherTenant;
  let owner;
  let anotherUser;
  let foreignUser;
  let token;
  let anotherToken;
  let foreignToken;
  let periodActive;
  let periodPending;
  let section;

  const full = () => ({
    kind: 'awareness',
    awareness: {
      facts: '孩子磨蹭，我提高了声音。',
      feelings: ['着急', '委屈'],
      feelingNote: '有点累',
      bodyAreas: ['胸口'],
      asks: [
        { question: '那一刻，我有没有先听懂他？', answer: '没有，我只听见了时间。' },
        { question: '如果我是他，我在经历什么？', answer: '可能只是想把那页画完。' }
      ],
      habitKey: 'habit5',
      choice: '明天提前十分钟叫他，先问一句：还差多少？'
    }
  });

  before(async () => {
    expect(process.env.NODE_ENV).to.equal('test');
    expect(mongoose.connection.host).to.equal('127.0.0.1');
    const suffix = new mongoose.Types.ObjectId().toHexString();
    tenant = await Tenant.create({ name: '觉察测试', slug: `aw-${suffix}` });
    otherTenant = await Tenant.create({ name: '另一租户', slug: `aw2-${suffix}` });
    await withSystemContext(null, async () => {
      owner = await User.create({ tenantId: tenant._id, openid: `aw-owner-${suffix}` });
      anotherUser = await User.create({ tenantId: tenant._id, openid: `aw-other-${suffix}` });
      foreignUser = await User.create({ tenantId: otherTenant._id, openid: `aw-foreign-${suffix}` });
      token = generateAccessToken({ userId: String(owner._id), tenantId: String(tenant._id) });
      anotherToken = generateAccessToken({ userId: String(anotherUser._id), tenantId: String(tenant._id) });
      foreignToken = generateAccessToken({ userId: String(foreignUser._id), tenantId: String(otherTenant._id) });
      const makePeriod = name => Period.create({
        tenantId: tenant._id,
        name,
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-23'),
        readingAccess: 'enrolled',
        isPublished: true,
        visibilityType: 'all'
      });
      periodActive = await makePeriod('有效期次');
      periodPending = await makePeriod('待支付期次');
      await Enrollment.create({
        tenantId: tenant._id, userId: owner._id, periodId: periodActive._id, status: 'active', paymentStatus: 'paid'
      });
      await Enrollment.create({
        tenantId: tenant._id, userId: owner._id, periodId: periodPending._id, status: 'active', paymentStatus: 'pending'
      });
      section = await Section.create({
        tenantId: tenant._id, periodId: periodActive._id, day: 5, title: '第五个习惯 知彼解己', isPublished: true
      });
    });
  });

  const auth = (method, path, accessToken = token) =>
    request(app)[method](path).set('Authorization', `Bearer ${accessToken}`);
  const rawNote = id => withSystemContext(null, async () => await JoyNote.findById(id).lean());

  describe('创建觉察', () => {
    it('保存结构化内容，content 由服务端拼出，不信任客户端传来的 content', async () => {
      const created = await auth('post', '/api/v1/joy-notes')
        .send({ ...full(), content: '客户端伪造的内容' }).expect(201);
      const note = created.body.data;
      expect(note.kind).to.equal('awareness');
      expect(note.content).to.not.contain('伪造');
      expect(note.content).to.contain('看：孩子磨蹭，我提高了声音。');
      expect(note.content).to.contain('感：着急、委屈。有点累');
      expect(note.content).to.contain('择：明天提前十分钟叫他');
      // 每条回答都带 answerHtml（没有格式时是空串），客户端拿到的结构是稳定的
      expect(note.awareness.asks).to.deep.equal([
        { level: 1, question: '那一刻，我有没有先听懂他？', answer: '没有，我只听见了时间。', answerHtml: '' },
        { level: 2, question: '如果我是他，我在经历什么？', answer: '可能只是想把那页画完。', answerHtml: '' }
      ]);
      expect(note.awareness.habitKey).to.equal('habit5');
      expect(note.awareness.revisit).to.include({ enabled: true, status: 'pending' });
    });

    it('回访到期时间是创建当天起第 7 天的东八区早上 6 点', async () => {
      const created = await auth('post', '/api/v1/joy-notes').send(full()).expect(201);
      const stored = await rawNote(created.body.data.id);
      const dueAt = new Date(stored.awareness.revisit.dueAt);
      expect(dueAt.getTime()).to.equal(
        require('../../src/utils/awareness').computeRevisitDueAt(new Date(stored.createdAt)).getTime()
      );
      // 东八区早上 6 点 = UTC 22:00
      expect(dueAt.getUTCHours()).to.equal(22);
      expect(dueAt.getUTCMinutes()).to.equal(0);
    });

    it('只答一问也能保存；没写「择」或关闭开关时不回访', async () => {
      const onlyFacts = await auth('post', '/api/v1/joy-notes')
        .send({ kind: 'awareness', awareness: { facts: '只写了事实' } }).expect(201);
      expect(onlyFacts.body.data.awareness.revisit).to.include({ enabled: false, status: 'none' });
      const off = await auth('post', '/api/v1/joy-notes')
        .send({ ...full(), revisit: false }).expect(201);
      expect(off.body.data.awareness.revisit).to.include({ enabled: false, status: 'none' });
    });

    it('校验：全部留空、情绪词超过三个、追问超过三层、字段超长、类型不认识', async () => {
      await auth('post', '/api/v1/joy-notes').send({ kind: 'awareness', awareness: {} }).expect(400);
      await auth('post', '/api/v1/joy-notes').send({ kind: 'awareness' }).expect(400);
      await auth('post', '/api/v1/joy-notes')
        .send({ kind: 'awareness', awareness: { feelings: ['a', 'b', 'c', 'd'] } }).expect(400);
      const four = [1, 2, 3, 4].map(n => ({ question: `q${n}`, answer: `a${n}` }));
      await auth('post', '/api/v1/joy-notes').send({ kind: 'awareness', awareness: { asks: four } }).expect(400);
      await auth('post', '/api/v1/joy-notes')
        .send({ kind: 'awareness', awareness: { facts: '长'.repeat(601) } }).expect(400);
      await auth('post', '/api/v1/joy-notes').send({ kind: 'diary', content: 'x' }).expect(400);
    });

    it('关联期次和课程沿用随喜记的权限校验', async () => {
      await auth('post', '/api/v1/joy-notes')
        .send({ ...full(), periodId: String(periodPending._id) }).expect(403);
      const ok = await auth('post', '/api/v1/joy-notes')
        .send({ ...full(), periodId: String(periodActive._id), sectionId: String(section._id) }).expect(201);
      expect(ok.body.data).to.include({ periodId: String(periodActive._id), sectionId: String(section._id) });
      // 期次名和课程名由读取接口带出（创建接口的返回和随喜记一样不带）
      const read = await auth('get', `/api/v1/joy-notes/${ok.body.data.id}`).expect(200);
      expect(read.body.data).to.include({
        periodName: '有效期次', sectionTitle: '第五个习惯 知彼解己', day: 5
      });
    });

    it('随喜写法不受影响，默认就是随喜', async () => {
      const created = await auth('post', '/api/v1/joy-notes').send({ content: '一句话' }).expect(201);
      expect(created.body.data).to.include({ kind: 'joy', content: '一句话' });
      expect(created.body.data.awareness).to.equal(null);
      const stored = await rawNote(created.body.data.id);
      expect(stored.awareness).to.equal(undefined);
    });
  });

  describe('列表、读取与隔离', () => {
    let joyId;
    let awarenessId;
    let legacyId;

    before(async () => {
      joyId = (await auth('post', '/api/v1/joy-notes').send({ content: '列表里的随喜' }).expect(201)).body.data.id;
      awarenessId = (await auth('post', '/api/v1/joy-notes').send({
        kind: 'awareness', awareness: { facts: '列表里的觉察', choice: '小动作' }
      }).expect(201)).body.data.id;
      // 模拟升级前写入、没有 kind 字段的历史记录
      const legacy = await withSystemContext(null, async () => await JoyNote.collection.insertOne({
        tenantId: tenant._id,
        userId: owner._id,
        content: '升级前的随喜',
        periodId: null,
        sectionId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      legacyId = String(legacy.insertedId);
    });

    it('按类型筛选：随喜包含缺少 kind 的历史记录，觉察只含觉察', async () => {
      const joy = await auth('get', '/api/v1/joy-notes?kind=joy&limit=50').expect(200);
      const joyIds = joy.body.data.list.map(item => item.id);
      expect(joyIds).to.include(joyId).and.include(legacyId).and.not.include(awarenessId);
      joy.body.data.list.forEach(item => expect(item.kind).to.equal('joy'));

      const aware = await auth('get', '/api/v1/joy-notes?kind=awareness&limit=50').expect(200);
      expect(aware.body.data.list.map(item => item.id)).to.include(awarenessId).and.not.include(joyId);
      aware.body.data.list.forEach(item => expect(item.kind).to.equal('awareness'));

      const all = await auth('get', '/api/v1/joy-notes?limit=50').expect(200);
      expect(all.body.data.list.map(item => item.id)).to.include.members([joyId, awarenessId, legacyId]);
      await auth('get', '/api/v1/joy-notes?kind=oops').expect(400);
    });

    it('拼出来的 content 可以被关键词搜到', async () => {
      const found = await auth('get', `/api/v1/joy-notes?q=${encodeURIComponent('列表里的觉察')}`).expect(200);
      expect(found.body.data.list.map(item => item.id)).to.deep.equal([awarenessId]);
    });

    it('读取单条：本人可以，其他人和其他租户都读不到', async () => {
      const mine = await auth('get', `/api/v1/joy-notes/${awarenessId}`).expect(200);
      expect(mine.body.data.awareness.choice).to.equal('小动作');
      await auth('get', `/api/v1/joy-notes/${awarenessId}`, anotherToken).expect(404);
      await auth('get', `/api/v1/joy-notes/${awarenessId}`, foreignToken).expect(404);
      await auth('get', '/api/v1/joy-notes/not-an-id').expect(400);
      await request(app).get(`/api/v1/joy-notes/${awarenessId}`).expect(401);
    });

    it('觉察记录不支持直接修改，随喜仍可修改', async () => {
      await auth('put', `/api/v1/joy-notes/${awarenessId}`).send({ content: '想改' }).expect(400);
      await auth('put', `/api/v1/joy-notes/${joyId}`).send({ content: '改过的随喜' }).expect(200);
    });

    it('其他用户不能追加后来、跳过回访或删除', async () => {
      await auth('post', `/api/v1/joy-notes/${awarenessId}/follow-ups`, anotherToken)
        .send({ content: '偷偷写' }).expect(404);
      await auth('post', `/api/v1/joy-notes/${awarenessId}/revisit/skip`, anotherToken).expect(404);
      await auth('delete', `/api/v1/joy-notes/${awarenessId}`, anotherToken).expect(404);
      const stored = await rawNote(awarenessId);
      expect(stored.awareness.followUps).to.have.length(0);
      expect(stored.awareness.revisit.status).to.equal('pending');
    });
  });

  describe('后来与跳过回访', () => {
    const create = async (extra = {}) =>
      (await auth('post', '/api/v1/joy-notes').send({ ...full(), ...extra }).expect(201)).body.data.id;

    it('追加后来：可写多次、带日期，写了就标记为已回应', async () => {
      const id = await create();
      const first = await auth('post', `/api/v1/joy-notes/${id}/follow-ups`)
        .send({ content: '  这周有三天做到了  ' }).expect(201);
      expect(first.body.data.awareness.followUps[0].content).to.equal('这周有三天做到了');
      expect(first.body.data.awareness.revisit.status).to.equal('answered');
      const second = await auth('post', `/api/v1/joy-notes/${id}/follow-ups`).send({ content: '他说：今天你没催我' }).expect(201);
      expect(second.body.data.awareness.followUps.map(item => item.content))
        .to.deep.equal(['这周有三天做到了', '他说：今天你没催我']);
      expect(new Date(second.body.data.awareness.followUps[1].createdAt).getTime()).to.be.a('number');
    });

    it('后来不能为空或超长，最多写 30 条，随喜不能追加', async () => {
      const id = await create();
      await auth('post', `/api/v1/joy-notes/${id}/follow-ups`).send({ content: '   ' }).expect(400);
      await auth('post', `/api/v1/joy-notes/${id}/follow-ups`).send({ content: '长'.repeat(501) }).expect(400);
      await withSystemContext(null, async () => await JoyNote.updateOne(
        { _id: id },
        { $set: { 'awareness.followUps': Array.from({ length: 30 }, (_, n) => ({ content: `第${n}条`, createdAt: new Date() })) } }
      ));
      const full30 = await auth('post', `/api/v1/joy-notes/${id}/follow-ups`).send({ content: '第 31 条' }).expect(400);
      expect(full30.body.message).to.contain('写满');
      const joy = (await auth('post', '/api/v1/joy-notes').send({ content: '随喜' }).expect(201)).body.data.id;
      await auth('post', `/api/v1/joy-notes/${joy}/follow-ups`).send({ content: '不行' }).expect(404);
    });

    it('先不写：回访被跳过，不会再提醒；已回应的不会被改回', async () => {
      const id = await create();
      const skipped = await auth('post', `/api/v1/joy-notes/${id}/revisit/skip`).expect(200);
      expect(skipped.body.data.status).to.equal('skipped');
      expect((await rawNote(id)).awareness.revisit.status).to.equal('skipped');
      const again = await auth('post', `/api/v1/joy-notes/${id}/revisit/skip`).expect(200);
      expect(again.body.data.status).to.equal('skipped');

      const answered = await create();
      await auth('post', `/api/v1/joy-notes/${answered}/follow-ups`).send({ content: '写了' }).expect(201);
      const noChange = await auth('post', `/api/v1/joy-notes/${answered}/revisit/skip`).expect(200);
      expect(noChange.body.data.status).to.equal('answered');
    });

    it('回访卡片：只返回「择」和状态，别人的记录和随喜都不返回', async () => {
      const id = await create();
      const joy = (await auth('post', '/api/v1/joy-notes').send({ content: '随喜不返回' }).expect(201)).body.data.id;
      const cards = await auth('get', `/api/v1/joy-notes/revisits?ids=${id},${joy}`).expect(200);
      expect(cards.body.data.list).to.have.length(1);
      expect(cards.body.data.list[0]).to.include({
        id, choice: '明天提前十分钟叫他，先问一句：还差多少？', status: 'pending', followUpCount: 0, lastFollowUp: ''
      });
      expect(cards.body.data.list[0]).to.not.have.property('facts');
      const others = await auth('get', `/api/v1/joy-notes/revisits?ids=${id}`, anotherToken).expect(200);
      expect(others.body.data.list).to.have.length(0);
      await auth('get', '/api/v1/joy-notes/revisits').expect(400);
      await auth('get', '/api/v1/joy-notes/revisits?ids=bad').expect(400);
      const eleven = Array.from({ length: 11 }, () => String(new mongoose.Types.ObjectId())).join(',');
      await auth('get', `/api/v1/joy-notes/revisits?ids=${eleven}`).expect(400);
    });
  });

  describe('一周后回访来信', () => {
    const create = async (extra = {}) =>
      (await auth('post', '/api/v1/joy-notes').send({ ...full(), ...extra }).expect(201)).body.data.id;
    const makeDue = (id, when = new Date(Date.now() - 60 * 1000)) => withSystemContext(null, async () => await JoyNote.updateOne(
      { _id: id }, { $set: { 'awareness.revisit.dueAt': when } }
    ));
    const notificationsFor = id => withSystemContext(null, async () => await Notification.find({
      type: 'awareness_revisit', 'data.joyNoteId': id
    }).lean());

    it('到期的觉察送一封来信：不含笔记文字，状态变为已投递，重复运行不会重复', async () => {
      const id = await create();
      await makeDue(id);
      const first = await revisitService.deliverDueRevisits();
      expect(first.delivered).to.be.at.least(1);
      const sent = await notificationsFor(id);
      expect(sent).to.have.length(1);
      expect(sent[0]).to.include({ title: '来自一周前的自己' });
      expect(String(sent[0].userId)).to.equal(String(owner._id));
      expect(String(sent[0].tenantId)).to.equal(String(tenant._id));
      const text = JSON.stringify([sent[0].title, sent[0].content, sent[0].data]);
      ['孩子磨蹭', '明天提前', '委屈', '着急'].forEach(word => expect(text).to.not.contain(word));
      const stored = await rawNote(id);
      expect(stored.awareness.revisit.status).to.equal('delivered');
      expect(stored.awareness.revisit.deliveredAt).to.be.a('date');

      await revisitService.deliverDueRevisits();
      expect(await notificationsFor(id)).to.have.length(1);
    });

    it('没到期、已跳过、已回应、被删除的都不会送', async () => {
      const notDue = await create();
      await makeDue(notDue, new Date(Date.now() + 3600 * 1000));
      const skipped = await create();
      await makeDue(skipped);
      await auth('post', `/api/v1/joy-notes/${skipped}/revisit/skip`).expect(200);
      const answered = await create();
      await makeDue(answered);
      await auth('post', `/api/v1/joy-notes/${answered}/follow-ups`).send({ content: '已经写了' }).expect(201);
      const removed = await create();
      await makeDue(removed);
      await auth('delete', `/api/v1/joy-notes/${removed}`).expect(200);

      await revisitService.deliverDueRevisits();
      for (const id of [notDue, skipped, answered, removed]) {
        expect(await notificationsFor(id), id).to.have.length(0);
      }
      expect((await rawNote(notDue)).awareness.revisit.status).to.equal('pending');
    });

    it('同时有两次运行也只送一封（抢占式更新）', async () => {
      const id = await create();
      await makeDue(id);
      const [a, b] = await Promise.all([revisitService.deliverDueRevisits(), revisitService.deliverDueRevisits()]);
      expect(a.delivered + b.delivered).to.be.at.least(1);
      expect(await notificationsFor(id)).to.have.length(1);
    });

    it('卡在「投递中」超过 30 分钟的会被退回待投递再重试', async () => {
      const id = await create();
      await makeDue(id);
      await withSystemContext(null, async () => await JoyNote.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { 'awareness.revisit.status': 'delivering', updatedAt: new Date(Date.now() - 60 * 60 * 1000) } }
      ));
      await revisitService.deliverDueRevisits();
      expect(await notificationsFor(id)).to.have.length(1);
      expect((await rawNote(id)).awareness.revisit.status).to.equal('delivered');
    });

    it('送到之后，来信页能读到回访卡片并写后来', async () => {
      const id = await create();
      await makeDue(id);
      await revisitService.deliverDueRevisits();
      const cards = await auth('get', `/api/v1/joy-notes/revisits?ids=${id}`).expect(200);
      expect(cards.body.data.list[0]).to.include({ status: 'delivered', followUpCount: 0 });
      await auth('post', `/api/v1/joy-notes/${id}/follow-ups`).send({ content: '后来好多了' }).expect(201);
      const after = await auth('get', `/api/v1/joy-notes/revisits?ids=${id}`).expect(200);
      expect(after.body.data.list[0]).to.include({ status: 'answered', followUpCount: 1, lastFollowUp: '后来好多了' });
    });

    it('启用开关：生产默认开，可用 ENABLE_AWARENESS_REVISIT 强制开关', () => {
      expect(revisitService.isEnabled({ NODE_ENV: 'production' })).to.equal(true);
      expect(revisitService.isEnabled({ NODE_ENV: 'production', ENABLE_AWARENESS_REVISIT: 'false' })).to.equal(false);
      expect(revisitService.isEnabled({ NODE_ENV: 'development' })).to.equal(false);
      expect(revisitService.isEnabled({ NODE_ENV: 'development', ENABLE_AWARENESS_REVISIT: 'true' })).to.equal(true);
    });
  });

  describe('标题与富文本重点颜色', () => {
    const richHtml = '<p>今天<span style="color: #dc2626">很重要</span>，<strong>要记住</strong></p><script>alert(1)</script>';

    it('随喜：标题选填；带格式时保存清洗后的 HTML，纯文本由 HTML 推出（不信任客户端的纯文本）', async () => {
      const created = await auth('post', '/api/v1/joy-notes')
        .send({ title: '  晨读 的   一句 ', content: '被篡改的纯文本', contentHtml: richHtml }).expect(201);
      const note = created.body.data;
      expect(note.title).to.equal('晨读 的 一句');
      expect(note.content).to.equal('今天很重要，要记住');
      expect(note.contentHtml).to.equal('<p>今天<span style="color:#dc2626">很重要</span>，<strong>要记住</strong></p>');
      expect(note.contentHtml).to.not.contain('script');
      const stored = await rawNote(note.id);
      expect(stored.content).to.equal('今天很重要，要记住');
    });

    it('随喜：没有格式时只存纯文本；没有标题也能保存', async () => {
      const created = await auth('post', '/api/v1/joy-notes')
        .send({ content: '一句话', contentHtml: '<p>一句话</p>' }).expect(201);
      expect(created.body.data).to.include({ title: '', content: '一句话', contentHtml: '' });
      const stored = await rawNote(created.body.data.id);
      expect(stored.contentHtml || '').to.equal('');
    });

    it('随喜：标题超长、HTML 过长、HTML 清洗后没有文字都被拒绝', async () => {
      await auth('post', '/api/v1/joy-notes').send({ title: '长'.repeat(41), content: '一句' }).expect(400);
      await auth('post', '/api/v1/joy-notes').send({ title: 5, content: '一句' }).expect(400);
      await auth('post', '/api/v1/joy-notes').send({ content: 'x', contentHtml: `<p>${'x'.repeat(20001)}</p>` }).expect(400);
      await auth('post', '/api/v1/joy-notes').send({ contentHtml: '<script>alert(1)</script>' }).expect(400);
      // 清洗后纯文本超过 3000 字也拒绝
      await auth('post', '/api/v1/joy-notes').send({ contentHtml: `<p>${'长'.repeat(3001)}</p>` }).expect(400);
    });

    it('随喜：修改时可以改标题和格式；不带标题就保持原标题，带空字符串则清掉', async () => {
      const id = (await auth('post', '/api/v1/joy-notes').send({ title: '原标题', content: '原文' }).expect(201)).body.data.id;
      const updated = await auth('put', `/api/v1/joy-notes/${id}`).send({ contentHtml: richHtml }).expect(200);
      expect(updated.body.data).to.include({ title: '原标题', content: '今天很重要，要记住' });
      expect(updated.body.data.contentHtml).to.contain('color:#dc2626');
      const plain = await auth('put', `/api/v1/joy-notes/${id}`).send({ content: '改回纯文本' }).expect(200);
      expect(plain.body.data).to.include({ content: '改回纯文本', contentHtml: '', title: '原标题' });
      const cleared = await auth('put', `/api/v1/joy-notes/${id}`).send({ content: '改回纯文本', title: '' }).expect(200);
      expect(cleared.body.data.title).to.equal('');
      await auth('put', `/api/v1/joy-notes/${id}`).send({ content: '改', title: '长'.repeat(41) }).expect(400);
    });

    it('觉察：标题 + 「看」「问」「择」的格式；content 由清洗后的纯文本拼出', async () => {
      const created = await auth('post', '/api/v1/joy-notes').send({
        kind: 'awareness',
        title: '孩子磨蹭的早晨',
        awareness: {
          factsHtml: '<p>孩子磨蹭，<span style="color:#dc2626">我提高了声音</span><script>x</script></p>',
          facts: '被篡改',
          asks: [{ question: '那一刻我在意什么？', answerHtml: '<p><strong>时间</strong></p>' }],
          choiceHtml: '<p>明天先问一句</p>'
        }
      }).expect(201);
      const note = created.body.data;
      expect(note.title).to.equal('孩子磨蹭的早晨');
      expect(note.content).to.equal('看：孩子磨蹭，我提高了声音\n问：时间\n择：明天先问一句');
      expect(note.awareness.factsHtml).to.equal('<p>孩子磨蹭，<span style="color:#dc2626">我提高了声音</span></p>');
      expect(note.awareness.asks[0]).to.include({ answer: '时间', answerHtml: '<p><strong>时间</strong></p>' });
      expect(note.awareness.choiceHtml).to.equal('');
      await auth('post', '/api/v1/joy-notes')
        .send({ kind: 'awareness', title: '长'.repeat(41), awareness: { facts: '事实' } }).expect(400);
    });

    it('觉察：保存后只能改标题，其他内容不能改；后来仍可追加', async () => {
      const id = (await auth('post', '/api/v1/joy-notes').send({ ...full(), title: '第一版' }).expect(201)).body.data.id;
      const renamed = await auth('put', `/api/v1/joy-notes/${id}`).send({ title: '  新标题 ' }).expect(200);
      expect(renamed.body.data.title).to.equal('新标题');
      expect(renamed.body.data.awareness.facts).to.equal('孩子磨蹭，我提高了声音。');
      await auth('put', `/api/v1/joy-notes/${id}`).send({ title: '改', content: '想改正文' }).expect(400);
      await auth('put', `/api/v1/joy-notes/${id}`).send({ content: '只改正文' }).expect(400);
      await auth('put', `/api/v1/joy-notes/${id}`).send({ title: '长'.repeat(41) }).expect(400);
      await auth('put', `/api/v1/joy-notes/${id}`, anotherToken).send({ title: '别人改' }).expect(404);
      await auth('post', `/api/v1/joy-notes/${id}/follow-ups`).send({ content: '后来好了' }).expect(201);
    });

    it('搜索同时匹配标题和正文', async () => {
      await auth('post', '/api/v1/joy-notes').send({ title: '独一无二的标题词', content: '正文里没有那个词' }).expect(201);
      await auth('post', '/api/v1/joy-notes').send({ content: '正文里有独一无二的正文词' }).expect(201);
      const byTitle = await auth('get', `/api/v1/joy-notes?q=${encodeURIComponent('标题词')}`).expect(200);
      expect(byTitle.body.data.list.map(item => item.title)).to.include('独一无二的标题词');
      const byBody = await auth('get', `/api/v1/joy-notes?q=${encodeURIComponent('正文词')}`).expect(200);
      expect(byBody.body.data.list.map(item => item.content)).to.include('正文里有独一无二的正文词');
    });
  });
});
