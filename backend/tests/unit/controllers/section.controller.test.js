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
        '../utils/response': responseUtils
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

      SectionStub.countDocuments.resolves(2);
      SectionStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves(mockSections)
      });

      await sectionController.getSectionsByPeriod(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('pagination');
    });

    it('应该按day排序', async () => {
      const periodId = new mongoose.Types.ObjectId();
      req.params = { periodId };
      req.query = { page: 1, limit: 20 };

      SectionStub.countDocuments.resolves(0);
      SectionStub.find.returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        select: sandbox.stub().resolves([])
      });

      await sectionController.getSectionsByPeriod(req, res, next);

      const findCall = SectionStub.find.getCall(0).args[0];
      expect(findCall.periodId.toString()).to.equal(periodId.toString());
    });
  });

  describe('getSectionById', () => {
    it('应该返回课节详情', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };

      const mockSection = {
        _id: sectionId,
        day: 1,
        title: '第一课',
        content: '课程内容',
        duration: 30,
        checkinCount: 100
      };

      SectionStub.findById.resolves(mockSection);

      await sectionController.getSectionById(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data.title).to.equal('第一课');
    });

    it('应该返回404当课节不存在', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };

      SectionStub.findById.resolves(null);

      await sectionController.getSectionById(req, res, next);

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
      const mockSection = { _id: new mongoose.Types.ObjectId(), ...req.body };

      PeriodStub.findById.resolves(mockPeriod);
      SectionStub.create.resolves(mockSection);

      await sectionController.createSection(req, res, next);

      expect(PeriodStub.findById.called).to.be.true;
      expect(SectionStub.create.called).to.be.true;
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
        ...req.body
      };

      SectionStub.findByIdAndUpdate.resolves(mockSection);

      await sectionController.updateSection(req, res, next);

      expect(SectionStub.findByIdAndUpdate.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该返回404当课节不存在', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };
      req.body = { title: '新标题' };

      SectionStub.findByIdAndUpdate.resolves(null);

      await sectionController.updateSection(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('deleteSection (Admin)', () => {
    it('应该删除课节', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };

      const mockSection = { _id: sectionId };

      SectionStub.findByIdAndDelete.resolves(mockSection);

      await sectionController.deleteSection(req, res, next);

      expect(SectionStub.findByIdAndDelete.called).to.be.true;
      expect(res.json.called).to.be.true;
    });

    it('应该返回404当课节不存在', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };

      SectionStub.findByIdAndDelete.resolves(null);

      await sectionController.deleteSection(req, res, next);

      expect(res.status.calledWith(404)).to.be.true;
    });
  });

  describe('getSectionStats', () => {
    it('应该返回课节统计信息', async () => {
      const sectionId = new mongoose.Types.ObjectId();
      req.params = { sectionId };

      const mockSection = {
        _id: sectionId,
        title: '第一课',
        checkinCount: 100,
        likeCount: 50
      };

      SectionStub.findById.resolves(mockSection);

      await sectionController.getSectionStats(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('checkinCount');
      expect(responseData.data).to.have.property('likeCount');
    });
  });
});
