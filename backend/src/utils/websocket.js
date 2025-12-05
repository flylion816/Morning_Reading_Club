/**
 * WebSocket 管理器
 * 处理实时通知推送和用户连接管理
 */

const logger = require('./logger');

class WebSocketManager {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map(); // 用户ID -> 多个socket IDs的映射
    this.socketUsers = new Map(); // socket ID -> 用户ID的映射
    this.initializeEvents();
  }

  /**
   * 初始化 WebSocket 事件监听器
   */
  initializeEvents() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.info('客户端连接', { socketId: socket.id });

      // 用户加入（登录后首次连接）
      socket.on('user:join', (data) => {
        const { userId } = data;
        if (!userId) {
          logger.warn('user:join 没有提供 userId', { socketId: socket.id });
          return;
        }

        // 将 socket 加入用户的 socket 集合
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socket.id);
        this.socketUsers.set(socket.id, userId);

        // 加入以用户ID为名的房间，便于广播
        socket.join(`user:${userId}`);

        logger.info('用户加入 WebSocket', {
          userId,
          socketId: socket.id,
          totalSocketsForUser: this.userSockets.get(userId).size
        });

        // 发送确认消息
        socket.emit('user:joined', { status: 'success', userId });
      });

      // 用户断开连接
      socket.on('disconnect', () => {
        const userId = this.socketUsers.get(socket.id);
        if (userId) {
          const userSockets = this.userSockets.get(userId);
          if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
              this.userSockets.delete(userId);
              logger.info('用户所有连接已断开', { userId });
            }
          }
        }
        this.socketUsers.delete(socket.id);

        logger.info('客户端断开连接', {
          socketId: socket.id,
          userId,
          remainingSockets: userId ? this.userSockets.get(userId)?.size || 0 : 'N/A'
        });
      });

      // 心跳检测（保持连接活跃）
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // 错误处理
      socket.on('error', (error) => {
        logger.error('Socket 错误', error, { socketId: socket.id });
      });
    });
  }

  /**
   * 向指定用户推送通知
   * @param {string} userId - 用户ID
   * @param {object} notification - 通知对象
   * @param {string} notification.type - 通知类型
   * @param {object} notification.data - 通知数据
   */
  pushNotificationToUser(userId, notification) {
    try {
      this.io.to(`user:${userId}`).emit('notification:new', {
        ...notification,
        timestamp: new Date().toISOString()
      });

      logger.info('向用户推送通知', {
        userId,
        notificationType: notification.type,
        socketsCount: this.userSockets.get(userId)?.size || 0
      });
    } catch (error) {
      logger.error('推送通知失败', error, {
        userId,
        notificationType: notification.type
      });
    }
  }

  /**
   * 向多个用户推送通知
   * @param {string[]} userIds - 用户ID列表
   * @param {object} notification - 通知对象
   */
  pushNotificationToUsers(userIds, notification) {
    userIds.forEach(userId => {
      this.pushNotificationToUser(userId, notification);
    });
  }

  /**
   * 广播通知给所有用户
   * @param {object} notification - 通知对象
   */
  broadcastNotification(notification) {
    try {
      this.io.emit('notification:broadcast', {
        ...notification,
        timestamp: new Date().toISOString()
      });

      logger.info('广播通知给所有用户', {
        notificationType: notification.type,
        totalUsers: this.userSockets.size
      });
    } catch (error) {
      logger.error('广播通知失败', error, {
        notificationType: notification.type
      });
    }
  }

  /**
   * 检查用户是否在线
   * @param {string} userId - 用户ID
   * @returns {boolean}
   */
  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  /**
   * 获取用户的 socket 连接数
   * @param {string} userId - 用户ID
   * @returns {number}
   */
  getUserSocketCount(userId) {
    const sockets = this.userSockets.get(userId);
    return sockets ? sockets.size : 0;
  }

  /**
   * 获取在线用户总数
   * @returns {number}
   */
  getOnlineUsersCount() {
    return this.userSockets.size;
  }

  /**
   * 获取所有在线用户ID列表
   * @returns {string[]}
   */
  getOnlineUsers() {
    return Array.from(this.userSockets.keys());
  }

  /**
   * 获取统计信息
   * @returns {object}
   */
  getStats() {
    let totalSockets = 0;
    this.userSockets.forEach(sockets => {
      totalSockets += sockets.size;
    });

    return {
      onlineUsers: this.userSockets.size,
      totalConnections: totalSockets,
      avgConnectionsPerUser: this.userSockets.size > 0 ? (totalSockets / this.userSockets.size).toFixed(2) : 0
    };
  }
}

module.exports = WebSocketManager;
