/**
 * 阅读分享：「分享此刻」海报上的小程序码，扫码后定位到课文和段落
 */
const request = require('../../utils/request');

function getEnvVersion() {
  try {
    const info = typeof wx.getAccountInfoSync === 'function' ? wx.getAccountInfoSync() : null;
    return (info && info.miniProgram && info.miniProgram.envVersion) || 'release';
  } catch (error) {
    return 'release';
  }
}

class ReadingShareService {
  // 返回 { code, imageBase64 }
  create({ sectionId, paragraphIndex, quote }) {
    return request.post(
      '/reading-shares',
      { sectionId, paragraphIndex, quote, envVersion: getEnvVersion() },
      { suppressError: true }
    );
  }

  // 访客也能调用：用短码换回课程、段落和分享人
  resolve(code) {
    return request.get(`/reading-shares/${encodeURIComponent(code)}`, {}, { suppressError: true });
  }
}

module.exports = new ReadingShareService();
