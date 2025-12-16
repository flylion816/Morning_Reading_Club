/**
 * Audit Helper Utils 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Audit Helper Utils', () => {
  let sandbox;
  let auditServiceStub;
  let loggerStub;
  let AuditHelper;
  let req;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock audit service
    auditServiceStub = {
      createLog: sandbox.stub().resolves({ _id: 'audit_log_123' })
    };

    // Mock logger
    loggerStub = {
      info: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub(),
      debug: sandbox.stub()
    };

    // Load AuditHelper with mocked dependencies
    AuditHelper = proxyquire('../../../src/utils/auditHelper', {
      '../services/audit.service': auditServiceStub,
      './logger': loggerStub
    });

    // Setup mock request object
    req = {
      user: {
        id: 'admin_123',
        name: 'Admin User'
      },
      headers: {
        'user-agent': 'Mozilla/5.0 Test Browser'
      },
      get: sandbox.stub().returns('Mozilla/5.0 Test Browser'),
      socket: {
        remoteAddress: '127.0.0.1'
      },
      ip: '127.0.0.1'
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('logBatchApprove 方法', () => {
    it('应该是异步方法', () => {
      const result = AuditHelper.logBatchApprove(req, ['id1', 'id2']);

      expect(result).to.be.a('Promise');
    });

    it('应该记录批量批准操作', async () => {
      await AuditHelper.logBatchApprove(req, ['id1', 'id2', 'id3']);

      expect(auditServiceStub.createLog.called).to.be.true;
      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.actionType).to.equal('BATCH_UPDATE');
      expect(log.description).to.equal('批量批准');
    });

    it('应该包含正确的管理员信息', async () => {
      await AuditHelper.logBatchApprove(req, ['id1']);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.adminId).to.equal('admin_123');
      expect(log.adminName).to.equal('Admin User');
    });

    it('应该包含资源类型', async () => {
      await AuditHelper.logBatchApprove(req, ['id1', 'id2'], 'enrollment');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.resourceType).to.equal('enrollment');
    });

    it('应该包含自定义描述', async () => {
      await AuditHelper.logBatchApprove(req, ['id1'], 'user', '批量启用用户');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.description).to.equal('批量启用用户');
    });

    it('应该记录 ID 列表和数量', async () => {
      const ids = ['id1', 'id2', 'id3'];
      await AuditHelper.logBatchApprove(req, ids);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.details.batchCount).to.equal(3);
      expect(log.details.resourceIds).to.deep.equal(ids);
    });

    it('应该包含客户端 IP 和 UserAgent', async () => {
      await AuditHelper.logBatchApprove(req, ['id1']);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.ipAddress).to.be.a('string');
      expect(log.userAgent).to.be.a('string');
    });

    it('应该设置成功状态', async () => {
      await AuditHelper.logBatchApprove(req, ['id1']);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.status).to.equal('success');
    });

    it('应该处理 audit service 的错误', async () => {
      auditServiceStub.createLog.rejects(new Error('Database error'));

      await AuditHelper.logBatchApprove(req, ['id1']);

      // 应该记录错误但不抛出
      expect(loggerStub.error.called).to.be.true;
    });
  });

  describe('logBatchReject 方法', () => {
    it('应该记录批量拒绝操作', async () => {
      await AuditHelper.logBatchReject(req, ['id1', 'id2']);

      expect(auditServiceStub.createLog.called).to.be.true;
      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.actionType).to.equal('BATCH_UPDATE');
      expect(log.description).to.equal('批量拒绝');
    });

    it('应该包含拒绝原因', async () => {
      const reason = '不符合条件';
      await AuditHelper.logBatchReject(req, ['id1', 'id2'], reason);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.details.reason).to.equal(reason);
    });

    it('应该支持自定义资源类型和描述', async () => {
      await AuditHelper.logBatchReject(req, ['id1'], '不适当的语言', 'comment', '批量删除违规评论');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.resourceType).to.equal('comment');
      expect(log.description).to.equal('批量删除违规评论');
    });

    it('应该记录资源数量和 ID 列表', async () => {
      const ids = ['id1', 'id2', 'id3', 'id4'];
      await AuditHelper.logBatchReject(req, ids, '未通过审核');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.details.batchCount).to.equal(4);
      expect(log.details.resourceIds).to.deep.equal(ids);
    });
  });

  describe('logBatchDelete 方法', () => {
    it('应该记录批量删除操作', async () => {
      await AuditHelper.logBatchDelete(req, ['id1', 'id2']);

      expect(auditServiceStub.createLog.called).to.be.true;
      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.actionType).to.equal('BATCH_DELETE');
      expect(log.description).to.equal('批量删除');
    });

    it('应该包含自定义资源类型', async () => {
      await AuditHelper.logBatchDelete(req, ['id1'], 'enrollment');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.resourceType).to.equal('enrollment');
    });

    it('应该包含自定义描述', async () => {
      await AuditHelper.logBatchDelete(req, ['id1', 'id2'], 'user', '批量删除过期账户');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.description).to.equal('批量删除过期账户');
    });

    it('应该记录 ID 列表和数量', async () => {
      const ids = ['id1', 'id2', 'id3'];
      await AuditHelper.logBatchDelete(req, ids);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.details.batchCount).to.equal(3);
      expect(log.details.resourceIds).to.deep.equal(ids);
    });
  });

  describe('logAction 方法', () => {
    it('应该记录单个操作', async () => {
      await AuditHelper.logAction(
        req,
        'UPDATE',
        'enrollment',
        'enrollment_123',
        'enrollment record',
        '编辑报名'
      );

      expect(auditServiceStub.createLog.called).to.be.true;
      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.actionType).to.equal('UPDATE');
      expect(log.resourceType).to.equal('enrollment');
      expect(log.resourceId).to.equal('enrollment_123');
    });

    it('应该包含资源名称', async () => {
      await AuditHelper.logAction(
        req,
        'DELETE',
        'comment',
        'comment_456',
        'User Comment',
        '删除评论'
      );

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.resourceName).to.equal('User Comment');
    });

    it('应该包含变更信息', async () => {
      const changes = {
        status: { before: 'pending', after: 'approved' },
        approvedBy: { before: null, after: 'admin_123' }
      };

      await AuditHelper.logAction(
        req,
        'UPDATE',
        'enrollment',
        'enrollment_789',
        'enrollment',
        '批准报名',
        changes
      );

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.details.changes).to.deep.equal(changes);
    });

    it('应该支持没有变更信息的操作', async () => {
      await AuditHelper.logAction(
        req,
        'VIEW',
        'user',
        'user_001',
        'User Profile',
        '查看用户信息'
      );

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.details.changes).to.be.null;
    });

    it('应该设置成功状态', async () => {
      await AuditHelper.logAction(req, 'CREATE', 'checkin', 'checkin_001', 'Checkin', '创建打卡');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.status).to.equal('success');
    });
  });

  describe('logLogin 方法', () => {
    it('应该记录登录事件', async () => {
      await AuditHelper.logLogin(req, 'admin_id_123', 'Administrator');

      expect(auditServiceStub.createLog.called).to.be.true;
      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.actionType).to.equal('LOGIN');
      expect(log.resourceType).to.equal('system');
      expect(log.description).to.equal('管理员登录');
    });

    it('应该包含管理员 ID 和名称', async () => {
      await AuditHelper.logLogin(req, 'admin_456', 'John Doe');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.adminId).to.equal('admin_456');
      expect(log.adminName).to.equal('John Doe');
    });

    it('应该记录 IP 和 UserAgent', async () => {
      await AuditHelper.logLogin(req, 'admin_789', 'Admin');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.ipAddress).to.be.a('string');
      expect(log.userAgent).to.be.a('string');
    });

    it('应该设置成功状态', async () => {
      await AuditHelper.logLogin(req, 'admin_id', 'Admin Name');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.status).to.equal('success');
    });
  });

  describe('logLogout 方法', () => {
    it('应该记录登出事件', async () => {
      await AuditHelper.logLogout(req);

      expect(auditServiceStub.createLog.called).to.be.true;
      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.actionType).to.equal('LOGOUT');
      expect(log.description).to.equal('管理员登出');
    });

    it('应该从 req.user 获取管理员信息', async () => {
      await AuditHelper.logLogout(req);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.adminId).to.equal('admin_123');
      expect(log.adminName).to.equal('Admin User');
    });

    it('应该处理缺少 req.user 的情况', async () => {
      const emptyReq = {
        headers: { 'user-agent': 'Test' },
        get: sandbox.stub().returns('Test'),
        socket: { remoteAddress: '127.0.0.1' },
        ip: '127.0.0.1'
      };

      await AuditHelper.logLogout(emptyReq);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.adminId).to.be.undefined;
    });
  });

  describe('logError 方法', () => {
    it('应该记录错误操作', async () => {
      await AuditHelper.logError(req, 'UPDATE', 'enrollment', '字段验证失败');

      expect(auditServiceStub.createLog.called).to.be.true;
      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.actionType).to.equal('UPDATE');
      expect(log.resourceType).to.equal('enrollment');
      expect(log.status).to.equal('failure');
    });

    it('应该包含错误消息', async () => {
      const errorMessage = '权限不足';
      await AuditHelper.logError(req, 'DELETE', 'user', errorMessage);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.description).to.include(errorMessage);
      expect(log.errorMessage).to.equal(errorMessage);
    });

    it('应该支持可选的 resourceId', async () => {
      await AuditHelper.logError(req, 'UPDATE', 'insight', '数据库错误', 'insight_123');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.resourceId).to.equal('insight_123');
    });

    it('应该处理缺少管理员信息的情况', async () => {
      const minimalReq = {
        headers: { 'user-agent': 'Test' },
        get: sandbox.stub().returns('Test'),
        socket: { remoteAddress: '127.0.0.1' },
        ip: '127.0.0.1'
      };

      await AuditHelper.logError(minimalReq, 'CREATE', 'section', '创建失败');

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.status).to.equal('failure');
    });
  });

  describe('getClientIp 方法', () => {
    it('应该从 x-forwarded-for header 提取 IP', () => {
      const testReq = {
        headers: { 'x-forwarded-for': '192.168.1.100, 10.0.0.1' }
      };

      const ip = AuditHelper.getClientIp(testReq);

      expect(ip).to.equal('192.168.1.100');
    });

    it('应该从 socket.remoteAddress 获取 IP', () => {
      const testReq = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      };

      const ip = AuditHelper.getClientIp(testReq);

      expect(ip).to.be.a('string');
    });

    it('应该从 req.ip 获取 IP', () => {
      const testReq = {
        headers: {},
        ip: '192.168.1.1'
      };

      const ip = AuditHelper.getClientIp(testReq);

      expect(ip).to.be.a('string');
    });

    it('应该在无法找到 IP 时返回 unknown', () => {
      const testReq = {
        headers: {}
      };

      const ip = AuditHelper.getClientIp(testReq);

      expect(ip).to.equal('unknown');
    });

    it('应该优先使用 x-forwarded-for', () => {
      const testReq = {
        headers: { 'x-forwarded-for': '10.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' },
        ip: '192.168.1.1'
      };

      const ip = AuditHelper.getClientIp(testReq);

      expect(ip).to.equal('10.0.0.1');
    });
  });

  describe('compareChanges 方法', () => {
    it('应该比较两个对象的差异', () => {
      const oldData = { name: 'Old', status: 'active' };
      const newData = { name: 'New', status: 'active' };

      const changes = AuditHelper.compareChanges(oldData, newData);

      expect(changes).to.have.property('name');
      expect(changes.name.before).to.equal('Old');
      expect(changes.name.after).to.equal('New');
    });

    it('应该忽略系统字段', () => {
      const oldData = {
        _id: '123',
        name: 'Old',
        createdAt: '2025-01-01',
        __v: 0
      };
      const newData = {
        _id: '123',
        name: 'New',
        createdAt: '2025-01-01',
        __v: 1
      };

      const changes = AuditHelper.compareChanges(oldData, newData);

      expect(changes).to.have.property('name');
      expect(changes).to.not.have.property('_id');
      expect(changes).to.not.have.property('createdAt');
      expect(changes).to.not.have.property('__v');
    });

    it('应该忽略密码字段', () => {
      const oldData = { name: 'User', password: 'old_hash' };
      const newData = { name: 'User', password: 'new_hash' };

      const changes = AuditHelper.compareChanges(oldData, newData);

      expect(changes).to.be.null; // 只有 password 改变，应该被忽略
    });

    it('应该支持指定追踪的字段', () => {
      const oldData = {
        name: 'Old',
        email: 'old@example.com',
        phone: '111111'
      };
      const newData = {
        name: 'New',
        email: 'new@example.com',
        phone: '222222'
      };

      const changes = AuditHelper.compareChanges(oldData, newData, ['name', 'email']);

      expect(changes).to.have.property('name');
      expect(changes).to.have.property('email');
      expect(changes).to.not.have.property('phone');
    });

    it('应该在没有变化时返回 null', () => {
      const oldData = { name: 'Same', status: 'active' };
      const newData = { name: 'Same', status: 'active' };

      const changes = AuditHelper.compareChanges(oldData, newData);

      expect(changes).to.be.null;
    });

    it('应该深度比较复杂对象', () => {
      const oldData = {
        profile: { city: 'Beijing', age: 25 }
      };
      const newData = {
        profile: { city: 'Shanghai', age: 25 }
      };

      const changes = AuditHelper.compareChanges(oldData, newData);

      expect(changes).to.have.property('profile');
      expect(changes.profile.before.city).to.equal('Beijing');
      expect(changes.profile.after.city).to.equal('Shanghai');
    });

    it('应该处理 null 和 undefined 值', () => {
      const oldData = { field: null };
      const newData = { field: 'value' };

      const changes = AuditHelper.compareChanges(oldData, newData);

      expect(changes).to.have.property('field');
      expect(changes.field.before).to.be.null;
      expect(changes.field.after).to.equal('value');
    });

    it('应该处理新增字段', () => {
      const oldData = { name: 'Old' };
      const newData = { name: 'New', newField: 'added' };

      const changes = AuditHelper.compareChanges(oldData, newData);

      expect(changes).to.have.property('name');
      expect(changes).to.have.property('newField');
    });

    it('应该处理删除字段', () => {
      const oldData = { name: 'Old', removedField: 'removed' };
      const newData = { name: 'New' };

      const changes = AuditHelper.compareChanges(oldData, newData);

      expect(changes).to.have.property('name');
      expect(changes).to.have.property('removedField');
    });
  });

  describe('边界情况', () => {
    it('应该处理空 ID 数组', async () => {
      await AuditHelper.logBatchApprove(req, []);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.details.batchCount).to.equal(0);
    });

    it('应该处理单个 ID', async () => {
      await AuditHelper.logBatchApprove(req, ['single_id']);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.details.batchCount).to.equal(1);
    });

    it('应该处理非常长的 ID 列表', async () => {
      const longIdList = Array.from({ length: 1000 }, (_, i) => `id_${i}`);
      await AuditHelper.logBatchApprove(req, longIdList);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.details.batchCount).to.equal(1000);
    });

    it('应该处理包含特殊字符的描述', async () => {
      const description = '批量批准 @特殊字符 !@#$%^&*()';
      await AuditHelper.logBatchApprove(req, ['id1'], 'resource', description);

      const call = auditServiceStub.createLog.getCall(0);
      const log = call.args[0];

      expect(log.description).to.equal(description);
    });

    it('应该处理缺少 headers 的请求', async () => {
      const minimalReq = {
        user: { id: 'admin', name: 'Admin' },
        headers: {},
        get: sandbox.stub().returns(''),
        socket: { remoteAddress: '127.0.0.1' },
        ip: '127.0.0.1'
      };

      await AuditHelper.logBatchApprove(minimalReq, ['id1']);

      expect(auditServiceStub.createLog.called).to.be.true;
    });
  });
});
