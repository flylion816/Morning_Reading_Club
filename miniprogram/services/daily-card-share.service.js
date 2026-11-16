const request = require('../utils/request');

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
  },
  resolve(code) {
    return request.get(`/daily-card-shares/${encodeURIComponent(code)}`, {}, { suppressError: true });
  }
};
