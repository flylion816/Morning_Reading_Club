#!/usr/bin/env node
/**
 * 晨读营 - 每日日志问题自动诊断
 *
 * 功能：读取 daily-log-report 生成的 JSON 摘要 → 归类已知问题 → 发送诊断邮件
 *
 * 使用方式：
 *   node diagnose-daily-report.js
 *   node diagnose-daily-report.js --input /var/www/logs/daily-report-latest.json
 *   node diagnose-daily-report.js --test
 */

const fs = require('fs');
const path = require('path');
const { buildDiagnosis } = require('../src/services/daily-report-diagnosis.service');

const CONFIG = {
  logDir: '/var/www/logs',
  inputFile: '/var/www/logs/daily-report-latest.json',
  outputFiles: {
    latestHtml: 'daily-diagnosis-latest.html',
    latestJson: 'daily-diagnosis-latest.json',
  },
  smtp: {
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
      user: '308965039@qq.com',
      pass: process.env.QQ_SMTP_PASS || '',
    }
  },
  mailTo: '308965039@qq.com',
  mailFrom: '"晨读营服务器" <308965039@qq.com>',
};

const args = process.argv.slice(2);
const isTestMode = args.includes('--test');
const inputIdx = args.indexOf('--input');
const inputFile = inputIdx !== -1 ? args[inputIdx + 1] : CONFIG.inputFile;

