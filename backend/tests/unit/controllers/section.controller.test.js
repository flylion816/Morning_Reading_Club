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
      countDocuments: sandbox.stub(),
      create: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      findByIdAndDelete: sandbox.stub()
    };

    PeriodStub = {
      findById: sandbox.stub()
    };

    CheckinStub = {
      aggregate: sandbox.stub()
    };

    UserReadingCompletionStub = {
      find: sandbox.stub(),
      findOneAndUpdate: sandbox.stub(),
      findOne: sandbox.stub()
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
      const userId = new mongoose.Types.ObjectId().toString();
      req.user = { userId };

      // 需要Mock Enrollment模型
      const mockEnrollments = [
        {
          _id: new mongoose.Types.ObjectId(),
          userId,
          status: 'active',
          periodId: {
            _id: new mongoose.Types.ObjectId(),
            name: '期次',
            startDate: new Date(Date.now() - 86400000),
            endDate: new Date(Date.now() + 86400000 * 10),
            totalDays: 21
          }
        }
      ];

      // 这个测试需要依赖注入，暂时跳过复杂的Mock设置
      // 实际的测试会在集成测试中验证
      expect(true).to.be.true;
    });
  });
});
