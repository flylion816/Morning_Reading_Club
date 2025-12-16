/**
 * WebSocket Manager Utils 单元测试
 */

const { expect } = require('chai');
const sinon = require('sinon');

// Import WebSocketManager directly
const WebSocketManager = require('../../../src/utils/websocket');

describe('WebSocket Manager Utils', () => {
  let sandbox;
  let io;
  let manager;
  let socket;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock Socket.IO instance
    io = {
      on: sandbox.stub(),
      emit: sandbox.stub(),
      to: sandbox.stub().returnsThis(),
      getOpts: sandbox.stub().returns({})
    };

    // Create WebSocketManager instance
    manager = new WebSocketManager(io);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('初始化', () => {
    it('应该创建 WebSocketManager 实例', () => {
      expect(manager).to.be.an('instanceof', WebSocketManager);
    });

    it('应该初始化 userSockets 映射', () => {
      expect(manager.userSockets).to.be.a('Map');
      expect(manager.userSockets.size).to.equal(0);
    });

    it('应该初始化 socketUsers 映射', () => {
      expect(manager.socketUsers).to.be.a('Map');
      expect(manager.socketUsers.size).to.equal(0);
    });

    it('应该处理 null io 实例', () => {
      const nullManager = new WebSocketManager(null);
      expect(nullManager.io).to.be.null;
    });

    it('应该调用 initializeEvents', () => {
      // 验证 io.on('connection') 是否被调用
      expect(io.on.called).to.be.true;
    });
  });

  describe('pushNotificationToUser 方法', () => {
    it('应该向指定用户推送通知', () => {
      manager.pushNotificationToUser('user_123', {
        type: 'checkin_reminder',
        data: { message: '提醒打卡' }
      });

      expect(io.to.called).to.be.true;
      const toCall = io.to.getCall(0);
      expect(toCall.args[0]).to.equal('user:user_123');
    });

    it('应该包含时间戳', () => {
      const emitStub = sandbox.stub();
      io.to.returns({ emit: emitStub });

      manager.pushNotificationToUser('user_456', {
        type: 'payment_received',
        data: { amount: 99.9 }
      });

      expect(emitStub.called).to.be.true;
      const emitted = emitStub.getCall(0).args[1];
      expect(emitted).to.have.property('timestamp');
    });

    it('应该保留原始通知数据', () => {
      const emitStub = sandbox.stub();
      io.to.returns({ emit: emitStub });

      const notification = {
        type: 'new_insight',
        data: { insightId: '123', content: 'New insight' }
      };

      manager.pushNotificationToUser('user_789', notification);

      const emitted = emitStub.getCall(0).args[1];
      expect(emitted.type).to.equal('new_insight');
      expect(emitted.data).to.deep.equal(notification.data);
    });

    it('应该发送到正确的事件通道', () => {
      const emitStub = sandbox.stub();
      io.to.returns({ emit: emitStub });

      manager.pushNotificationToUser('user_001', { type: 'test' });

      expect(emitStub.called).to.be.true;
      expect(emitStub.getCall(0).args[0]).to.equal('notification:new');
    });
  });

  describe('pushNotificationToUsers 方法', () => {
    it('应该向多个用户推送通知', () => {
      const emitStub = sandbox.stub();
      io.to.returns({ emit: emitStub });

      const userIds = ['user_1', 'user_2', 'user_3'];
      manager.pushNotificationToUsers(userIds, {
        type: 'broadcast_event',
        data: {}
      });

      expect(emitStub.callCount).to.equal(3);
    });

    it('应该处理空用户列表', () => {
      const emitStub = sandbox.stub();
      io.to.returns({ emit: emitStub });

      manager.pushNotificationToUsers([], { type: 'test' });

      expect(emitStub.callCount).to.equal(0);
    });

    it('应该处理单个用户列表', () => {
      const emitStub = sandbox.stub();
      io.to.returns({ emit: emitStub });

      manager.pushNotificationToUsers(['user_single'], { type: 'test' });

      expect(emitStub.callCount).to.equal(1);
    });

    it('应该处理大量用户列表', () => {
      const emitStub = sandbox.stub();
      io.to.returns({ emit: emitStub });

      const manyUsers = Array.from({ length: 100 }, (_, i) => `user_${i}`);
      manager.pushNotificationToUsers(manyUsers, { type: 'test' });

      expect(emitStub.callCount).to.equal(100);
    });
  });

  describe('broadcastNotification 方法', () => {
    it('应该广播通知给所有用户', () => {
      manager.broadcastNotification({
        type: 'system_maintenance',
        data: { message: '系统维护' }
      });

      expect(io.emit.called).to.be.true;
      const emitCall = io.emit.getCall(0);
      expect(emitCall.args[0]).to.equal('notification:broadcast');
    });

    it('应该包含通知类型和数据', () => {
      manager.broadcastNotification({
        type: 'all_users_announcement',
        data: { title: '公告', content: '内容' }
      });

      const call = io.emit.getCall(0);
      const notification = call.args[1];
      expect(notification.type).to.equal('all_users_announcement');
      expect(notification.data).to.deep.equal({ title: '公告', content: '内容' });
    });

    it('应该包含时间戳', () => {
      manager.broadcastNotification({ type: 'test' });

      const notification = io.emit.getCall(0).args[1];
      expect(notification).to.have.property('timestamp');
    });
  });

  describe('isUserOnline 方法', () => {
    it('应该检查用户是否在线', () => {
      // 模拟用户上线
      manager.userSockets.set('user_123', new Set(['socket_1']));

      expect(manager.isUserOnline('user_123')).to.be.true;
    });

    it('应该返回 false 当用户未连接', () => {
      expect(manager.isUserOnline('unknown_user')).to.be.false;
    });

    it('应该返回 false 当用户所有连接都断开', () => {
      manager.userSockets.set('user_456', new Set()); // 空集合

      expect(manager.isUserOnline('user_456')).to.be.false;
    });

    it('应该支持多个连接的用户', () => {
      const sockets = new Set(['socket_1', 'socket_2', 'socket_3']);
      manager.userSockets.set('user_789', sockets);

      expect(manager.isUserOnline('user_789')).to.be.true;
    });
  });

  describe('getUserSocketCount 方法', () => {
    it('应该返回用户的 socket 连接数', () => {
      const sockets = new Set(['socket_1', 'socket_2']);
      manager.userSockets.set('user_123', sockets);

      expect(manager.getUserSocketCount('user_123')).to.equal(2);
    });

    it('应该返回 0 当用户未连接', () => {
      expect(manager.getUserSocketCount('unknown')).to.equal(0);
    });

    it('应该处理多个连接', () => {
      const sockets = new Set(['s1', 's2', 's3', 's4', 's5']);
      manager.userSockets.set('user_multi', sockets);

      expect(manager.getUserSocketCount('user_multi')).to.equal(5);
    });
  });

  describe('getOnlineUsersCount 方法', () => {
    it('应该返回在线用户总数', () => {
      manager.userSockets.set('user_1', new Set(['socket_1']));
      manager.userSockets.set('user_2', new Set(['socket_2']));
      manager.userSockets.set('user_3', new Set(['socket_3']));

      expect(manager.getOnlineUsersCount()).to.equal(3);
    });

    it('应该返回 0 当没有用户在线', () => {
      expect(manager.getOnlineUsersCount()).to.equal(0);
    });

    it('应该只计数唯一的用户', () => {
      manager.userSockets.set('user_1', new Set(['socket_1', 'socket_2']));
      manager.userSockets.set('user_2', new Set(['socket_3', 'socket_4', 'socket_5']));

      expect(manager.getOnlineUsersCount()).to.equal(2);
    });
  });

  describe('getOnlineUsers 方法', () => {
    it('应该返回在线用户 ID 数组', () => {
      manager.userSockets.set('user_1', new Set(['s1']));
      manager.userSockets.set('user_2', new Set(['s2']));

      const onlineUsers = manager.getOnlineUsers();

      expect(onlineUsers).to.be.an('array');
      expect(onlineUsers).to.include('user_1');
      expect(onlineUsers).to.include('user_2');
    });

    it('应该返回空数组当没有用户在线', () => {
      const onlineUsers = manager.getOnlineUsers();

      expect(onlineUsers).to.be.an('array');
      expect(onlineUsers).to.have.lengthOf(0);
    });

    it('应该不重复列出用户', () => {
      manager.userSockets.set('user_1', new Set(['s1', 's2', 's3']));
      manager.userSockets.set('user_2', new Set(['s4', 's5']));

      const onlineUsers = manager.getOnlineUsers();

      expect(onlineUsers.filter(u => u === 'user_1')).to.have.lengthOf(1);
      expect(onlineUsers.filter(u => u === 'user_2')).to.have.lengthOf(1);
    });
  });

  describe('getStats 方法', () => {
    it('应该返回统计信息对象', () => {
      manager.userSockets.set('user_1', new Set(['s1']));

      const stats = manager.getStats();

      expect(stats).to.be.an('object');
      expect(stats).to.have.property('onlineUsers');
      expect(stats).to.have.property('totalConnections');
      expect(stats).to.have.property('avgConnectionsPerUser');
    });

    it('应该计算在线用户数', () => {
      manager.userSockets.set('user_1', new Set(['s1']));
      manager.userSockets.set('user_2', new Set(['s2', 's3']));
      manager.userSockets.set('user_3', new Set(['s4']));

      const stats = manager.getStats();

      expect(stats.onlineUsers).to.equal(3);
    });

    it('应该计算总连接数', () => {
      manager.userSockets.set('user_1', new Set(['s1', 's2']));
      manager.userSockets.set('user_2', new Set(['s3', 's4', 's5']));

      const stats = manager.getStats();

      expect(stats.totalConnections).to.equal(5);
    });

    it('应该计算平均每用户连接数', () => {
      manager.userSockets.set('user_1', new Set(['s1', 's2']));
      manager.userSockets.set('user_2', new Set(['s3']));

      const stats = manager.getStats();

      expect(stats.avgConnectionsPerUser).to.equal('1.50');
    });

    it('应该处理没有用户在线的情况', () => {
      const stats = manager.getStats();

      expect(stats.onlineUsers).to.equal(0);
      expect(stats.totalConnections).to.equal(0);
      expect(stats.avgConnectionsPerUser).to.equal(0);
    });

    it('应该处理单个用户单个连接', () => {
      manager.userSockets.set('user_1', new Set(['s1']));

      const stats = manager.getStats();

      expect(stats.onlineUsers).to.equal(1);
      expect(stats.totalConnections).to.equal(1);
      expect(stats.avgConnectionsPerUser).to.equal('1.00');
    });

    it('应该处理单个用户多个连接', () => {
      manager.userSockets.set('user_1', new Set(['s1', 's2', 's3', 's4']));

      const stats = manager.getStats();

      expect(stats.onlineUsers).to.equal(1);
      expect(stats.totalConnections).to.equal(4);
      expect(stats.avgConnectionsPerUser).to.equal('4.00');
    });
  });

  describe('边界情况', () => {
    it('应该处理非常大量的用户', () => {
      for (let i = 0; i < 10000; i++) {
        manager.userSockets.set(`user_${i}`, new Set(['socket_id']));
      }

      expect(manager.getOnlineUsersCount()).to.equal(10000);
    });

    it('应该处理用户有非常多的连接', () => {
      const sockets = new Set();
      for (let i = 0; i < 100; i++) {
        sockets.add(`socket_${i}`);
      }
      manager.userSockets.set('user_heavy', sockets);

      expect(manager.getUserSocketCount('user_heavy')).to.equal(100);
    });

    it('应该处理特殊字符的用户 ID', () => {
      manager.userSockets.set('user-123@example.com', new Set(['s1']));
      manager.userSockets.set('用户_中文_123', new Set(['s2']));

      expect(manager.isUserOnline('user-123@example.com')).to.be.true;
      expect(manager.isUserOnline('用户_中文_123')).to.be.true;
    });

    it('应该处理特殊字符的 socket ID', () => {
      manager.userSockets.set('user_1', new Set([
        'socket-with-dashes',
        'socket_with_underscores',
        'socket.with.dots'
      ]));

      expect(manager.getUserSocketCount('user_1')).to.equal(3);
    });

    it('应该处理 socket ID 重复（应该去重）', () => {
      const sockets = new Set();
      sockets.add('same_socket');
      sockets.add('same_socket'); // 重复

      manager.userSockets.set('user_1', sockets);

      // Set 会自动去重
      expect(manager.getUserSocketCount('user_1')).to.equal(1);
    });
  });

  describe('连接生命周期模拟', () => {
    it('应该模拟用户连接和断开', () => {
      // 用户连接
      manager.userSockets.set('user_session', new Set(['socket_1']));
      manager.socketUsers.set('socket_1', 'user_session');

      expect(manager.isUserOnline('user_session')).to.be.true;

      // 用户断开连接
      manager.userSockets.get('user_session').delete('socket_1');
      if (manager.userSockets.get('user_session').size === 0) {
        manager.userSockets.delete('user_session');
      }
      manager.socketUsers.delete('socket_1');

      expect(manager.isUserOnline('user_session')).to.be.false;
    });

    it('应该处理用户多连接场景', () => {
      // 用户首次连接
      manager.userSockets.set('user_mobile', new Set(['socket_phone']));
      expect(manager.getUserSocketCount('user_mobile')).to.equal(1);

      // 用户第二个设备连接
      manager.userSockets.get('user_mobile').add('socket_tablet');
      expect(manager.getUserSocketCount('user_mobile')).to.equal(2);

      // 一个连接断开
      manager.userSockets.get('user_mobile').delete('socket_phone');
      expect(manager.getUserSocketCount('user_mobile')).to.equal(1);

      // 最后一个连接断开
      manager.userSockets.get('user_mobile').delete('socket_tablet');
      if (manager.userSockets.get('user_mobile').size === 0) {
        manager.userSockets.delete('user_mobile');
      }
      expect(manager.isUserOnline('user_mobile')).to.be.false;
    });
  });

  describe('错误处理', () => {
    it('应该处理推送通知时的异常', () => {
      io.to.throws(new Error('IO error'));

      expect(() => {
        manager.pushNotificationToUser('user_123', { type: 'test' });
      }).to.not.throw(); // 应该被 try-catch 捕获
    });

    it('应该处理没有 io 实例的情况', () => {
      const noIOManager = new WebSocketManager(null);

      // 应该不抛出错误
      expect(() => {
        noIOManager.getStats();
      }).to.not.throw();
    });
  });

  describe('内存管理', () => {
    it('应该清理断开连接的用户数据', () => {
      manager.userSockets.set('user_temp', new Set(['socket_temp']));
      manager.socketUsers.set('socket_temp', 'user_temp');

      expect(manager.getOnlineUsersCount()).to.equal(1);

      // 清理
      manager.userSockets.delete('user_temp');
      manager.socketUsers.delete('socket_temp');

      expect(manager.getOnlineUsersCount()).to.equal(0);
      expect(manager.isUserOnline('user_temp')).to.be.false;
    });

    it('应该不会因为重复操作而泄漏内存', () => {
      for (let i = 0; i < 100; i++) {
        manager.userSockets.set('user_temp', new Set(['socket_1', 'socket_2']));
        manager.userSockets.delete('user_temp');
      }

      expect(manager.getOnlineUsersCount()).to.equal(0);
    });
  });
});
