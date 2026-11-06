/**
 * Backup Controller 单元测试
 *
 * 测试覆盖：
 * - updateMongodbRecord: 更新 MongoDB 单条记录
 * - deleteMongodbRecord: 删除 MongoDB 单条记录
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const mongoose = require('mongoose');

describe('Backup Controller', () => {
  let backupController;
  let sandbox;
  let req;
  let res;
  let UserStub;
  let AdminStub;
  let PeriodStub;
  let publishSyncEventStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    req = {
      body: {},
      params: {},
      query: {},
      resolvedTenantId: new mongoose.Types.ObjectId()
    };

    res = {
      status: sandbox.stub().returnsThis(),
      json: sandbox.stub().returnsThis()
    };

    // Mock MongoDB 模型
    UserStub = {
      find: sandbox.stub(),
      findById: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      countDocuments: sandbox.stub().resolves(0)
    };

    AdminStub = {
      findById: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      countDocuments: sandbox.stub().resolves(0)
    };

    PeriodStub = {
      findById: sandbox.stub(),
      findByIdAndUpdate: sandbox.stub(),
      findByIdAndDelete: sandbox.stub(),
      countDocuments: sandbox.stub().resolves(0)
    };

    // Mock sync service
    publishSyncEventStub = sandbox.stub();

    // Mock response utils
    const responseUtils = {
      success: (data, message) => ({ code: 200, message, data }),
      errors: {
        badRequest: (msg) => ({ code: 400, message: msg }),
        forbidden: (msg) => ({ code: 403, message: msg }),
        notFound: (msg) => ({ code: 404, message: msg }),
        serverError: (msg) => ({ code: 500, message: msg })
      }
    };

    // Mock logger
    const loggerStub = {
      info: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub()
    };

    backupController = proxyquire(
      '../../../src/controllers/backup.controller',
      {
        '../models/User': UserStub,
        '../models/Admin': AdminStub,
        '../models/Period': PeriodStub,
        '../models/Section': sandbox.stub(),
        '../models/Checkin': sandbox.stub(),
        '../models/Enrollment': sandbox.stub(),
        '../models/Payment': sandbox.stub(),
        '../models/Insight': sandbox.stub(),
        '../models/InsightRequest': sandbox.stub(),
        '../models/Comment': sandbox.stub(),
        '../models/Notification': sandbox.stub(),
        '../utils/response': responseUtils,
        '../utils/logger': loggerStub,
        '../services/sync.service': { publishSyncEvent: publishSyncEventStub },
        '../config/database': { mysqlPool: {} },
        '../services/mysql-backup.service': {}
      }
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  // =========================================================================
  // updateMongodbRecord 测试
  // =========================================================================

  describe('updateMongodbRecord', () => {
    it('应该成功更新 MongoDB 记录', async () => {
      const userId = new mongoose.Types.ObjectId();
      const updateData = {
        nickname: '新昵称',
        signature: '新签名'
      };

      req.body = {
        table: 'users',
        id: userId.toString(),
        data: updateData
      };

      const mockUser = {
        _id: userId,
        nickname: '旧昵称',
        signature: '旧签名',
        toObject: sandbox.stub().returns({
          _id: userId,
          nickname: '新昵称',
          signature: '新签名'
        })
      };

      UserStub.findByIdAndUpdate.returns({ exec: () => Promise.resolve(mockUser) });

      await backupController.updateMongodbRecord(req, res);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
      expect(responseData.message).to.include('记录已更新');
      expect(publishSyncEventStub.called).to.be.true;

      // 验证 publishSyncEvent 参数
      const syncEventArg = publishSyncEventStub.getCall(0).args[0];
      expect(syncEventArg.type).to.equal('update');
      expect(syncEventArg.collection).to.equal('users');
      expect(syncEventArg.documentId).to.equal(userId.toString());
    });

    it('应该防止修改只读字段 (_id)', async () => {
      const userId = new mongoose.Types.ObjectId();
      const newId = new mongoose.Types.ObjectId();

      req.body = {
        table: 'users',
        id: userId.toString(),
        data: {
          _id: newId,  // 试图修改 _id
          nickname: '新昵称'
        }
      };

      const mockUser = {
        _id: userId,
        nickname: '新昵称',
        toObject: sandbox.stub().returns({
          _id: userId,  // _id 应该保持原值
          nickname: '新昵称'
        })
      };

      UserStub.findByIdAndUpdate.returns({ exec: () => Promise.resolve(mockUser) });

      await backupController.updateMongodbRecord(req, res);

      // 验证传给 findByIdAndUpdate 的数据中不包含 _id
      const updateCall = UserStub.findByIdAndUpdate.getCall(0);
      const safeData = updateCall.args[1];
      expect(safeData).to.not.have.property('_id');
    });

    it('应该防止修改只读字段 (createdAt)', async () => {
      const userId = new mongoose.Types.ObjectId();

      req.body = {
        table: 'users',
        id: userId.toString(),
        data: {
          createdAt: new Date('2000-01-01'),  // 试图修改 createdAt
          nickname: '新昵称'
        }
      };

      const mockUser = {
        _id: userId,
        nickname: '新昵称',
        toObject: sandbox.stub().returns({
          _id: userId,
          nickname: '新昵称'
        })
      };

      UserStub.findByIdAndUpdate.returns({ exec: () => Promise.resolve(mockUser) });

      await backupController.updateMongodbRecord(req, res);

      // 验证传给 findByIdAndUpdate 的数据中不包含 createdAt
      const updateCall = UserStub.findByIdAndUpdate.getCall(0);
      const safeData = updateCall.args[1];
      expect(safeData).to.not.have.property('createdAt');
    });

    it('应该返回 400 当缺少 table 参数', async () => {
      req.body = {
        id: 'some-id',
        data: { nickname: '新昵称' }
      };

      await backupController.updateMongodbRecord(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.message).to.include('缺少参数');
    });

    it('应该返回 400 当缺少 id 参数', async () => {
      req.body = {
        table: 'users',
        data: { nickname: '新昵称' }
      };

      await backupController.updateMongodbRecord(req, res);

      expect(res.status.calledWith(400)).to.be.true;
    });

    it('应该返回 400 当缺少 data 参数', async () => {
      req.body = {
        table: 'users',
        id: 'some-id'
      };

      await backupController.updateMongodbRecord(req, res);

      expect(res.status.calledWith(400)).to.be.true;
    });

    it('应该返回 400 当集合名无效', async () => {
      req.body = {
        table: 'invalid_table',
        id: 'some-id',
        data: { nickname: '新昵称' }
      };

      await backupController.updateMongodbRecord(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.message).to.include('无效的集合名');
    });

    it('应该返回 404 当记录不存在', async () => {
      req.body = {
        table: 'users',
        id: new mongoose.Types.ObjectId().toString(),
        data: { nickname: '新昵称' }
      };

      UserStub.findByIdAndUpdate.returns({ exec: () => Promise.resolve(null) });

      await backupController.updateMongodbRecord(req, res);

      expect(res.status.calledWith(404)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.message).to.include('记录不存在');
      expect(publishSyncEventStub.called).to.be.false;  // 失败时不发布事件
    });

    it('应该返回 500 当发生异常', async () => {
      req.body = {
        table: 'users',
        id: 'some-id',
        data: { nickname: '新昵称' }
      };

      UserStub.findByIdAndUpdate.returns({ exec: () => Promise.reject(new Error('Database error')) });

      await backupController.updateMongodbRecord(req, res);

      expect(res.status.calledWith(500)).to.be.true;
    });

    it('应在数据库写入之前拒绝通过通用接口修改管理员和安全字段', async () => {
      const dangerousUpdates = [
        { table: 'admins', data: { role: 'platform_superadmin' } },
        { table: 'users', data: { role: 'admin' } },
        { table: 'users', data: { tenantId: new mongoose.Types.ObjectId().toString() } },
        { table: 'users', data: { $set: { nickname: 'operator injection' } } },
        { table: 'users', data: { 'profile.role': 'admin' } },
        { table: 'users', data: { a: { b: { c: { d: { e: { f: { $set: { nickname: 'deep operator' } } } } } } } } }
      ];
      for (const testCase of dangerousUpdates) {
        const response = { status: sandbox.stub().returnsThis(), json: sandbox.stub().returnsThis() };
        await backupController.updateMongodbRecord({
          body: { ...testCase, id: new mongoose.Types.ObjectId().toString() },
          resolvedTenantId: new mongoose.Types.ObjectId()
        }, response);
        expect(response.status.calledWith(403)).to.equal(true);
      }
      expect(AdminStub.findByIdAndUpdate.called).to.equal(false);
      expect(UserStub.findByIdAndUpdate.called).to.equal(false);
      expect(publishSyncEventStub.called).to.equal(false);
    });

    it('应拒绝没有具体租户上下文的记录修改', async () => {
      req.resolvedTenantId = null;
      req.body = { table: 'users', id: new mongoose.Types.ObjectId().toString(), data: { nickname: '测试' } };
      await backupController.updateMongodbRecord(req, res);
      expect(res.status.calledWith(400)).to.equal(true);
      expect(UserStub.findByIdAndUpdate.called).to.equal(false);
    });
  });

  // =========================================================================
  // deleteMongodbRecord 测试
  // =========================================================================

  describe('deleteMongodbRecord', () => {
    it('应该成功删除 MongoDB 记录', async () => {
      const userId = new mongoose.Types.ObjectId();

      req.query = {
        table: 'users',
        id: userId.toString()
      };

      const mockUser = {
        _id: userId,
        nickname: '测试用户',
        toObject: sandbox.stub().returns({
          _id: userId,
          nickname: '测试用户'
        })
      };

      UserStub.findById.returns({ exec: () => Promise.resolve(mockUser) });
      UserStub.findByIdAndDelete.returns({ exec: () => Promise.resolve(mockUser) });

      await backupController.deleteMongodbRecord(req, res);

      expect(res.json.called).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.code).to.equal(200);
      expect(responseData.message).to.include('记录已删除');
      expect(UserStub.findByIdAndDelete.called).to.be.true;
      expect(publishSyncEventStub.called).to.be.true;

      // 验证 publishSyncEvent 参数
      const syncEventArg = publishSyncEventStub.getCall(0).args[0];
      expect(syncEventArg.type).to.equal('delete');
      expect(syncEventArg.collection).to.equal('users');
      expect(syncEventArg.documentId).to.equal(userId.toString());
    });

    it('应禁止通过通用记录接口读取或删除管理员/支付记录', async () => {
      for (const table of ['admins', 'payments']) {
        const response = { status: sandbox.stub().returnsThis(), json: sandbox.stub().returnsThis() };
        await backupController.deleteMongodbRecord({ query: { table, id: new mongoose.Types.ObjectId().toString() } }, response);
        expect(response.status.calledWith(403)).to.equal(true);
      }
      expect(AdminStub.findById.called).to.equal(false);
      expect(AdminStub.findByIdAndDelete.called).to.equal(false);
    });

    it('应该返回 400 当缺少 table 参数', async () => {
      req.query = {
        id: 'some-id'
      };

      await backupController.deleteMongodbRecord(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.message).to.include('缺少参数');
    });

    it('应该返回 400 当缺少 id 参数', async () => {
      req.query = {
        table: 'users'
      };

      await backupController.deleteMongodbRecord(req, res);

      expect(res.status.calledWith(400)).to.be.true;
    });

    it('应该返回 400 当集合名无效', async () => {
      req.query = {
        table: 'invalid_table',
        id: 'some-id'
      };

      await backupController.deleteMongodbRecord(req, res);

      expect(res.status.calledWith(400)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.message).to.include('无效的集合名');
    });

    it('应该返回 404 当记录不存在', async () => {
      req.query = {
        table: 'users',
        id: new mongoose.Types.ObjectId().toString()
      };

      UserStub.findById.returns({ exec: () => Promise.resolve(null) });

      await backupController.deleteMongodbRecord(req, res);

      expect(res.status.calledWith(404)).to.be.true;
      const responseData = res.json.getCall(0).args[0];
      expect(responseData.message).to.include('记录不存在');
      expect(UserStub.findByIdAndDelete.called).to.be.false;
      expect(publishSyncEventStub.called).to.be.false;
    });

    it('应该在删除前查询完整的文档数据', async () => {
      const userId = new mongoose.Types.ObjectId();

      req.query = {
        table: 'users',
        id: userId.toString()
      };

      const mockUser = {
        _id: userId,
        nickname: '测试用户',
        toObject: sandbox.stub().returns({
          _id: userId,
          nickname: '测试用户'
        })
      };

      UserStub.findById.returns({ exec: () => Promise.resolve(mockUser) });
      UserStub.findByIdAndDelete.returns({ exec: () => Promise.resolve(mockUser) });

      await backupController.deleteMongodbRecord(req, res);

      // 验证先调用 findById 再调用 findByIdAndDelete
      expect(UserStub.findById.calledBefore(UserStub.findByIdAndDelete)).to.be.true;

      // 验证 publishSyncEvent 包含完整的文档数据
      const syncEventArg = publishSyncEventStub.getCall(0).args[0];
      expect(syncEventArg.data).to.deep.equal({
        _id: userId,
        nickname: '测试用户'
      });
    });

    it('应该返回 500 当发生异常', async () => {
      req.query = {
        table: 'users',
        id: 'some-id'
      };

      UserStub.findById.returns({ exec: () => Promise.reject(new Error('Database error')) });

      await backupController.deleteMongodbRecord(req, res);

      expect(res.status.calledWith(500)).to.be.true;
    });
  });

  describe('bounded table read', () => {
    it('rejects zero, negative, invalid and excessive page sizes before running a query', async () => {
      for (const limit of ['0', '-1', '101', 'invalid']) {
        const response = { status: sandbox.stub().returnsThis(), json: sandbox.stub().returnsThis() };
        await backupController.getMongodbTableData({ query: { table: 'users', page: '1', limit } }, response, sandbox.stub());
        expect(response.status.calledWith(400)).to.equal(true);
      }
      expect(UserStub.find.called).to.equal(false);
    });
  });
});
