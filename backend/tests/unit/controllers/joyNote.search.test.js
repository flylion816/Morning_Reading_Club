const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('joyNote.controller 搜索', () => {
  let controller;
  let JoyNote;
  let res;

  beforeEach(() => {
    const chain = rows => ({
      sort: () => chain(rows),
      skip: () => chain(rows),
      limit: () => chain(rows),
      lean: () => Promise.resolve(rows)
    });
    JoyNote = {
      countDocuments: sinon.stub().resolves(0),
      find: sinon.stub().returns(chain([]))
    };
    res = { status: sinon.stub().returnsThis(), json: sinon.stub().returnsThis() };
    controller = proxyquire('../../../src/controllers/joyNote.controller', {
      '../models/JoyNote': JoyNote,
      '../models/Period': {},
      '../models/Section': {},
      '../services/community-access.service': { getCommunityAccessiblePeriodIds: sinon.stub().resolves([]) },
      '../services/period-access.service': { findEffectiveEnrollment: sinon.stub(), getPeriodAccessState: sinon.stub() },
      '../utils/response': { success: data => ({ code: 0, data }), errors: { badRequest: m => ({ code: 400, message: m }) } }
    });
  });

  const run = query => controller.getMine({ user: { userId: 'u1' }, query }, res, sinon.stub());

  it('带关键词时只搜自己的记录（标题或内容），正则特殊字符被转义', async () => {
    await run({ q: ' a.b(c) ' });
    const filter = JoyNote.countDocuments.firstCall.args[0];
    expect(filter.userId).to.equal('u1');
    const pattern = { $regex: 'a\\.b\\(c\\)', $options: 'i' };
    expect(filter.$or).to.deep.equal([{ content: pattern }, { title: pattern }]);
  });

  it('没有关键词、关键词是空白或不是字符串时，不加内容条件', async () => {
    await run({});
    await run({ q: '   ' });
    await run({ q: ['x'] });
    JoyNote.countDocuments.getCalls().forEach(call => {
      expect(call.args[0]).to.not.have.property('content');
      expect(call.args[0]).to.not.have.property('$or');
    });
  });

  it('关键词最多取 30 个字', async () => {
    await run({ q: '字'.repeat(50) });
    expect(JoyNote.countDocuments.firstCall.args[0].$or[0].content.$regex).to.equal('字'.repeat(30));
  });

  it('这一页没有关联期次的记录时，不去查有权限的期次', async () => {
    const access = { getCommunityAccessiblePeriodIds: sinon.stub().resolves([]) };
    JoyNote.find.returns({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([{ _id: 'n1', content: 'x' }]) }) }) }) });
    controller = proxyquire('../../../src/controllers/joyNote.controller', {
      '../models/JoyNote': JoyNote,
      '../models/Period': {},
      '../models/Section': {},
      '../services/community-access.service': access,
      '../services/period-access.service': { findEffectiveEnrollment: sinon.stub(), getPeriodAccessState: sinon.stub() },
      '../utils/response': { success: data => ({ code: 0, data }), errors: {} }
    });
    await run({});
    expect(access.getCommunityAccessiblePeriodIds.called).to.equal(false);
  });
});