function formatDate(dateLike) {
  const date = new Date(dateLike);
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function severityBadge(severity) {
  if (severity === 'high') return { text: '高', color: '#e74c3c', bg: '#fdecea' };
  if (severity === 'medium') return { text: '中', color: '#f39c12', bg: '#fff4e5' };
  return { text: '低', color: '#27ae60', bg: '#eafaf1' };
}

function categoryLabel(category) {
  if (category === 'actionable') return '需处理';
  if (category === 'derived') return '派生告警';
  if (category === 'noise') return '噪音';
  if (category === 'normal') return '正常现象';
  return '未分类';
}

function buildSubject(reportSummary, diagnosis) {
  const reportDate = new Date(reportSummary.timeRange.to);
  const dateStr = `${reportDate.getMonth() + 1}/${reportDate.getDate()}`;
  if (diagnosis.counts.actionable > 0) {
    return `🩺 晨读营问题诊断 ${dateStr} | 待处理${diagnosis.counts.actionable}类`;
  }
  if (diagnosis.counts.noise > 0 || diagnosis.counts.derived > 0) {
    return `🩺 晨读营问题诊断 ${dateStr} | 主要为噪音/派生告警`;
  }
  return `🩺 晨读营问题诊断 ${dateStr} | 无需处理`;
}

function generateHTML(reportSummary, diagnosis) {
  const topIssues = diagnosis.issues.slice(0, 10);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 760px; margin: 0 auto; padding: 20px; background: #f5f5f5; color: #333;">

<div style="background: linear-gradient(135deg, #0f766e 0%, #2563eb 100%); color: white; padding: 20px 25px; border-radius: 12px 12px 0 0;">
  <h1 style="margin: 0; font-size: 20px;">🩺 晨读营日志问题诊断报告</h1>
  <p style="margin: 8px 0 0; opacity: 0.9; font-size: 13px;">
    原始日报窗口: ${formatDate(reportSummary.timeRange.from)} ~ ${formatDate(reportSummary.timeRange.to)}
  </p>
</div>

<div style="background: white; padding: 20px 25px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

<div style="margin-bottom: 20px; padding: 14px 16px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0;">
  <div style="font-size: 18px; font-weight: 700; margin-bottom: 6px;">${escapeHtml(diagnosis.summary.headline)}</div>
  <div style="font-size: 13px; color: #666;">生成时间：${formatDate(diagnosis.generatedAt)} | 报告ID：${escapeHtml(reportSummary.reportId)}</div>
</div>

<div style="display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap;">
  ${overviewCard('待处理', diagnosis.counts.actionable, '#e74c3c')}
  ${overviewCard('派生告警', diagnosis.counts.derived, '#f39c12')}
  ${overviewCard('噪音', diagnosis.counts.noise, '#64748b')}
  ${overviewCard('正常现象', diagnosis.counts.normal, '#16a34a')}
  ${overviewCard('可自动修复', diagnosis.counts.autoRepairEligible, '#2563eb')}
</div>

${diagnosis.counts.actionable > 0 ? `
<h2 style="font-size: 16px; color: #e74c3c; border-bottom: 2px solid #e74c3c; padding-bottom: 8px;">需要优先处理的问题</h2>
${diagnosis.actionableIssues.map(renderIssueCard).join('')}
` : ''}

${diagnosis.counts.derived > 0 ? `
<h2 style="font-size: 16px; color: #f39c12; border-bottom: 2px solid #f39c12; padding-bottom: 8px;">派生告警</h2>
${diagnosis.derivedIssues.map(renderIssueCard).join('')}
` : ''}

${diagnosis.counts.noise > 0 ? `
<h2 style="font-size: 16px; color: #64748b; border-bottom: 2px solid #64748b; padding-bottom: 8px;">低优先级噪音</h2>
${diagnosis.noiseIssues.map(renderIssueCard).join('')}
` : ''}

${diagnosis.counts.normal > 0 ? `
<h2 style="font-size: 16px; color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 8px;">正常现象</h2>
${diagnosis.normalIssues.map(renderIssueCard).join('')}
` : ''}

<details style="margin-top: 18px;">
  <summary style="cursor: pointer; font-size: 14px; color: #2563eb; font-weight: 600;">查看原始错误摘要</summary>
  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px;">
    <tr style="background: #f8fafc;">
      <th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">错误消息</th>
      <th style="width: 60px; text-align: center; padding: 8px; border-bottom: 1px solid #ddd;">次数</th>
    </tr>
    ${topIssues.map((issue, index) => `
    <tr style="background: ${index % 2 === 0 ? '#fff' : '#fafafa'};">
      <td style="padding: 8px; border-bottom: 1px solid #eee; word-break: break-all;">${escapeHtml(issue.message)}</td>
      <td style="text-align: center; padding: 8px; border-bottom: 1px solid #eee;">${issue.count}</td>
    </tr>`).join('')}
  </table>
</details>

<p style="color: #aaa; font-size: 11px; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
  此报告由 diagnose-daily-report.js 自动生成 | ${formatDate(new Date())}
</p>

</div>
</body>
</html>`;
}

function renderIssueCard(issue) {
  const badge = severityBadge(issue.severity);
  return `<div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin: 12px 0;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
      <div style="font-size: 15px; font-weight: 700;">${escapeHtml(issue.summary)}</div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span style="padding: 2px 8px; border-radius: 999px; background: ${badge.bg}; color: ${badge.color}; font-size: 12px; font-weight: 700;">${badge.text}优先级</span>
        <span style="padding: 2px 8px; border-radius: 999px; background: #f1f5f9; color: #334155; font-size: 12px;">${categoryLabel(issue.category)}</span>
        <span style="font-size: 12px; color: #64748b;">${issue.count} 次</span>
      </div>
    </div>
    <div style="font-size: 13px; color: #444; margin-top: 10px;"><strong>根因判断：</strong>${escapeHtml(issue.likelyCause)}</div>
    <div style="font-size: 13px; color: #444; margin-top: 8px;"><strong>建议动作：</strong>${escapeHtml(issue.recommendedAction)}</div>
    ${issue.samples && issue.samples.length > 0 ? `
    <details style="margin-top: 10px;">
      <summary style="cursor: pointer; font-size: 12px; color: #2563eb;">查看样例日志</summary>
      <div style="background: #111827; color: #d1d5db; padding: 10px; margin-top: 8px; border-radius: 6px; font-size: 11px; font-family: monospace; white-space: pre-wrap;">
${issue.samples.map(sample => escapeHtml(sample)).join('\n---\n')}
      </div>
    </details>` : ''}
  </div>`;
}

function overviewCard(label, value, color) {
  return `<div style="flex: 1; min-width: 100px; text-align: center; background: ${color}11; border: 1px solid ${color}33; border-radius: 8px; padding: 10px 8px;">
    <div style="font-size: 22px; font-weight: bold; color: ${color};">${value}</div>
    <div style="font-size: 11px; color: #888; margin-top: 2px;">${label}</div>
  </div>`;
}

async function sendEmail(html, subject) {
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport(CONFIG.smtp);

  await transporter.sendMail({
    from: CONFIG.mailFrom,
    to: CONFIG.mailTo,
    subject,
    html,
  });

  console.log(`✅ 诊断邮件已发送至 ${CONFIG.mailTo}`);
}

function resolveOutputDir() {
  try {
    if (fs.existsSync(CONFIG.logDir)) {
      fs.accessSync(CONFIG.logDir, fs.constants.W_OK);
      return CONFIG.logDir;
    }
  } catch (err) {
    // fall through to tmp
  }

  const fallbackDir = path.join('/tmp', 'morning-reading-reports');
  fs.mkdirSync(fallbackDir, { recursive: true });
  return fallbackDir;
}

function writeArtifacts(html, diagnosis, reportSummary) {
  const outputDir = resolveOutputDir();
  const datePart = new Date(reportSummary.timeRange.to).toISOString().slice(0, 10);
  const htmlLatest = path.join(outputDir, CONFIG.outputFiles.latestHtml);
  const jsonLatest = path.join(outputDir, CONFIG.outputFiles.latestJson);
  const htmlArchive = path.join(outputDir, `daily-diagnosis-${datePart}.html`);
  const jsonArchive = path.join(outputDir, `daily-diagnosis-${datePart}.json`);
  const payload = {
    diagnosis,
    reportSummary,
  };

  fs.writeFileSync(htmlLatest, html);
  fs.writeFileSync(jsonLatest, JSON.stringify(payload, null, 2));
  fs.writeFileSync(htmlArchive, html);
  fs.writeFileSync(jsonArchive, JSON.stringify(payload, null, 2));

  return { htmlLatest, jsonLatest, htmlArchive, jsonArchive };
}

async function main() {
  if (!fs.existsSync(inputFile)) {
    throw new Error(`未找到日报 JSON：${inputFile}`);
  }

  const reportSummary = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const diagnosis = buildDiagnosis(reportSummary);
  const html = generateHTML(reportSummary, diagnosis);
  const subject = buildSubject(reportSummary, diagnosis);
  const artifacts = writeArtifacts(html, diagnosis, reportSummary);

  console.log(`📄 诊断结果已写入: ${artifacts.htmlLatest}`);
  console.log(`📄 诊断摘要已写入: ${artifacts.jsonLatest}`);

  if (isTestMode) {
    console.log(`📧 [测试模式] 诊断邮件主题: ${subject}`);
    return;
  }

  if (!CONFIG.smtp.auth.pass) {
    throw new Error('未配置 QQ_SMTP_PASS 环境变量，无法发送诊断邮件');
  }

  await sendEmail(html, subject);
}

main().catch(err => {
  console.error(`❌ 诊断脚本执行失败: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
