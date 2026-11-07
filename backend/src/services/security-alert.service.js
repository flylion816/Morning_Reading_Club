const crypto = require('crypto');
const redisManager = require('../utils/redis');
const alerting = require('../utils/alerting');
const logger = require('../utils/logger');

const RULES = {
  admin_login_failure: {
    threshold: 5,
    windowSeconds: 15 * 60,
    severity: 'HIGH',
    title: '管理员登录连续失败'
  },
  admin_account_rejected: {
    threshold: 1,
    windowSeconds: 15 * 60,
    severity: 'HIGH',
    title: '禁用或未知管理员尝试登录'
  },
  cross_tenant_denial: {
    threshold: 1,
    windowSeconds: 5 * 60,
    severity: 'HIGH',
    title: '跨租户访问被拒绝'
  },
  external_rate_limit: {
    threshold: 1,
    windowSeconds: 5 * 60,
    severity: 'HIGH',
    title: '外部集成调用频率过高'
  },
  revoked_external_key: {
    threshold: 1,
    windowSeconds: 5 * 60,
    severity: 'HIGH',
    title: '已停用外部集成 Key 尝试调用'
  },
  unknown_external_key: {
    threshold: 3,
    windowSeconds: 15 * 60,
    severity: 'MEDIUM',
    title: '未知外部集成 Key 反复尝试调用'
  },
  large_data_read: {
    threshold: 1,
    windowSeconds: 15 * 60,
    severity: 'MEDIUM',
    title: '大数据量读取或导出'
  },
  payment_verification_mismatch: {
    threshold: 1,
    windowSeconds: 15 * 60,
    severity: 'CRITICAL',
    title: '支付平台核验不匹配'
  }
};

function normalizeSubject(subject) {
  return crypto
    .createHash('sha256')
    .update(String(subject || 'unknown'))
    .digest('hex')
    .slice(0, 16);
}

async function record(type, subject, context = {}) {
  const rule = RULES[type];
  if (!rule) throw new Error(`Unknown security alert type: ${type}`);

  const subjectHash = normalizeSubject(subject);
  const key = `security-alert:${type}:${subjectHash}`;
  const count = await redisManager.incr(key);
  if (count === 1) await redisManager.expire(key, rule.windowSeconds);

  if (count !== rule.threshold) return { triggered: false, count };

  const endpoint = String(context.endpoint || 'global').split('?')[0].slice(0, 160);
  const detail = String(context.detail || rule.title).slice(0, 160);
  await alerting.trigger({
    severity: rule.severity,
    type: type.toUpperCase(),
    endpoint,
    message: `${rule.title}: ${detail} (subject=${subjectHash}, count=${count})`
  });
  return { triggered: true, count };
}

function recordQuietly(type, subject, context = {}) {
  record(type, subject, context).catch(error => {
    logger.warn('安全告警记录失败', {
      type,
      name: error.name,
      message: error.message
    });
  });
}

module.exports = { record, recordQuietly, RULES };
