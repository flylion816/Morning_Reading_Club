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
  let jwtStub;
  let adminSessionServiceStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: {},
      admin: {
        role: 'platform_superadmin'
      },
      header: sandbox.stub().returns(null)
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis(),
      cookie: sandbox.stub().returnsThis(),
      clearCookie: sandbox.stub().returnsThis()
    };

    next = sandbox.stub();

    AdminStub = {
      findById: sandbox.stub(),
      findOne: sandbox.stub(),
      create: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      find: sandbox.stub(),
      countDocuments: sandbox.stub()
    };

    jwtStub = {
      generateTokens: sandbox.stub(),
      verifyRefreshToken: sandbox.stub(),
      verifyAdminRefreshToken: sandbox.stub(),
      generateAdminMaintenanceToken: sandbox.stub().returns('maintenance-token')
    };

    adminSessionServiceStub = {
      createAdminSession: sandbox.stub().resolves({
        sessionId: 'session-1',
        accessToken: 'admin-access-token',
        refreshToken: 'admin-refresh-token'
      }),
      rotateAdminSession: sandbox.stub().resolves({
        sessionId: 'session-1',
        accessToken: 'rotated-access-token',
        refreshToken: 'rotated-refresh-token'
      }),
      revokeAdminSession: sandbox.stub().resolves(),
      digestJti: sandbox.stub().callsFake(value => `digest:${value}`),
      getRefreshCookie: sandbox.stub().callsFake(request => {
        const raw = request.headers?.cookie || '';
        const pair = raw.split(';').map(item => item.trim()).find(item => item.startsWith('adminRefreshToken='));
        return pair ? decodeURIComponent(pair.slice('adminRefreshToken='.length)) : null;
      }),
      setRefreshCookie: sandbox.stub().callsFake((response, token) => response.cookie('adminRefreshToken', token)),
      clearRefreshCookie: sandbox.stub().callsFake(response => response.clearCookie('adminRefreshToken'))
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
      syncAdmin: sandbox.stub().resolves()
    };

    const auditHelperStub = {
      logLogin: sandbox.stub().resolves(),
      logAction: sandbox.stub().resolves(),
      compareChanges: sandbox.stub().returns({
        name: { before: '旧姓名', after: '新姓名' }
      })
    };

    const syncServiceStub = {
      publishSyncEvent: sandbox.stub()
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
        '../services/admin-session.service': adminSessionServiceStub,
        '../utils/response': responseUtils,
        '../services/mysql-backup.service': mysqlBackupServiceStub,
        '../utils/auditHelper': auditHelperStub,
        '../services/sync.service': syncServiceStub,
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
        toJSON() {
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
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('accessToken', 'admin-access-token');
      expect(responseData.data).to.have.property('token', 'admin-access-token');
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

    it('会话撤销依赖失败时不应伪装成成功登出', async () => {
      req.headers.cookie = 'adminRefreshToken=valid-refresh-token';
      jwtStub.verifyAdminRefreshToken.returns({ sub: 'admin-1', sid: 'session-1', jti: 'jti-1' });
      adminSessionServiceStub.revokeAdminSession.rejects(Object.assign(new Error('database unavailable'), { name: 'MongoNetworkError' }));

      await adminController.logout(req, res, next);

      expect(res.status.calledWith(503)).to.equal(true);
      expect(res.clearCookie.called).to.equal(false);
      expect(res.json.getCall(0).args[0].message).to.include('注销');
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

  describe('updateProfile', () => {
    it('应该更新当前管理员个人资料', async () => {
      const adminId = new mongoose.Types.ObjectId();
      req.admin = { id: adminId, name: '旧姓名', email: 'admin@test.com' };
      req.body = { name: '新姓名', avatar: 'https://example.com/avatar.jpg' };

      const mockAdmin = {
        _id: adminId,
        name: '旧姓名',
        avatar: null,
        save: sandbox.stub().resolves(),
        toJSON: sandbox.stub().returns({
          _id: adminId,
          name: '新姓名',
          avatar: 'https://example.com/avatar.jpg'
        }),
        toObject: sandbox.stub().returns({
          _id: adminId,
          name: '新姓名',
          avatar: 'https://example.com/avatar.jpg'
        })
      };

      AdminStub.findById.returns({
        select: sandbox.stub().resolves(mockAdmin)
      });

      await adminController.updateProfile(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.message).to.equal('个人资料已更新');
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
      req.admin = { role: 'tenant_admin', tenantId: 'tenant-123' };

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

      AdminStub.findOne.resolves(null);

      await adminController.createAdmin(req, res, next);

      expect(res.json.called).to.be.true;
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
    it('应该刷新Token并轮换HttpOnly refresh cookie', async () => {
      const adminId = new mongoose.Types.ObjectId();
      req.headers.cookie = 'adminRefreshToken=refresh-token';

      const mockAdmin = {
        _id: adminId,
        email: 'admin@test.com',
        role: 'super_admin',
        status: 'active',
        sessionVersion: 0,
        toJSON: sandbox.stub().returns({ _id: adminId, email: 'admin@test.com', role: 'super_admin' })
      };
      AdminStub.findById.returns({
        select: sandbox.stub().resolves(mockAdmin)
      });
      jwtStub.verifyAdminRefreshToken.returns({
        sub: adminId.toString(),
        sid: 'session-1',
        jti: 'jti-1',
        sessionVersion: 0
      });

      await adminController.refreshToken(req, res, next);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.data).to.have.property('accessToken', 'rotated-access-token');
      expect(responseData.data).to.have.property('token', 'rotated-access-token');
      expect(res.cookie.calledWith('adminRefreshToken', 'rotated-refresh-token')).to.be.true;
    });

    it('应该返回401当没有refresh cookie', async () => {
      await adminController.refreshToken(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
      expect(res.clearCookie.called).to.be.true;
    });

    it('刷新竞争失败时不应撤销已经成功轮换的会话', async () => {
      const adminId = new mongoose.Types.ObjectId();
      req.headers.cookie = 'adminRefreshToken=stale-refresh-token';
      AdminStub.findById.returns({
        select: sandbox.stub().resolves({
          _id: adminId,
          status: 'active',
          sessionVersion: 0,
          toJSON: sandbox.stub().returns({ _id: adminId })
        })
      });
      jwtStub.verifyAdminRefreshToken.returns({ sub: adminId.toString(), sid: 'session-1', jti: 'old-jti', sessionVersion: 0 });
      adminSessionServiceStub.rotateAdminSession.resolves(null);

      await adminController.refreshToken(req, res, next);

      expect(res.status.calledWith(401)).to.be.true;
      expect(adminSessionServiceStub.revokeAdminSession.called).to.equal(false);
      expect(adminSessionServiceStub.clearRefreshCookie.called).to.equal(false);
    });
  });
});
