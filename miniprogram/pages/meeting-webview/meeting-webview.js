const envConfig = require('../../config/env');

function normalizeMeetingUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const decodedUrl = decodeURIComponent(url).trim();
  const allowedHostPattern = /^https:\/\/(meeting\.tencent\.com|wemeet\.qq\.com|voovmeeting\.com)\//i;
  return allowedHostPattern.test(decodedUrl) ? decodedUrl : '';
}

function getRelayBaseUrl() {
  const apiBaseUrl = envConfig.apiBaseUrl || '';
  return apiBaseUrl.replace(/\/api\/v1\/?$/i, '');
}

function buildRelayUrl(targetUrl, meetingId) {
  const relayBaseUrl = getRelayBaseUrl();
  if (!relayBaseUrl) {
    return '';
  }

  return (
    `${relayBaseUrl}/meeting-launch?target=${encodeURIComponent(targetUrl)}` +
    `&meetingId=${encodeURIComponent(meetingId || '')}`
  );
}

Page({
  data: {
    url: '',
    meetingId: ''
  },

  onLoad(options) {
    const meetingId = decodeURIComponent(options.meetingId || '');
    const targetUrl = normalizeMeetingUrl(options.url || '');
    const relayUrl = buildRelayUrl(targetUrl, meetingId);

    if (!targetUrl || !relayUrl) {
      this.promptFallback(meetingId, '腾讯会议邀请链接无效或未配置。');
      return;
    }

    this.setData({ url: relayUrl, meetingId });
  },

  handleLoad() {
    console.log('腾讯会议邀请链接加载成功');
  },

  handleError() {
    this.promptFallback(this.data.meetingId, '当前环境无法打开腾讯会议邀请链接。');
  },

  promptFallback(meetingId, prefix = '') {
    const contentParts = [];
    if (prefix) {
      contentParts.push(prefix);
    }
    if (meetingId) {
      contentParts.push(`请手动打开腾讯会议APP，输入会议号：${meetingId}`);
    } else {
      contentParts.push('请在浏览器中打开腾讯会议邀请链接，或手动打开腾讯会议APP加入会议。');
    }

    wx.showModal({
      title: '无法直接打开腾讯会议',
      content: contentParts.join('\n'),
      confirmText: meetingId ? '复制会议号' : '知道了',
      cancelText: '返回',
      success: res => {
        if (res.confirm && meetingId) {
          wx.setClipboardData({ data: meetingId });
          return;
        }

        wx.navigateBack({ delta: 1 });
      }
    });
  }
});
