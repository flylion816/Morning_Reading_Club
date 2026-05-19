/**
 * WebSocket 管理器（原生 ws）
 * 处理实时通知推送和用户连接管理
 * 多租户隔离：房间命名 tenant:${tenantId}:user:${userId}
 */

const url = require('url');
const { WebSocket } = require('ws');
const { verifyAccessToken, consumeWsToken } = require('./jwt');
const { runWithTenant } = require('./tenantContext');
const logger = require('./logger');

class WebSocketManager {
  constructor(wss) {
    this.wss = wss;
    // key: `${tenantId}:${userId}` → Set<ws>
    this.userSockets = new Map();
    // key: `tenant:${tenantId}` → Set<ws>
    this.tenantRooms = new Map();
    // ws → { tenantId, userId }
    this.socketUsers = new WeakMap();

    this._installAuthAndConnection();
    this._installHeartbeat();
  }

  _installAuthAndConnection() {
    if (!this.wss) return;

    this.wss.on('connection', async (ws, req) => {
      try {
        let decoded = null;

        // 优先从 Authorization header 取 access token（开发者工具 / 部分真机）
        const headerAuth = req.headers['authorization'] || '';
        const headerToken = headerAuth.replace(/^Bearer /, '');
        if (headerToken) {
          decoded = verifyAccessToken(headerToken);
        }

        // 兜底从 query 取一次性短期 wsToken（真机 header 不可用时）
        if (!decoded) {
          const parsed = url.parse(req.url, true);
          const wsToken = parsed.query.wsToken || parsed.query.token;
          if (wsToken) decoded = await consumeWsToken(wsToken);
        }

        if (!decoded) throw new Error('未提供认证令牌');
        if (!decoded.tenantId) throw new Error('令牌缺少 tenantId');

        const tenantId = String(decoded.tenantId);
        const userId = String(decoded.userId || decoded._id);
        const userKey = `${tenantId}:${userId}`;
        const tenantKey = `tenant:${tenantId}`;

        // 加入用户房间和租户房间
        if (!this.userSockets.has(userKey)) this.userSockets.set(userKey, new Set());
        this.userSockets.get(userKey).add(ws);
        if (!this.tenantRooms.has(tenantKey)) this.tenantRooms.set(tenantKey, new Set());
        this.tenantRooms.get(tenantKey).add(ws);
        this.socketUsers.set(ws, { tenantId, userId });
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        logger.info('WebSocket 连接建立', { tenantId, userId });
        this._send(ws, { type: 'user:joined', status: 'success', userId });

        ws.on('message', (raw) => this._handleMessage(ws, raw));
        ws.on('close', () => this._handleClose(ws));
        ws.on('error', (err) => logger.error('WebSocket 错误', err, { tenantId, userId }));
      } catch (err) {
        logger.warn('WebSocket 握手失败', { reason: err.message });
        ws.close(1008, err.message);
      }
    });
  }

  _send(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  _handleMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
    const type = msg.type || msg.event;
    if (type === 'ping') return this._send(ws, { type: 'pong' });

    const ctx = this.socketUsers.get(ws);
    if (!ctx) return;

    Promise.resolve(
      runWithTenant(
        { tenantId: ctx.tenantId, bypassTenantFilter: false, actor: { type: 'user', id: ctx.userId, channel: 'ws' } },
        async () => {
          // 在这里按 type 路由到具体 handler
          // 例如：if (type === 'client:read_notification') { ... }
        }
      )
    ).catch((error) => {
      logger.error('WebSocket 业务事件失败', error, { ...ctx, type });
      this._send(ws, { type: 'error', message: '处理失败' });
    });
  }

  _handleClose(ws) {
    const ctx = this.socketUsers.get(ws);
    if (!ctx) return;
    const userKey = `${ctx.tenantId}:${ctx.userId}`;
    const tenantKey = `tenant:${ctx.tenantId}`;
    const userSet = this.userSockets.get(userKey);
    if (userSet) {
      userSet.delete(ws);
      if (userSet.size === 0) this.userSockets.delete(userKey);
    }
    const tenantSet = this.tenantRooms.get(tenantKey);
    if (tenantSet) {
      tenantSet.delete(ws);
      if (tenantSet.size === 0) this.tenantRooms.delete(tenantKey);
    }
    logger.info('WebSocket 连接断开', { tenantId: ctx.tenantId, userId: ctx.userId });
  }

  _installHeartbeat() {
    if (!this.wss) return;

    this._heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          logger.warn('WebSocket 心跳超时，强制断开', this.socketUsers.get(ws) || {});
          return ws.terminate();
        }
        ws.isAlive = false;
        try { ws.ping(); } catch (_) { /* 已断开的连接 ping 会抛错，忽略 */ }
      });
    }, 30000);

    this.wss.on('close', () => clearInterval(this._heartbeatInterval));
  }

  // === 推送方法（带 tenantId） ===

  pushNotificationToUser(tenantId, userId, notification) {
    const set = this.userSockets.get(`${tenantId}:${userId}`);
    const data = { ...notification, timestamp: new Date().toISOString() };
    const payload = { type: 'notification:new', ...data };
    let sent = 0;
    if (set) set.forEach((ws) => { this._send(ws, payload); sent += 1; });

    this._publishToOtherInstances('user', { tenantId, userId, notification: data });
    return sent;
  }

  pushNotificationToTenant(tenantId, notification) {
    const set = this.tenantRooms.get(`tenant:${tenantId}`);
    const data = { ...notification, timestamp: new Date().toISOString() };
    const payload = { type: 'notification:tenant', ...data };
    let sent = 0;
    if (set) set.forEach((ws) => { this._send(ws, payload); sent += 1; });

    this._publishToOtherInstances('tenant', { tenantId, notification: data });
    return sent;
  }

  isUserOnline(tenantId, userId) {
    const set = this.userSockets.get(`${tenantId}:${userId}`);
    return !!(set && set.size > 0);
  }

  getUserSocketCount(tenantId, userId) {
    const set = this.userSockets.get(`${tenantId}:${userId}`);
    return set ? set.size : 0;
  }

  getOnlineUsersCount() {
    return this.userSockets.size;
  }

  getOnlineUsers() {
    return Array.from(this.userSockets.keys());
  }

  getStats() {
    let totalSockets = 0;
    this.userSockets.forEach(sockets => {
      totalSockets += sockets.size;
    });
    return {
      onlineUsers: this.userSockets.size,
      totalConnections: totalSockets,
      avgConnectionsPerUser:
        this.userSockets.size > 0 ? (totalSockets / this.userSockets.size).toFixed(2) : 0
    };
  }

  // 多实例广播 hook（由 ws-pubsub.js 注入）
  _publishToOtherInstances(_kind, _payload) {
    // 默认空实现，由 ws-pubsub.js 在启动时通过 wsManager.setPubSub(...) 注入
  }
  setPubSub(pubsub) { this._publishToOtherInstances = pubsub; }
}

module.exports = WebSocketManager;
