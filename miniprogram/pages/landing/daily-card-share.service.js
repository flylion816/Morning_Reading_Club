// 扫日签上的小程序码进来：按短码读取这张日签的内容。
// 只有 landing 分包在用，放在分包里，不放主包的 services（生成短码的 create 在日签分包里）。
const request = require('../../utils/request');

module.exports = {
  resolve(code) {
    return request.get(`/daily-card-shares/${encodeURIComponent(code)}`, {}, { suppressError: true });
  }
};
