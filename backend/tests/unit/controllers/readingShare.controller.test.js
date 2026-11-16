const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

const USER_ID = '507f1f77bcf86cd799439011';
const SECTION_ID = '507f1f77bcf86cd799439021';
const PERIOD_ID = '507f1f77bcf86cd799439031';

function chain(result) {
  const q = {
    select: () => q,
    populate: () => q,
    lean: async () => result,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  };
  return q;
}

describe('ReadingShare Controller', () => {
  let ReadingShare;
  let Section;
  let Period;
  let User;
  let getPeriodAccessState;
  let controller;
  let res;

  beforeEach(() => {
    ReadingShare = { findOne: sinon.stub().returns(chain(null)), create: sinon.stub() };
    Section = { findById: sinon.stub().returns(chain(null)) };
    Period = { findById: sinon.stub().returns(chain({ name: '第 12 期' })) };
    User = { findById: sinon.stub().returns(chain({ _id: USER_ID, nickname: '狮子', status: 'active' })) };
    getPeriodAccessState = sinon.stub().resolves({ canRead: true });
    const respond = (status, body) => ({ status, body });
    controller = proxyquire('../../../src/controllers/readingShare.controller', {
      '../models/ReadingShare': ReadingShare,
      '../models/Section': Section,
      '../models/Period': Period,
      '../models/User': User,
      '../services/period-access.service': { getPeriodAccessState },
      '../utils/tenantContext': { getCurrentTenantId: () => null },
      '../utils/response': {
        success: data => ({ code: 200, data }),
        errors: {
          badRequest: m => respond(400, m),
          forbidden: m => respond(403, m),
          notFound: m => respond(404, m),
          serviceUnavailable: m => respond(503, m)
        }
      },
      '../utils/logger': { error: () => {} }
    });
    res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  });

  const req = body => ({ user: { userId: USER_ID }, body });

  it('短码是 8 位小写字母数字，摘句最多 60 字并去掉多余空白', () => {
    expect(controller.generateCode()).to.match(/^[a-z0-9]{8}$/);
    expect(controller.clampQuote('  你好 \n 世界  ')).to.equal('你好 世界');
    expect(Array.from(controller.clampQuote('字'.repeat(100))).length).to.equal(60);
  });

  it('create 校验课程和段落参数', async () => {
    await controller.createReadingShare(req({ sectionId: 'bad', paragraphIndex: 1 }), res, sinon.stub());
    expect(res.statusCode).to.equal(400);
    await controller.createReadingShare(req({ sectionId: SECTION_ID, paragraphIndex: -1 }), res, sinon.stub());
    expect(res.statusCode).to.equal(400);
    await controller.createReadingShare(req({ sectionId: SECTION_ID, paragraphIndex: 1.5 }), res, sinon.stub());
    expect(res.statusCode).to.equal(400);
  });

  it('create 课程不存在返回 404，读不了这一课返回 403', async () => {
    await controller.createReadingShare(req({ sectionId: SECTION_ID, paragraphIndex: 2 }), res, sinon.stub());
    expect(res.statusCode).to.equal(404);

    Section.findById.returns(chain({ _id: SECTION_ID, periodId: { _id: PERIOD_ID } }));
    getPeriodAccessState.resolves({ canRead: false });
    await controller.createReadingShare(req({ sectionId: SECTION_ID, paragraphIndex: 2 }), res, sinon.stub());
    expect(res.statusCode).to.equal(403);
    expect(ReadingShare.create.called).to.equal(false);
  });

  it('resolve 非法或不存在的短码都返回 404', async () => {
    await controller.resolveReadingShare({ params: { code: 'ABC' } }, res, sinon.stub());
    expect(res.statusCode).to.equal(404);
    await controller.resolveReadingShare({ params: { code: 'abcd2345' } }, res, sinon.stub());
    expect(res.statusCode).to.equal(404);
  });

  it('resolve 返回课程、段落位置和分享人', async () => {
    ReadingShare.findOne.returns(
      chain({ code: 'abcd2345', userId: USER_ID, sectionId: SECTION_ID, periodId: PERIOD_ID, paragraphIndex: 7, quote: '先理解别人' })
    );
    Section.findById.returns(chain({ title: '知彼解己', day: 7 }));
    await controller.resolveReadingShare({ params: { code: 'ABCD2345' } }, res, sinon.stub());
    expect(res.body.data).to.include({
      sectionId: SECTION_ID,
      periodId: PERIOD_ID,
      paragraphIndex: 7,
      quote: '先理解别人',
      sectionTitle: '知彼解己',
      periodName: '第 12 期'
    });
    expect(res.body.data.inviter.nickname).to.equal('狮子');
  });
});
