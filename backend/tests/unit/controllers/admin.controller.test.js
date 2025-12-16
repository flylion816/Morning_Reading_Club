/**
 * Admin Controller 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Admin Controller', () => {
  let adminController;
  let sandbox;
  let req;
  let res;
  let next;
  let AdminStub;

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

    AdminStub = {
      findById: sandbox.stub(),
      findOne: sandbox.stub(),
      create: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub()
    };

    const jwtStub = {
      generateTokens: sandbox.stub(),
      verifyRefreshToken: sandbox.stub()
    };

    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        unauthorized: (msg) => ({ code: 401, message: msg })
      }
    };

    adminController = proxyquire(
      '../../../src/controllers/admin.controller',
      {
        '../models/Admin': AdminStub,
        '../utils/jwt': jwtStub,
        '../utils/response': responseUtils
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('adminLogin', () => {
    it('应该成功登录管理员', async () => {
      req.body = { email: 'admin@test.com', password: 'password123' };

      const mockAdmin = {
        _id: new mongoose.Types.ObjectId(),
        email: 'admin@test.com',
        password: 'hashed_password',
        name: '管理员',
        role: 'admin'
      };

      AdminStub.findOne.resolves(mockAdmin);

      await adminController.adminLogin(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回400当缺少email或password', async () => {
      req.body = { email: 'admin@test.com' };

      await adminController.adminLogin(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('adminLogout', () => {
    it('应该成功退出登录', async () => {
      await adminController.adminLogout(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getCurrentAdmin', () => {
    it('应该返回当前管理员信息', async () => {
      const adminId = new mongoose.Types.ObjectId();
      req.user = { id: adminId };

      const mockAdmin = {
        _id: adminId,
        name: '管理员',
        email: 'admin@test.com',
        role: 'admin'
      };

      AdminStub.findById.resolves(mockAdmin);

      await adminController.getCurrentAdmin(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('name');
    });
  });

  describe('updateAdminProfile', () => {
    it('应该更新管理员资料', async () => {
      const adminId = new mongoose.Types.ObjectId();
      req.user = { id: adminId };
      req.body = { name: '新名称', phone: '13800138000' };

      const mockAdmin = {
        _id: adminId,
        name: '新名称',
        phone: '13800138000',
        save: sandbox.stub().resolves()
      };

      AdminStub.findById.resolves(mockAdmin);

      await adminController.updateAdminProfile(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('changePassword', () => {
    it('应该成功修改密码', async () => {
      const adminId = new mongoose.Types.ObjectId();
      req.user = { id: adminId };
      req.body = {
        oldPassword: 'oldpass123',
        newPassword: 'newpass123'
      };

      const mockAdmin = {
        _id: adminId,
        password: 'hashed_old',
        save: sandbox.stub().resolves()
      };

      AdminStub.findById.resolves(mockAdmin);

      await adminController.changePassword(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });
});
