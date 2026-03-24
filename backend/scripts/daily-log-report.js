#!/usr/bin/env node
/**
 * 晨读营 - 每日服务器日志巡检报告
 *
 * 功能：读取过去24小时日志 → 分析错误/告警 → 生成HTML邮件 → 发送到指定邮箱
 *
 * 使用方式：
 *   node daily-log-report.js                    # 正常运行
 *   node daily-log-report.js --test             # 测试模式（不发邮件，输出到控制台）
 *   node daily-log-report.js --hours 48         # 分析过去48小时
 *
 * Cron配置（每天17:00北京时间）：
 *   0 17 * * * /usr/bin/node /var/www/morning-reading/backend/scripts/daily-log-report.js >> /var/www/logs/daily-report.log 2>&1
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// 配置
// ============================================================

const CONFIG = {
  logDir: '/var/www/logs',

  // 要分析的日志文件
  logFiles: {
    error:       'error.log',        // Winston 错误日志
    warn:        'warn.log',         // Winston 警告日志
    combined:    'combined.log',     // Winston 综合日志
    exceptions:  'exceptions.log',   // 未捕获异常
    rejections:  'rejections.log',   // 未处理的 Promise rejection
    pm2Out:      'morning-reading-out.log',    // PM2 stdout
    pm2Error:    'morning-reading-error.log',  // PM2 stderr
  },

  // 邮件配置
  smtp: {
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
      user: '308965039@qq.com',
      pass: process.env.QQ_SMTP_PASS || '',  // QQ邮箱授权码
    }
  },
  mailTo: '308965039@qq.com',
  mailFrom: '"晨读营服务器" <308965039@qq.com>',
};

// ============================================================
// 参数解析
// ============================================================

const args = process.argv.slice(2);
const isTestMode = args.includes('--test');
const hoursIdx = args.indexOf('--hours');
const hoursBack = hoursIdx !== -1 ? parseInt(args[hoursIdx + 1], 10) : 24;
const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

// ============================================================
// 日志读取与解析
// ============================================================

function readLogFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').filter(line => line.trim());
  } catch (err) {
    console.error(`读取文件失败 ${filePath}: ${err.message}`);
    return [];
  }
}

/**
 * 解析 Winston JSON 格式日志行
 * 格式: {"timestamp":"2026-03-21 10:30:45 +08:00","level":"error","message":"..."}
 */
function parseWinstonLine(line) {
  // 尝试 JSON 解析
  try {
    const obj = JSON.parse(line);
    if (obj.timestamp) {
      return {
        time: new Date(obj.timestamp),
        level: obj.level || 'info',
        message: obj.message || '',
        raw: line,
        meta: obj,
      };
    }
  } catch (e) { /* 非JSON格式 */ }

  // 跳过 error.log 的 Context 和 Stack 附属行（不是独立错误）
  if (/^(Context:|Stack:|    at )/.test(line)) {
    return { time: null, level: '_skip', message: line, raw: line };
  }

  // 尝试文本格式: [2026-03-21 10:30:45 +08:00] ERROR: message
  const textMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[^\]]*)\]\s*(\w+):\s*(.*)/);
  if (textMatch) {
    return {
      time: new Date(textMatch[1]),
      level: textMatch[2].toLowerCase(),
      message: textMatch[3],
      raw: line,
    };
  }

  // 尝试简单时间戳格式: 2026-03-21T10:30:45.000Z ...
  const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*)\s+(.*)/);
  if (isoMatch) {
    return {
      time: new Date(isoMatch[1]),
      level: 'info',
      message: isoMatch[2],
      raw: line,
    };
  }

  // 无法识别的行，标记为 skip（不计入统计）
  return { time: null, level: '_skip', message: line, raw: line };
}

/**
 * 解析 PM2 日志行
 * 格式: 0|morning- | [内容] 或带时间戳的行
 */
