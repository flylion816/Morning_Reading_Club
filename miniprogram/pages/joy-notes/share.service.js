/**
 * 随喜 / 觉察分享的接口（只有 joy-notes 分包里的页面和组件用）。
 * 读分享时 401 / 403 / 404 都不弹错误、也不跳登录页：由分享落地页统一回首页。
 */
const request = require('../../utils/request');

const quiet = { suppressError: true };
const quietNoRedirect = { suppressError: true, suppressAuthError: true };

function envVersion() {
  try {
    const info = typeof wx.getAccountInfoSync === 'function' ? wx.getAccountInfoSync() : null;
    return (info && info.miniProgram && info.miniProgram.envVersion) || 'release';
  } catch (error) {
    return 'release';
  }
}

module.exports = {
  // 开启（或取回）这条记录的分享：{ code, audience, created, periodLinked }
  open(noteId, audience) {
    return request.post('/joy-note-shares', { noteId, ...(audience ? { audience } : {}) }, quiet);
  },
  status(noteId) {
    return request.get(`/joy-note-shares/note/${encodeURIComponent(noteId)}`, {}, quiet);
  },
  // 停止分享：此前的链接和二维码立即失效
  revoke(noteId) {
    return request.delete(`/joy-note-shares/note/${encodeURIComponent(noteId)}`, {}, quiet);
  },
  // 长图上的小程序码：{ imageBase64, contentType }。页面还没发布正式版时带上当前环境，体验版也能生成
  qrcode(code) {
    return request.post(`/joy-note-shares/${encodeURIComponent(code)}/qrcode`, { envVersion: envVersion() }, quiet);
  },
  // 收到分享的人读这一页（必须登录）
  read(code) {
    return request.get(`/joy-note-shares/${encodeURIComponent(code)}`, {}, quietNoRedirect);
  }
};
