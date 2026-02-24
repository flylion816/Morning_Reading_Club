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
        unauthorized: (msg) => ({ code: 401, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg }),
        serverError: (msg) => ({ code: 500, message: msg })
      }
    };

    const mysqlBackupServiceStub = {
      syncAdmin: sandbox.stub()
    };

    const loggerStub = {
      error: sandbox.stub(),
      warn: sandbox.stub(),
      info: sandbox.stub()
    };

    adminController = proxyquire(
      '../../../src/controllers/admin.controller',
      {
        '../models/Admin': AdminStub,
        '../utils/jwt': jwtStub,
        '../utils/response': responseUtils,
        '../services/mysql-backup.service': mysqlBackupServiceStub,
        '../utils/logger': loggerStub
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('login', () => {
    it('应该成功登录管理员', async () => {
      req.body = { email: 'admin@test.com', password: 'password123' };

      const mockAdmin = {
        _id: new mongoose.Types.ObjectId(),
        email: 'admin@test.com',
        password: 'hashed_password',
        name: '管理员',
        role: 'admin',
        status: 'active',
        lastLoginAt: new Date(),
        loginCount: 0,
        comparePassword: sandbox.stub().resolves(true),
        save: sandbox.stub().resolves(),
        toJSON: function() {
          return {
            _id: this._id,
            email: this.email,
            name: this.name,
            role: this.role
          };
        }
      };

      AdminStub.findOne.withArgs({ email: 'admin@test.com' }).returns({
        select: sandbox.stub().resolves(mockAdmin)
      });

      await adminController.login(req, res, next);

      expect(res.json.called).to.be.true;
    });

    it('应该返回400当缺少email或password', async () => {
      req.body = { email: 'admin@test.com' };

      await adminController.login(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('logout', () => {
    it('应该成功退出登录', async () => {
      await adminController.logout(req, res, next);

      expect(res.json.called).to.be.true;
    });
  });

  describe('getProfile', () => {
    it('应该返回当前管理员信息', async () => {
      const adminId = new mongoose.Types.ObjectId();
      req.admin = { id: adminId };

      const mockAdmin = {
        _id: adminId,
        name: '管理员',
        email: 'admin@test.com',
        role: 'admin',
        toJSON: sandbox.stub().returns({
          _id: adminId,
          name: '管理员',
          email: 'admin@test.com',
          role: 'admin'
        })
      };

      AdminStub.findById.resolves(mockAdmin);

      await adminController.getProfile(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('name');
    });
  });

  describe('updateAdmin', () => {
    it('应该更新管理员资料', async () => {
      const adminId = new mongoose.Types.ObjectId();
      req.admin = { id: adminId, role: 'superadmin' };
      req.params = { id: adminId };
      req.body = { name: '新名称' };

      const mockAdmin = {
        _id: adminId,
        name: '新名称',
        save: sandbox.stub().resolves(),
        toJSON: sandbox.stub().returns({
          _id: adminId,
          name: '新名称'
        })
      };

      AdminStub.findById.resolves(mockAdmin);

      await adminController.updateAdmin(req, res, next);

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

  describe('getAdmins', () => {
    it('应该返回管理员列表', async () => {
      req.query = { page: 1, limit: 10 };

      const mockAdmins = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: '管理员1',
          email: 'admin1@test.com',
          role: 'super_admin',
          toJSON: sandbox.stub().returnsThis()
        }
      ];

      AdminStub.find.returns({
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        sort: sandbox.stub().resolves(mockAdmins)
      });
      AdminStub.countDocuments.resolves(1);

      await adminController.getAdmins(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('list');
      expect(responseData.data).to.have.property('total');
    });
  });

  describe('createAdmin', () => {
    it('应该创建新管理员', async () => {
      req.body = {
        name: '新管理员',
        email: 'newadmin@test.com',
        password: 'password123',
        role: 'operator'
      };

      const mockNewAdmin = {
        _id: new mongoose.Types.ObjectId(),
        ...req.body,
        status: 'active'
      };

      AdminStub.findOne.resolves(null);
      AdminStub.create.resolves(mockNewAdmin);

      await adminController.createAdmin(req, res, next);

      expect(res.status.calledWith(201)).to.be.true;
      expect(AdminStub.create.called).to.be.true;
    });

    it('应该返回400当邮箱已存在', async () => {
      req.body = {
        name: '管理员',
        email: 'exist@test.com',
        password: 'password123'
      };

      const existingAdmin = {
        _id: new mongoose.Types.ObjectId(),
        email: 'exist@test.com'
      };

      AdminStub.findOne.resolves(existingAdmin);

      await adminController.createAdmin(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe('refreshToken', () => {
    it('应该刷新Token', async () => {
      const adminId = new mongoose.Types.ObjectId();
      req.admin = { id: adminId };

      const mockAdmin = {
        _id: adminId,
        email: 'admin@test.com',
        role: 'super_admin',
        status: 'active'
      };

      AdminStub.findById.resolves(mockAdmin);

      await adminController.refreshToken(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('accessToken');
    });

    it('应该返回401当没有授权', async () => {
      req.admin = null;

      await adminController.refreshToken(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
    });
  });
});