function parsePM2Line(line) {
  // PM2 cluster 前缀: "0|morning- | ..."
  const pm2Match = line.match(/^\d+\|[^|]+\|\s*(.*)/);
  const content = pm2Match ? pm2Match[1] : line;

  // 尝试从内容中提取时间
  const timeMatch = content.match(/(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})/);
  const time = timeMatch ? new Date(timeMatch[1]) : null;

  const isError = /error|Error|ERR|ECONNREFUSED|ENOENT|TypeError|ReferenceError|SyntaxError/i.test(content);

  return {
    time,
    level: isError ? 'error' : 'info',
    message: content.substring(0, 500),
    raw: line,
  };
}

/**
 * 过滤指定时间范围内的日志
 */
function filterByTime(entries, since) {
  return entries.filter(e => {
    if (e.level === '_skip') return false; // 跳过 Context/Stack 等附属行
    if (!e.time) return false; // 无法判断时间的丢弃（避免历史堆积）
    return e.time >= since;
  });
}

// ============================================================
// 日志分析
// ============================================================

function analyzeEntries(entries) {
  const grouped = {};

  for (const entry of entries) {
    // 提取错误关键特征作为分组key
    const key = normalizeErrorMessage(entry.message);
    if (!grouped[key]) {
      grouped[key] = {
        message: entry.message.substring(0, 200),
        count: 0,
        lastTime: null,
        samples: [],
      };
    }
    grouped[key].count++;
    if (entry.time && (!grouped[key].lastTime || entry.time > grouped[key].lastTime)) {
      grouped[key].lastTime = entry.time;
    }
    if (grouped[key].samples.length < 3) {
      grouped[key].samples.push(entry.raw.substring(0, 500));
    }
  }

  return Object.values(grouped).sort((a, b) => b.count - a.count);
}

/**
 * 将错误消息归一化为分组key
 */
