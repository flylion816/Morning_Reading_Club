/**
 * Redis pub/sub 多实例广播
 * 用于 PM2 cluster mode 下跨实例 WebSocket 消息转发
 */

const Redis = require('ioredis');
const logger = require('./logger');

const CHANNEL = 'ws:broadcast';

/**
 * 给 WebSocketManager 装上多实例广播能力
 * 调用方式（在 server.js wsManager 创建后）：
 *   const { initWsPubSub } = require('./utils/ws-pubsub');
 *   initWsPubSub(wsManager);
 */
function initWsPubSub(wsManager) {
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.info('[ws-pubsub] REDIS_URL 未配置，跳过多实例广播');
    return;
  }
  const pub = new Redis(url);
  const sub = new Redis(url);

  sub.subscribe(CHANNEL, (err) => {
    if (err) logger.error('[ws-pubsub] subscribe 失败', err);
  });
  sub.on('message', (channel, raw) => {
    if (channel !== CHANNEL) return;
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }

    // 加 sender 字段防止自己广播自己又收到（实际多实例下不会回到原实例，但单实例 e2e 测试时会）
    if (msg.sender === process.pid) return;

    if (msg.kind === 'user') {
      const set = wsManager.userSockets.get(`${msg.tenantId}:${msg.userId}`);
      if (set) set.forEach((ws) => wsManager._send(ws, { type: 'notification:new', ...msg.notification }));
    } else if (msg.kind === 'tenant') {
      const set = wsManager.tenantRooms.get(`tenant:${msg.tenantId}`);
      if (set) set.forEach((ws) => wsManager._send(ws, { type: 'notification:tenant', ...msg.notification }));
    }
  });

  wsManager.setPubSub((kind, payload) => {
    pub.publish(CHANNEL, JSON.stringify({ kind, sender: process.pid, ...payload }))
       .catch((err) => logger.error('[ws-pubsub] publish 失败', err));
  });

  logger.info('ws-pubsub 已启动（多实例广播）');
}

module.exports = { initWsPubSub };
