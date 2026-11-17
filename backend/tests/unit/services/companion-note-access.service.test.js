const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

const noteId = '507f1f77bcf86cd799439011';

describe('companion-note-access.service', () => {
  let sandbox;
  let EnrollmentStub;
  let CompanionNoteStub;
  let SectionStub;
  let service;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    EnrollmentStub = { findOne: sandbox.stub(), find: sandbox.stub() };
    CompanionNoteStub = { findOne: sandbox.stub() };
    SectionStub = { find: sandbox.stub() };
    service = proxyquire('../../../src/services/companion-note-access.service', {
      '../models/Enrollment': EnrollmentStub,
      '../models/CompanionNote': CompanionNoteStub,
      '../models/Section': SectionStub,
      './community-access.service': {
        findCommunityEnrollment: async () => ({ status: 'active', paymentStatus: 'paid' }),
        getCommunityAccessiblePeriodIds: async () => ['period-1']
      }
    });
  });

  afterEach(() => sandbox.restore());

  it('为有权限用户构建绑定期次和全营手札的服务端条件', async () => {
    const filter = await service.buildAccessibleNoteFilter('user-1');
    expect(filter).to.include({ status: 'published', deletedAt: null });
    expect(filter.$or).to.deep.equal([
      { periodId: { $in: ['period-1'] } },
      { periodId: null }
    ]);

    const general = await service.buildAccessibleNoteFilter('user-1', { scope: 'general' });
    expect(general).to.include({ status: 'published', deletedAt: null, periodId: null });

    const denied = await service.buildAccessibleNoteFilter('user-1', { periodId: 'period-2' });
    expect(denied).to.equal(null);
  });

  it('未报名用户没有可查询的手札条件', async () => {
    const deniedService = proxyquire('../../../src/services/companion-note-access.service', {
      '../models/Enrollment': EnrollmentStub,
      '../models/CompanionNote': CompanionNoteStub,
      '../models/Section': SectionStub,
      './community-access.service': {
        findCommunityEnrollment: async () => null,
        getCommunityAccessiblePeriodIds: async () => []
      }
    });
    expect(await deniedService.buildAccessibleNoteFilter('user-1')).to.equal(null);
    expect(await deniedService.canAccessNote({ status: 'published', deletedAt: null, periodId: null }, 'user-1')).to.equal(false);
  });

  it('对外序列化时删除私有目录，只保留页数和完整状态', () => {
    const output = service.toPublicNote({
      _id: noteId,
      title: '手札',
      file: {
        dir: 'companion-notes/private-token',
        originalName: 'note.pdf',
        size: 10,
        pageCount: 7,
        pagesReady: true
      },
      coverUrl: '/uploads/tenants/demo/cover.jpg'
    }, { sectionLabels: [] });

    expect(output.file).to.not.have.property('dir');
    expect(output.file).to.include({ pageCount: 7, pagesReady: true });
    expect(JSON.stringify(output)).to.not.include('private-token');
  });
});
