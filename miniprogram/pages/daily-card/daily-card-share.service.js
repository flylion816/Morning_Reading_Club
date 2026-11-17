// 日签分享码：保存日签时向后端要一个只带短码的小程序码。
// 只有日签分包在用，放在分包里，不放主包的 services（扫码后读取日签的 resolve 在 landing 分包里）。
const request = require('../../utils/request');

function getEnvVersion() {
  try {
    const info = typeof wx.getAccountInfoSync === 'function' ? wx.getAccountInfoSync() : null;
    return (info && info.miniProgram && info.miniProgram.envVersion) || 'release';
  } catch (error) {
    return 'release';
  }
}

module.exports = {
  create(snapshot) {
    return request.post('/daily-card-shares', { ...snapshot, envVersion: getEnvVersion() }, { suppressError: true });
  }
};
