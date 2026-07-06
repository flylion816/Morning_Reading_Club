/**
 * Section Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Section Controller', () => {
  let sectionController;
  let sandbox;
  let req;
  let res;
  let next;
  let SectionStub;
  let PeriodStub;
  let CheckinStub;
  let UserReadingCompletionStub;
  let EnrollmentStub;
  let publishSyncEventStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      user: {}
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    SectionStub = {
      findById: sandbox.stub(),
      find: sandbox.stub(),
      findOne: sandbox.stub(),
      countDocuments: sandbox.stub(),
      create: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      findByIdAndDelete: sandbox.stub()
    };

    PeriodStub = {
      findById: sandbox.stub()
    };

    CheckinStub = {
      aggregate: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    UserReadingCompletionStub = {
      find: sandbox.stub(),
      findOneAndUpdate: sandbox.stub(),
      findOne: sandbox.stub()
    };

    EnrollmentStub = {
      find: sandbox.stub()
    };

    publishSyncEventStub = sandbox.stub();

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg })
      }
    };

    sectionController = proxyquire(
      '../../../src/controllers/section.controller',
      {
        '../models/Section': SectionStub,
        '../models/Period': PeriodStub,
        '../models/Checkin': CheckinStub,
        '../models/UserReadingCompletion': UserReadingCompletionStub,
        '../models/Enrollment': EnrollmentStub,
        '../utils/response': responseUtils,
        '../utils/tenantSlug': {
          resolveTenantSlug: sandbox.stub().resolves('test-slug')
        },
        '../services/sync.service': {
          publishSyncEvent: publishSyncEventStub
        }
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  function createPersistedSection(overrides = {}) {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      title: '课节',
      periodId: new mongoose.Types.ObjectId(),
      day: 1,
      save: sandbox.stub().resolves(),
      ...overrides
    };
    doc.toObject = sandbox.stub().callsFake(() => ({
      _id: doc._id,
      periodId: doc.periodId,
      day: doc.day,
      title: doc.title
    }));
    return doc;
  }

  function createPersistedPeriod(overrides = {}) {
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      name: '期次',
      totalDays: 23,
      save: sandbox.stub().resolves(),
      ...overrides
    };
    doc.toObject = sandbox.stub().callsFake(() => ({
      _id: doc._id,
      name: doc.name,
      totalDays: doc.totalDays
    }));
    return doc;
  }

  describe('getSectionsByPeriod', () => {
    it('应该返回期次的所有课节', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { page: 1, limit: 20 };

      const mockSections = [
        { _id: new mongoose.Types.ObjectId(), periodId, day: 1, title: '第一课' },
        { _id: new mongoose.Types.ObjectId(), periodId, day: 2, title: '第二课' }
      ];

      const mockPeriod = { _id: periodId, name: '期次' };

      PeriodStub.findById.resolves(mockPeriod);
      SectionStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(mockSections)
      });
      CheckinStub.aggregate.resolves([
        { _id: mockSections[0]._id, count: 3 }
      ]);

      await sectionController.getSectionsByPeriod(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      // 修复：getSectionsByPeriod 返回的是数组，不是有 list/pagination 的对象
      expect(Array.isArray(responseData.data)).to.be.true;
      expect(responseData.data.length).to.equal(2);
      expect(responseData.data[0].checkinCount).to.equal(3);
      expect(responseData.data[1].checkinCount).to.equal(0);
    });

    it('应该为已登录用户附加阅读完成状态', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { page: 1, limit: 20 };
      req.user = { userId: userId.toString() };

      const mockSections = [
        { _id: new mongoose.Types.ObjectId(), periodId, day: 1, title: '第一课' },
        { _id: new mongoose.Types.ObjectId(), periodId, day: 2, title: '第二课' }
      ];

      PeriodStub.findById.resolves({ _id: periodId, name: '期次' });
      SectionStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(mockSections)
      });
      CheckinStub.aggregate.resolves([]);
      UserReadingCompletionStub.find.returns({
        select: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves([
          {
            sectionId: mockSections[1]._id,
            durationMs: 91000,
            completedAt: new Date('2026-05-14T00:00:00.000Z')
          }
        ])
      });

      await sectionController.getSectionsByPeriod(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data[0].readingCompleted).to.equal(false);
      expect(responseData.data[1].readingCompleted).to.equal(true);
      expect(responseData.data[1].readingDurationMs).to.equal(91000);
    });

    it('应该验证期次存在', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { page: 1, limit: 20 };

      PeriodStub.findById.resolves(null);

      await sectionController.getSectionsByPeriod(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('getSectionDetail', () => {
    it('应该返回课节详情', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };

      const mockSection = {
        _id: sectionId,
        day: 1,
        title: '第一课',
        content: '课程内容',
        duration: 30,
        checkinCount: 100,
        periodId: { _id: new mongoose.Types.ObjectId(), name: '期次', title: '期次标题' }
      };

      SectionStub.findById.returns({
        populate: sandbox.stub().returns({
          lean: sandbox.stub().resolves(mockSection)
        })
      });

      await sectionController.getSectionDetail(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.title).to.equal('第一课');
      expect(responseData.data.readingCompleted).to.equal(false);
    });

    it('应该在课节详情中附加当前用户阅读完成状态', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      req.params = { sectionId };
      req.user = { userId: userId.toString() };

      const mockSection = {
        _id: sectionId,
        day: 1,
        title: '第一课',
        content: '课程内容',
        periodId
      };

      SectionStub.findById.returns({
        populate: sandbox.stub().returns({
          lean: sandbox.stub().resolves(mockSection)
        })
      });
      UserReadingCompletionStub.find.returns({
        select: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves([
          {
            sectionId,
            durationMs: 72000,
            completedAt: new Date('2026-05-14T00:00:00.000Z')
          }
        ])
      });

      await sectionController.getSectionDetail(req, res, next);

      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.readingCompleted).to.equal(true);
      expect(responseData.data.readingDurationMs).to.equal(72000);
    });

    it('应该返回404当课节不存在', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };

      SectionStub.findById.returns({
        populate: sandbox.stub().returns({
          lean: sandbox.stub().resolves(null)
        })
      });

      await sectionController.getSectionDetail(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('markReadingCompletion', () => {
    it('应该保存当前用户的课节阅读完成状态', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      const periodId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      const completedAt = '2026-05-14T01:02:03.000Z';
      req.params = { sectionId };
      req.user = { userId: userId.toString() };
      req.body = {
        durationMs: 88000,
        completedAt
      };

      SectionStub.findById.returns({
        select: sandbox.stub().resolves({ _id: sectionId, periodId })
      });
      UserReadingCompletionStub.findOneAndUpdate.returns({
        lean: sandbox.stub().resolves({
          userId,
          sectionId,
          periodId,
          durationMs: 88000,
          completedAt: new Date(completedAt)
        })
      });

      await sectionController.markReadingCompletion(req, res, next);

      expect(UserReadingCompletionStub.findOneAndUpdate.calledOnce).to.be.true;
      const updateArgs = UserReadingCompletionStub.findOneAndUpdate.getCall(0).args;
      expect(updateArgs[0].userId).to.equal(userId.toString());
      expect(updateArgs[0].sectionId).to.equal(sectionId);
      expect(updateArgs[1].$set.durationMs).to.equal(88000);
      expect(updateArgs[2].upsert).to.equal(true);
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.readingCompleted).to.equal(true);
      expect(responseData.data.readingDurationMs).to.equal(88000);
    });

    it('课节不存在时应该返回404', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };
      req.user = { userId: new mongoose.Types.ObjectId().toString() };

      SectionStub.findById.returns({
        select: sandbox.stub().resolves(null)
      });

      await sectionController.markReadingCompletion(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('createSection (Admin)', () => {
    beforeEach(() => {
      SectionStub.find.returns({
        sort: sandbox.stub().resolves([])
      });
    });

    it('应该创建新课节', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.body = {
        periodId,
        day: 1,
        title: '新课节',
        content: '课程内容',
        duration: 30
      };

      const mockPeriod = { _id: periodId, name: '期次' };
      const mockSection = {
        _id: new mongoose.Types.ObjectId(),
        ...req.body,
        toObject: sandbox.stub().returnsThis()
      };

      PeriodStub.findById.resolves(mockPeriod);
      SectionStub.create.resolves(mockSection);

      await sectionController.createSection(req, res, next);

      expect(PeriodStub.findById.called).to.be.true;
      expect(SectionStub.create.called).to.be.true;
      expect(SectionStub.create.getCall(0).args[0]).to.include({
        title: '新课节',
        content: '课程内容',
        duration: 30
      });
      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该创建带结营视频的新课节', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const closingVideo = {
        url: '/uploads/tenants/default/closing.mp4',
        coverUrl: '/uploads/tenants/default/closing-cover.jpg',
        originalName: '结营视频.mp4'
      };
      req.body = {
        periodId,
        day: 12,
        title: '结营词',
        closingVideo
      };

      const mockPeriod = { _id: periodId, name: '期次' };
      const mockSection = {
        _id: new mongoose.Types.ObjectId(),
        ...req.body,
        toObject: sandbox.stub().returnsThis()
      };

      PeriodStub.findById.resolves(mockPeriod);
      SectionStub.create.resolves(mockSection);

      await sectionController.createSection(req, res, next);

      expect(SectionStub.create.getCall(0).args[0].closingVideo).to.deep.equal(closingVideo);
      expect(res.status.calledWith(201)).to.be.true;
    });

    it('新增指定天数时应该把原有当天及后续课节顺延一天', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.body = {
        periodId,
        day: 7,
        title: '插入课节'
      };

      const mockPeriod = createPersistedPeriod({ _id: periodId, totalDays: 23 });
      const day8Section = createPersistedSection({ periodId, day: 8, title: '原第8天' });
      const day7Section = createPersistedSection({ periodId, day: 7, title: '原第7天' });
      const sort = sandbox.stub().resolves([day8Section, day7Section]);
      const mockSection = {
        _id: new mongoose.Types.ObjectId(),
        ...req.body,
        toObject: sandbox.stub().returnsThis()
      };

      PeriodStub.findById.resolves(mockPeriod);
      SectionStub.find.returns({ sort });
      SectionStub.create.resolves(mockSection);

      await sectionController.createSection(req, res, next);

      expect(sort.calledWith({ day: -1, createdAt: -1 })).to.be.true;
      expect(day8Section.day).to.equal(9);
      expect(day7Section.day).to.equal(8);
      expect(day8Section.save.calledBefore(day7Section.save)).to.be.true;
      expect(SectionStub.create.getCall(0).args[0].day).to.equal(7);
      expect(mockPeriod.totalDays).to.equal(24);
      expect(mockPeriod.save.calledOnce).to.be.true;
      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.getCall(0).args[0].message).to.equal(
        '课程创建成功，已顺延 2 个后续课节'
      );
    });

    it('应该返回404当期次不存在', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.body = { periodId, day: 1, title: '新课节' };

      PeriodStub.findById.resolves(null);

      await sectionController.createSection(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('updateSection (Admin)', () => {
    it('应该更新课节信息', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };
      req.body = { title: '更新的标题', content: '更新的内容' };

      const mockSection = {
        _id: sectionId,
        title: '原始标题',
        content: '原始内容',
        ...req.body,
        save: sandbox.stub().resolves(),
        toObject: sandbox.stub().returnsThis()
      };

      // 修复：updateSection 使用 findById + save，而不是 findByIdAndUpdate
      SectionStub.findById.resolves(mockSection);

      await sectionController.updateSection(req, res, next);

      expect(SectionStub.findById.called).to.be.true;
      expect(mockSection.save.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该更新结营视频字段', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };
      req.body = {
        closingVideo: {
          url: '/uploads/tenants/default/new-closing.mp4',
          coverUrl: '/uploads/tenants/default/new-closing-cover.jpg'
        }
      };

      const mockSection = {
        _id: sectionId,
        title: '结营词',
        closingVideo: null,
        save: sandbox.stub().resolves(),
        toObject: sandbox.stub().returnsThis()
      };
      SectionStub.findById.resolves(mockSection);

      await sectionController.updateSection(req, res, next);

      expect(mockSection.closingVideo).to.deep.equal(req.body.closingVideo);
      expect(mockSection.save.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该返回404当课节不存在', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };
      req.body = { title: '新标题' };

      SectionStub.findById.resolves(null);

      await sectionController.updateSection(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('uploadClosingVideo', () => {
    it('应该上传结营视频并返回元数据', async () => {
      req._resolvedTenantId = new mongoose.Types.ObjectId().toString();
      req.file = {
        filename: 'video_123.mp4',
        originalname: '结营视频.mp4',
        mimetype: 'video/mp4',
        size: 2048
      };

      await sectionController.uploadClosingVideo(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.include({
        url: '/uploads/tenants/test-slug/video_123.mp4',
        fileName: 'video_123.mp4',
        originalName: '结营视频.mp4',
        mimeType: 'video/mp4',
        size: 2048
      });
    });

    it('缺少视频文件时应该返回400', async () => {
      req.file = null;

      await sectionController.uploadClosingVideo(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('deleteSection (Admin)', () => {
    it('应该删除课节', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };

      const mockSection = {
        _id: sectionId,
        toObject: sandbox.stub().returns({ _id: sectionId })
      };

      // 修复：deleteSection 使用 findById 检查存在性，然后调用 findByIdAndDelete
      SectionStub.findById.resolves(mockSection);
      SectionStub.findByIdAndDelete.resolves(mockSection);

      await sectionController.deleteSection(req, res, next);

      expect(SectionStub.findById.called).to.be.true;
      expect(SectionStub.findByIdAndDelete.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('删除课节后应该把后续课节前移一天', async () => {
      const periodId = new mongoose.Types.ObjectId();
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };

      const deletedSection = createPersistedSection({
        _id: sectionId,
        periodId,
        day: 7,
        title: '要删除的课节'
      });
      const day8Section = createPersistedSection({ periodId, day: 8, title: '原第8天' });
      const day9Section = createPersistedSection({ periodId, day: 9, title: '原第9天' });
      const mockPeriod = createPersistedPeriod({ _id: periodId, totalDays: 24 });
      const sort = sandbox.stub().resolves([day8Section, day9Section]);

      SectionStub.findById.resolves(deletedSection);
      SectionStub.findByIdAndDelete.resolves(deletedSection);
      SectionStub.find.returns({ sort });
      PeriodStub.findById.resolves(mockPeriod);

      await sectionController.deleteSection(req, res, next);

      expect(sort.calledWith({ day: 1, createdAt: 1 })).to.be.true;
      expect(day8Section.day).to.equal(7);
      expect(day9Section.day).to.equal(8);
      expect(day8Section.save.calledBefore(day9Section.save)).to.be.true;
      expect(mockPeriod.totalDays).to.equal(23);
      expect(mockPeriod.save.calledOnce).to.be.true;
      expect(res.json.getCall(0).args[0].message).to.equal(
        '课程删除成功，已前移 2 个后续课节'
      );
    });

    it('应该返回404当课节不存在', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };

      SectionStub.findById.resolves(null);

      await sectionController.deleteSection(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('getAllSectionsByPeriod', () => {
    it('应该返回期次的所有课节（包括草稿）', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { page: 1, limit: 50 };

      const mockSections = [
        { _id: new mongoose.Types.ObjectId(), periodId, day: 1, title: '第一课', isPublished: true },
        { _id: new mongoose.Types.ObjectId(), periodId, day: 2, title: '第二课（草稿）', isPublished: false }
      ];

      const mockPeriod = { _id: periodId, name: '期次' };

      PeriodStub.findById.resolves(mockPeriod);
      SectionStub.countDocuments.resolves(2);
      const lean = sandbox.stub().resolves(mockSections);
      const select = sandbox.stub().returns({ lean });
      SectionStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select
      });

      await sectionController.getAllSectionsByPeriod(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('pagination');
      expect(responseData.data.list).to.deep.equal(mockSections);
      expect(
        select.calledWith(
          '_id periodId day title subtitle icon duration sortOrder order isPublished checkinCount createdAt updatedAt podcastUrl podcastDuration closingVideo'
        )
      ).to.be.true;
    });
  });

  describe('getTodayTask', () => {
    it('应该返回今日任务', async () => {
      sandbox.useFakeTimers(new Date('2026-07-07T08:00:00.000Z'));
      const userId = new mongoose.Types.ObjectId().toString();
      const periodId = new mongoose.Types.ObjectId();
      const sectionId = new mongoose.Types.ObjectId();
      req.user = { userId };

      const mockEnrollments = [{
        _id: new mongoose.Types.ObjectId(),
        userId,
        status: 'active',
        periodId: {
          _id: periodId,
          name: '期次',
          title: '期次标题',
          startDate: new Date('2026-07-05T16:00:00.000Z'),
          endDate: new Date('2026-07-27T15:59:59.999Z'),
          totalDays: 23
        }
      }];
      const mockSection = {
        _id: sectionId,
        title: '第一天 品德成功论',
        day: 1,
        icon: '📖',
        meditation: '',
        question: '',
        reflection: '',
        action: '',
        learn: ''
      };

      EnrollmentStub.find.returns({
        populate: sandbox.stub().resolves(mockEnrollments)
      });
      SectionStub.findOne.returns({
        select: sandbox.stub().resolves(mockSection)
      });
      CheckinStub.findOne.resolves(null);
      UserReadingCompletionStub.findOne.returns({
        select: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(null)
      });
      CheckinStub.find.returns({
        populate: sandbox.stub().returnsThis(),
        limit: sandbox.stub().resolves([])
      });
      CheckinStub.countDocuments.resolves(5);

      await sectionController.getTodayTask(req, res, next);

      expect(next.called).to.equal(false);
      expect(SectionStub.findOne.calledWithMatch({
        periodId,
        day: 1,
        isPublished: true
      })).to.equal(true);
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.sectionId).to.equal(sectionId);
      expect(responseData.data.day).to.equal(1);
      expect(responseData.data.checkinCount).to.equal(5);
    });

    it('期次结束后不应该返回第一天任务', async () => {
      sandbox.useFakeTimers(new Date('2026-07-06T08:00:00.000Z'));
      const userId = new mongoose.Types.ObjectId().toString();
      req.user = { userId };

      const mockEnrollments = [{
        _id: new mongoose.Types.ObjectId(),
        userId,
        status: 'completed',
        periodId: {
          _id: new mongoose.Types.ObjectId(),
          name: '韧性之树',
          title: '韧性之树',
          startDate: new Date('2026-06-12T16:00:00.000Z'),
          endDate: new Date('2026-07-04T16:00:00.000Z'),
          totalDays: 23
        }
      }];

      EnrollmentStub.find.returns({
        populate: sandbox.stub().resolves(mockEnrollments)
      });

      await sectionController.getTodayTask(req, res, next);

      expect(next.called).to.equal(false);
      expect(SectionStub.findOne.called).to.equal(false);
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.equal(null);
      expect(responseData.message).to.equal('暂无今日任务');
    });
  });
});