function normalizeErrorMessage(msg) {
  if (!msg) return 'unknown';
  return msg
    .replace(/ObjectId\(['"]\w+['"]\)/g, 'ObjectId(ID)')
    .replace(/\/api\/v1\/\S+/g, '/api/v1/...')
    .replace(/\b[0-9a-f]{24}\b/g, '<ID>')
    .replace(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}[^\s]*/g, '<TIME>')
    .replace(/:\d+/g, ':<PORT>')
    .replace(/\s+/g, ' ')
    .substring(0, 150);
}

/**
 * 为错误提供分析建议
 */
function suggestFix(message) {
  const suggestions = [
    [/CastError.*ObjectId/i, '前端传了无效的 ID 参数（可能是 undefined），建议在前端添加参数校验'],
    [/ECONNREFUSED/i, '数据库或Redis连接被拒绝，检查 Docker 容器是否正常运行'],
    [/ENOMEM|heap|memory/i, '内存不足，检查是否有内存泄漏，考虑增加 max-old-space-size'],
    [/ENOSPC/i, '磁盘空间不足，清理日志或扩展磁盘'],
    [/MongoServerError.*duplicate/i, '数据库唯一索引冲突，检查是否有重复数据插入'],
    [/MongoServerError.*timeout/i, 'MongoDB 查询超时，检查是否有慢查询或索引缺失'],
    [/TokenExpiredError/i, 'JWT Token 过期，属于正常现象（用户需要重新登录）'],
    [/JsonWebTokenError/i, 'JWT Token 无效，可能是伪造的请求或 Token 被篡改'],
    [/CORS/i, 'CORS 配置问题，检查请求来源是否在白名单中'],
    [/ER_DUP_ENTRY/i, 'MySQL 唯一键冲突，检查同步逻辑是否正确处理了 upsert'],
    [/ER_NO_SUCH_TABLE/i, 'MySQL 表不存在，需要运行初始化脚本创建表结构'],
    [/Cannot read propert/i, '空值引用错误，某个对象为 null/undefined 时访问了属性'],
    [/status.*undefined|undefined.*status/i, '前端传了 undefined 参数，建议在请求前过滤空值'],
    [/SIGTERM|SIGINT/i, '进程收到终止信号，可能是 PM2 重启或手动停止'],
    [/unhandledRejection/i, '未处理的 Promise 异常，建议添加 try-catch'],
  ];

  for (const [pattern, suggestion] of suggestions) {
    if (pattern.test(message)) return suggestion;
  }
  return '需要查看完整堆栈信息进一步分析';
}

/**
 * 统计 HTTP 请求（从 PM2 out.log，Morgan 格式带 ANSI 颜色码）
 * 格式: "2026-03-24 07:14:36 +08:00: GET /api/v1/users/me/stats [32m200[0m 19.780 ms - 170"
 */
function analyzeHttpRequests(pm2OutLines, since) {
  let total = 0;
  let status4xx = 0;
  let status5xx = 0;
  const endpoints = {};

  // 去除 ANSI 颜色码
  const stripAnsi = s => s.replace(/\x1b\[[0-9;]*m|\[[\d;]*m/g, '');

  for (const line of pm2OutLines) {
    const clean = stripAnsi(line);

    // 匹配时间戳
    const timeMatch = clean.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
    if (timeMatch) {
      const logTime = new Date(timeMatch[1]);
      if (logTime < since) continue;
    }

    // 匹配 HTTP 请求: "GET /api/v1/... 200 19.780 ms"
    const httpMatch = clean.match(/(GET|POST|PUT|DELETE|PATCH)\s+(\S+)\s+(\d{3})\s+[\d.]+\s*ms/);
    if (httpMatch) {
      total++;
      const status = parseInt(httpMatch[3]);
      if (status >= 400 && status < 500) status4xx++;
      if (status >= 500) status5xx++;
      if (status >= 400) {
        // 清理 URL 中的 ObjectId 和查询参数
        const url = httpMatch[2].replace(/[0-9a-f]{24}/g, '<ID>').replace(/\?.*/, '?...');
        const key = `${httpMatch[1]} ${url.substring(0, 60)} → ${status}`;
        endpoints[key] = (endpoints[key] || 0) + 1;
      }
    }
  }

  return { total, status4xx, status5xx, topErrors: Object.entries(endpoints).sort((a, b) => b[1] - a[1]).slice(0, 10) };
}

// ============================================================
// PM2 状态获取
// ============================================================

function getPM2Status() {
  try {
    // 服务器上 pm2 通过 npx 访问，尝试多种路径
    let output;
    const pm2Commands = ['pm2 jlist', 'npx pm2 jlist', '/home/ubuntu/.npm/_npx/5f7878ce38f1eb13/node_modules/pm2/bin/pm2 jlist'];
    for (const cmd of pm2Commands) {
      try {
        output = execSync(`${cmd} 2>/dev/null`, { encoding: 'utf-8', timeout: 15000 });
        if (output && output.trim().startsWith('[')) break;
      } catch (e) { continue; }
    }
    if (!output) throw new Error('pm2 not found');
    const list = JSON.parse(output);
    const app = list.filter(p => p.name === 'morning-reading-backend');

    if (app.length === 0) return { online: 0, total: 0, restarts: 0, memory: 0, uptime: '' };

    let totalRestarts = 0;
    let totalMemory = 0;
    let online = 0;

    for (const inst of app) {
      if (inst.pm2_env && inst.pm2_env.status === 'online') online++;
      totalRestarts += (inst.pm2_env && inst.pm2_env.restart_time) || 0;
      totalMemory += (inst.monit && inst.monit.memory) || 0;
    }

    const uptime = app[0].pm2_env ? formatUptime(Date.now() - app[0].pm2_env.pm_uptime) : 'unknown';

    return {
      online,
      total: app.length,
      restarts: totalRestarts,
      memory: Math.round(totalMemory / 1024 / 1024),
      uptime,
    };
  } catch (err) {
    return { online: -1, total: -1, restarts: -1, memory: -1, uptime: 'PM2 unavailable' };
  }
}

function formatUptime(ms) {
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}天${hours}小时`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}小时${mins}分钟`;
}

// ============================================================
// 系统状态
// ============================================================

function getSystemStatus() {
  const status = {};

  // 磁盘使用
  try {
    const df = execSync("df -h / | tail -1 | awk '{print $5}'", { encoding: 'utf-8', timeout: 3000 });
    status.disk = df.trim();
  } catch (e) {
    status.disk = 'N/A';
  }

  // 系统负载
  try {
    const load = execSync("cat /proc/loadavg | awk '{print $1, $2, $3}'", { encoding: 'utf-8', timeout: 3000 });
    status.load = load.trim();
  } catch (e) {
    status.load = 'N/A';
  }

  // 最近的 MongoDB 备份
  try {
    const backup = execSync(
      "ls -td /var/backups/mongodb/mongodb-backup-* 2>/dev/null | head -1 | xargs -I{} stat -c '%Y' {} 2>/dev/null",
      { encoding: 'utf-8', timeout: 3000 }
    );
    if (backup.trim()) {
      const backupTime = new Date(parseInt(backup.trim()) * 1000);
      const hoursAgo = Math.round((Date.now() - backupTime.getTime()) / 3600000);
      status.lastBackup = hoursAgo <= 24
        ? `✅ ${hoursAgo}小时前 (${formatTime(backupTime)})`
        : `⚠️ ${hoursAgo}小时前 (${formatTime(backupTime)})`;
    } else {
      status.lastBackup = '❌ 未找到备份文件';
    }
  } catch (e) {
    status.lastBackup = 'N/A';
  }

  // MySQL 同步状态（通过 MongoDB→MySQL 实时同步）
  try {
    const mysqlCheck = execSync(
      `cd /var/www/morning-reading && node -e "
        const mysql = require('./backend/node_modules/mysql2/promise');
        (async () => {
          const conn = await mysql.createConnection({ host:'localhost', port:3306, user:'root', password:'Prod_Root@Secure123!', database:'morning_reading' });
          const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM users');
          const [recent] = await conn.query('SELECT MAX(updated_at) as last_sync FROM users');
          console.log(JSON.stringify({ count: rows[0].cnt, lastSync: recent[0].last_sync }));
          await conn.end();
        })().catch(e => console.log(JSON.stringify({ error: e.message })));
      "`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    const mysqlData = JSON.parse(mysqlCheck.trim());
    if (mysqlData.error) {
      status.mysqlSync = `❌ ${mysqlData.error}`;
    } else {
      const syncTime = mysqlData.lastSync ? new Date(mysqlData.lastSync) : null;
      const hoursAgo = syncTime ? Math.round((Date.now() - syncTime.getTime()) / 3600000) : -1;
      status.mysqlSync = hoursAgo <= 24
        ? `✅ ${mysqlData.count}条用户记录, 最近同步 ${hoursAgo}小时前`
        : hoursAgo > 24
          ? `⚠️ ${mysqlData.count}条用户记录, 最近同步 ${hoursAgo}小时前`
          : `⚠️ ${mysqlData.count}条用户记录, 无同步时间`;
    }
  } catch (e) {
    status.mysqlSync = 'N/A';
  }

  // Docker 容器状态
  try {
    const docker = execSync(
      "docker ps --format '{{.Names}}:{{.Status}}' | grep morning-reading 2>/dev/null",
      { encoding: 'utf-8', timeout: 5000 }
    );
    status.docker = docker.trim().split('\n').map(line => {
      const [name, st] = line.split(':');
      const shortName = name.replace('morning-reading-', '').replace('-prod', '');
      const isUp = /Up/i.test(st);
      return `${isUp ? '✅' : '❌'} ${shortName}: ${st}`;
    });
  } catch (e) {
    status.docker = ['N/A'];
  }

  return status;
}

// ============================================================
// HTML 邮件生成
// ============================================================

function formatTime(date) {
  if (!date) return '-';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDate(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function generateHTML(report) {
  const { errorGroups, warnGroups, exceptionGroups, httpStats, pm2Status, systemStatus, timeRange } = report;

  const totalErrors = errorGroups.reduce((s, g) => s + g.count, 0);
  const totalWarns = warnGroups.reduce((s, g) => s + g.count, 0);
  const totalExceptions = exceptionGroups.reduce((s, g) => s + g.count, 0);

  // 健康评分
  let healthScore = 100;
  if (totalErrors > 0) healthScore -= Math.min(totalErrors * 5, 40);
  if (totalExceptions > 0) healthScore -= totalExceptions * 15;
  if (pm2Status.restarts > 0) healthScore -= pm2Status.restarts * 10;
  if (httpStats.status5xx > 0) healthScore -= httpStats.status5xx * 5;
  healthScore = Math.max(0, healthScore);

  const healthColor = healthScore >= 80 ? '#27ae60' : healthScore >= 50 ? '#f39c12' : '#e74c3c';
  const healthEmoji = healthScore >= 80 ? '✅' : healthScore >= 50 ? '⚠️' : '🔴';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #f5f5f5; color: #333;">

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 25px; border-radius: 12px 12px 0 0;">
  <h1 style="margin: 0; font-size: 20px;">📊 晨读营服务器日志巡检报告</h1>
  <p style="margin: 8px 0 0; opacity: 0.9; font-size: 13px;">
    时间范围: ${formatDate(timeRange.from)} ~ ${formatDate(timeRange.to)}
  </p>
</div>

<div style="background: white; padding: 20px 25px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

<!-- 健康评分 -->
<div style="text-align: center; margin: 15px 0 25px;">
  <span style="font-size: 48px; font-weight: bold; color: ${healthColor};">${healthEmoji} ${healthScore}</span>
  <p style="color: #888; font-size: 13px; margin: 4px 0;">健康评分（满分100）</p>
</div>

<!-- 概览卡片 -->
<div style="display: flex; gap: 10px; margin-bottom: 25px; flex-wrap: wrap;">
  ${overviewCard('请求数', httpStats.total.toLocaleString(), '#3498db')}
  ${overviewCard('错误', totalErrors, totalErrors > 0 ? '#e74c3c' : '#27ae60')}
  ${overviewCard('告警', totalWarns, totalWarns > 5 ? '#f39c12' : '#27ae60')}
  ${overviewCard('异常', totalExceptions, totalExceptions > 0 ? '#e74c3c' : '#27ae60')}
  ${overviewCard('4xx', httpStats.status4xx, httpStats.status4xx > 10 ? '#f39c12' : '#27ae60')}
  ${overviewCard('5xx', httpStats.status5xx, httpStats.status5xx > 0 ? '#e74c3c' : '#27ae60')}
  ${overviewCard('PM2重启', pm2Status.restarts, pm2Status.restarts > 0 ? '#f39c12' : '#27ae60')}
</div>

<!-- 错误详情 -->
${errorGroups.length > 0 ? `
<h2 style="font-size: 16px; color: #e74c3c; border-bottom: 2px solid #e74c3c; padding-bottom: 8px;">🔴 错误详情 (${totalErrors})</h2>
<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
  <tr style="background: #ffeaea;">
    <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">错误消息</th>
    <th style="width: 50px; text-align: center; padding: 8px; border-bottom: 1px solid #ddd;">次数</th>
    <th style="width: 70px; text-align: center; padding: 8px; border-bottom: 1px solid #ddd;">最近发生</th>
  </tr>
  ${errorGroups.slice(0, 15).map((g, i) => `
  <tr style="background: ${i % 2 === 0 ? '#fff' : '#fafafa'};">
    <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-all;">${escapeHtml(g.message)}</td>
    <td style="text-align: center; padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: ${g.count >= 10 ? '#e74c3c' : '#333'};">${g.count}</td>
    <td style="text-align: center; padding: 8px; border-bottom: 1px solid #eee;">${formatTime(g.lastTime)}</td>
  </tr>`).join('')}
</table>

<!-- 错误分析与建议 -->
<h3 style="font-size: 14px; color: #555;">💡 分析与建议</h3>
${errorGroups.slice(0, 8).map(g => `
<div style="background: #f8f9fa; padding: 10px 14px; margin: 8px 0; border-left: 3px solid #667eea; border-radius: 0 6px 6px 0; font-size: 13px;">
  <strong style="color: #e74c3c;">[${g.count}次]</strong> ${escapeHtml(g.message.substring(0, 100))}
  <br><span style="color: #666;">→ ${suggestFix(g.message)}</span>
</div>`).join('')}

<!-- 原始日志示例 -->
<details style="margin: 15px 0;">
  <summary style="cursor: pointer; font-size: 14px; color: #667eea; font-weight: 600;">📋 查看原始日志示例</summary>
  ${errorGroups.slice(0, 5).map(g => `
  <div style="background: #1e1e1e; color: #d4d4d4; padding: 10px; margin: 8px 0; border-radius: 6px; font-size: 11px; font-family: monospace; overflow-x: auto; white-space: pre-wrap;">
${g.samples.map(s => escapeHtml(s)).join('\n---\n')}</div>`).join('')}
</details>
` : '<p style="color: #27ae60; font-size: 14px;">✅ 过去 ${hoursBack} 小时内无错误日志</p>'}

<!-- 告警详情 -->
${warnGroups.length > 0 ? `
<h2 style="font-size: 16px; color: #f39c12; border-bottom: 2px solid #f39c12; padding-bottom: 8px;">⚠️ 告警详情 (${totalWarns})</h2>
<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
  <tr style="background: #fff8e1;">
    <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">告警消息</th>
    <th style="width: 50px; text-align: center; padding: 8px; border-bottom: 1px solid #ddd;">次数</th>
    <th style="width: 70px; text-align: center; padding: 8px; border-bottom: 1px solid #ddd;">最近发生</th>
  </tr>
  ${warnGroups.slice(0, 10).map((g, i) => `
  <tr style="background: ${i % 2 === 0 ? '#fff' : '#fafafa'};">
    <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-all;">${escapeHtml(g.message)}</td>
    <td style="text-align: center; padding: 8px; border-bottom: 1px solid #eee;">${g.count}</td>
    <td style="text-align: center; padding: 8px; border-bottom: 1px solid #eee;">${formatTime(g.lastTime)}</td>
  </tr>`).join('')}
</table>` : ''}

<!-- HTTP 错误端点 -->
${httpStats.topErrors.length > 0 ? `
<h2 style="font-size: 16px; color: #8e44ad; border-bottom: 2px solid #8e44ad; padding-bottom: 8px;">🌐 HTTP 错误端点 Top 10</h2>
<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
  ${httpStats.topErrors.map(([endpoint, count], i) => `
  <tr style="background: ${i % 2 === 0 ? '#fff' : '#fafafa'};">
    <td style="padding: 6px 8px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 12px;">${escapeHtml(endpoint)}</td>
    <td style="width: 50px; text-align: center; padding: 6px 8px; border-bottom: 1px solid #eee;">${count}</td>
  </tr>`).join('')}
</table>` : ''}

<!-- 未捕获异常 -->
${exceptionGroups.length > 0 ? `
<h2 style="font-size: 16px; color: #c0392b; border-bottom: 2px solid #c0392b; padding-bottom: 8px;">💥 未捕获异常 (${totalExceptions})</h2>
${exceptionGroups.map(g => `
<div style="background: #fdf2f2; padding: 12px; margin: 8px 0; border-left: 4px solid #c0392b; border-radius: 0 6px 6px 0;">
  <strong>[${g.count}次]</strong> ${escapeHtml(g.message.substring(0, 200))}
  <div style="font-size: 11px; font-family: monospace; margin-top: 6px; color: #666; white-space: pre-wrap;">${g.samples[0] ? escapeHtml(g.samples[0]) : ''}</div>
</div>`).join('')}` : ''}

<!-- 系统状态 -->
<h2 style="font-size: 16px; color: #2c3e50; border-bottom: 2px solid #bdc3c7; padding-bottom: 8px;">🖥️ 系统状态</h2>
<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px;">
  <tr><td style="padding: 6px 0; color: #888; width: 120px;">PM2 实例</td><td>${pm2Status.online}/${pm2Status.total} 在线</td></tr>
  <tr><td style="padding: 6px 0; color: #888;">PM2 运行时间</td><td>${pm2Status.uptime}</td></tr>
  <tr><td style="padding: 6px 0; color: #888;">内存使用</td><td>${pm2Status.memory > 0 ? pm2Status.memory + ' MB' : 'N/A'}</td></tr>
  <tr><td style="padding: 6px 0; color: #888;">磁盘使用</td><td>${systemStatus.disk}</td></tr>
  <tr><td style="padding: 6px 0; color: #888;">系统负载</td><td>${systemStatus.load}</td></tr>
  <tr><td style="padding: 6px 0; color: #888;">MongoDB 备份</td><td>${systemStatus.lastBackup}</td></tr>
  <tr><td style="padding: 6px 0; color: #888;">MySQL 同步</td><td>${systemStatus.mysqlSync}</td></tr>
  ${systemStatus.docker.map(d => `<tr><td style="padding: 6px 0; color: #888;">Docker</td><td>${d}</td></tr>`).join('')}
</table>

<p style="color: #aaa; font-size: 11px; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
  此报告由 daily-log-report.js 自动生成 | ${formatDate(new Date())}
</p>

</div>
</body>
</html>`;
}

function overviewCard(label, value, color) {
  return `<div style="flex: 1; min-width: 80px; text-align: center; background: ${color}11; border: 1px solid ${color}33; border-radius: 8px; padding: 10px 8px;">
    <div style="font-size: 22px; font-weight: bold; color: ${color};">${value}</div>
    <div style="font-size: 11px; color: #888; margin-top: 2px;">${label}</div>
  </div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// 邮件发送
// ============================================================

async function sendEmail(html, subject) {
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport(CONFIG.smtp);

  await transporter.sendMail({
    from: CONFIG.mailFrom,
    to: CONFIG.mailTo,
    subject,
    html,
  });

  console.log(`✅ 邮件已发送至 ${CONFIG.mailTo}`);
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const now = new Date();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 日志巡检开始: ${formatDate(now)}`);
  console.log(`   分析时间范围: ${formatDate(cutoffTime)} ~ ${formatDate(now)}`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. 读取并解析所有日志
  const logDir = CONFIG.logDir;

  const errorLines = readLogFile(path.join(logDir, CONFIG.logFiles.error));
  const warnLines = readLogFile(path.join(logDir, CONFIG.logFiles.warn));
  const combinedLines = readLogFile(path.join(logDir, CONFIG.logFiles.combined));
  const exceptionLines = readLogFile(path.join(logDir, CONFIG.logFiles.exceptions));
  const rejectionLines = readLogFile(path.join(logDir, CONFIG.logFiles.rejections));
  const pm2OutLines = readLogFile(path.join(logDir, CONFIG.logFiles.pm2Out));
  const pm2ErrorLines = readLogFile(path.join(logDir, CONFIG.logFiles.pm2Error));

  console.log(`📁 日志文件统计:`);
  console.log(`   error.log:       ${errorLines.length} 行`);
  console.log(`   warn.log:        ${warnLines.length} 行`);
  console.log(`   combined.log:    ${combinedLines.length} 行`);
  console.log(`   exceptions.log:  ${exceptionLines.length} 行`);
  console.log(`   rejections.log:  ${rejectionLines.length} 行`);
  console.log(`   pm2-out.log:     ${pm2OutLines.length} 行`);
  console.log(`   pm2-error.log:   ${pm2ErrorLines.length} 行`);

  // 2. 解析日志条目
  const errorEntries = filterByTime(errorLines.map(parseWinstonLine), cutoffTime);
  const warnEntries = filterByTime(warnLines.map(parseWinstonLine), cutoffTime);
  const combinedEntries = filterByTime(combinedLines.map(parseWinstonLine), cutoffTime);
  const exceptionEntries = filterByTime(
    [...exceptionLines, ...rejectionLines].map(parseWinstonLine), cutoffTime
  );
  const pm2ErrorEntries = filterByTime(pm2ErrorLines.map(parsePM2Line), cutoffTime)
    .filter(e => e.level === 'error');

  // 合并所有错误
  const allErrors = [...errorEntries, ...pm2ErrorEntries];

  console.log(`\n📊 过去 ${hoursBack} 小时内:`);
  console.log(`   错误条目: ${allErrors.length}`);
  console.log(`   告警条目: ${warnEntries.length}`);
  console.log(`   异常条目: ${exceptionEntries.length}`);

  // 3. 分析
  const errorGroups = analyzeEntries(allErrors);
  const warnGroups = analyzeEntries(warnEntries);
  const exceptionGroups = analyzeEntries(exceptionEntries);
  const httpStats = analyzeHttpRequests(pm2OutLines, cutoffTime);

  console.log(`   HTTP 请求数: ${httpStats.total}`);
  console.log(`   HTTP 4xx: ${httpStats.status4xx}, 5xx: ${httpStats.status5xx}`);

  // 4. 获取系统状态
  const pm2Status = getPM2Status();
  const systemStatus = getSystemStatus();

  console.log(`\n🖥️  PM2: ${pm2Status.online}/${pm2Status.total} 在线, ${pm2Status.restarts} 次重启, ${pm2Status.memory}MB 内存`);
  console.log(`   磁盘: ${systemStatus.disk}, 负载: ${systemStatus.load}`);

  // 5. 生成报告
  const report = {
    errorGroups,
    warnGroups,
    exceptionGroups,
    httpStats,
    pm2Status,
    systemStatus,
    timeRange: { from: cutoffTime, to: now },
  };

  const html = generateHTML(report);

  const totalErrors = errorGroups.reduce((s, g) => s + g.count, 0);
  const totalExceptions = exceptionGroups.reduce((s, g) => s + g.count, 0);

  let statusEmoji = '✅';
  if (totalErrors > 0 || totalExceptions > 0) statusEmoji = '⚠️';
  if (totalErrors > 20 || totalExceptions > 0 || pm2Status.restarts > 5) statusEmoji = '🔴';

  const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;
  const subject = `${statusEmoji} 晨读营日志巡检 ${dateStr} | 错误${totalErrors} 告警${warnGroups.reduce((s, g) => s + g.count, 0)}`;

  // 6. 发送或输出
  if (isTestMode) {
    console.log(`\n📧 [测试模式] 邮件主题: ${subject}`);
    console.log(`   邮件 HTML 长度: ${html.length} 字符`);
    // 写入临时文件方便预览
    const tmpFile = '/tmp/daily-log-report.html';
    fs.writeFileSync(tmpFile, html);
    console.log(`   HTML 已保存到: ${tmpFile}`);
    console.log(`   可用浏览器打开预览`);
  } else {
    if (!CONFIG.smtp.auth.pass) {
      console.error('❌ 未配置 QQ_SMTP_PASS 环境变量，无法发送邮件');
      console.error('   请设置: export QQ_SMTP_PASS="你的QQ邮箱授权码"');
      // 仍然保存报告到文件
      const reportFile = path.join(logDir, `daily-report-${now.toISOString().slice(0, 10)}.html`);
      fs.writeFileSync(reportFile, html);
      console.log(`   报告已保存到: ${reportFile}`);
      process.exit(1);
    }

    try {
      await sendEmail(html, subject);
    } catch (err) {
      console.error(`❌ 邮件发送失败: ${err.message}`);
      // 保存到文件作为备份
      const reportFile = path.join(logDir, `daily-report-${now.toISOString().slice(0, 10)}.html`);
      fs.writeFileSync(reportFile, html);
      console.log(`   报告已保存到: ${reportFile}`);
      process.exit(1);
    }
  }

  console.log(`\n✅ 日志巡检完成\n`);
}

main().catch(err => {
  console.error(`❌ 脚本执行失败: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
