function normalizeMeetingTarget(target) {
  if (!target || typeof target !== 'string') {
    return '';
  }

  const trimmedTarget = target.trim();
  const allowedHostPattern = /^https:\/\/(meeting\.tencent\.com|wemeet\.qq\.com|voovmeeting\.com)\//i;
  return allowedHostPattern.test(trimmedTarget) ? trimmedTarget : '';
}

function normalizeMeetingId(meetingId) {
  if (!meetingId || typeof meetingId !== 'string') {
    return '';
  }

  return meetingId.replace(/[^\d\s-]/g, '').trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLaunchHtml({ target, meetingId }) {
  const safeTarget = escapeHtml(target);
  const safeMeetingId = escapeHtml(meetingId);
  const meetingIdSection = meetingId
    ? `<div class="meeting-id">会议号：${safeMeetingId}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <title>打开腾讯会议</title>
    <style>
      :root {
        color-scheme: light;
        --bg: linear-gradient(180deg, #eef5ff 0%, #ffffff 100%);
        --text: #123a6b;
        --muted: #6c7f99;
        --primary: #1a73e8;
        --primary-dark: #0e5ecf;
        --card: rgba(255, 255, 255, 0.92);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg);
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
        color: var(--text);
        padding: 24px;
      }
      .card {
        width: min(520px, 100%);
        background: var(--card);
        border-radius: 24px;
        box-shadow: 0 18px 48px rgba(17, 56, 105, 0.12);
        padding: 32px 28px;
      }
      .title {
        margin: 0 0 12px;
        font-size: 28px;
        line-height: 1.2;
      }
      .desc {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
      }
      .meeting-id {
        margin-top: 18px;
        padding: 12px 14px;
        border-radius: 14px;
        background: #f3f7ff;
        font-weight: 600;
      }
      .actions {
        margin-top: 24px;
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .btn {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 12px 22px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .btn:hover {
        transform: translateY(-1px);
      }
      .btn-primary {
        background: var(--primary);
        color: #fff;
      }
      .btn-primary:hover {
        background: var(--primary-dark);
      }
      .btn-secondary {
        background: #eaf1fb;
        color: var(--text);
      }
      .tips {
        margin-top: 18px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.7;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1 class="title">正在打开腾讯会议</h1>
      <p class="desc">
        如果没有自动跳起，请点击下方按钮继续。若当前环境阻止自动打开，可复制会议号后手动加入。
      </p>
      ${meetingIdSection}
      <div class="actions">
        <a class="btn btn-primary" id="open-link" href="${safeTarget}">立即打开腾讯会议</a>
        <button class="btn btn-secondary" id="copy-btn" type="button">复制会议号</button>
      </div>
      <div class="tips">
        提示：第一次打开时，系统可能会要求确认是否唤起腾讯会议客户端。
      </div>
    </div>
    <script>
      (function () {
        var target = ${JSON.stringify(target)};
        var meetingId = ${JSON.stringify(meetingId)};
        var copyBtn = document.getElementById('copy-btn');

        if (!meetingId) {
          copyBtn.style.display = 'none';
        } else {
          copyBtn.addEventListener('click', async function () {
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(meetingId);
                copyBtn.textContent = '已复制会议号';
              }
            } catch (error) {
              copyBtn.textContent = '复制失败，请手动复制';
            }
          });
        }

        setTimeout(function () {
          window.location.href = target;
        }, 120);
      })();
    </script>
  </body>
</html>`;
}

function openMeetingLaunchPage(req, res) {
  const target = normalizeMeetingTarget(req.query.target);
  const meetingId = normalizeMeetingId(req.query.meetingId);

  if (!target) {
    return res.status(400).type('html').send(`
      <!DOCTYPE html>
      <html lang="zh-CN">
        <head><meta charset="UTF-8" /><title>链接无效</title></head>
        <body style="font-family: sans-serif; padding: 24px;">腾讯会议邀请链接无效或未配置。</body>
      </html>
    `);
  }

  return res.status(200).type('html').send(buildLaunchHtml({ target, meetingId }));
}

module.exports = {
  openMeetingLaunchPage
};
