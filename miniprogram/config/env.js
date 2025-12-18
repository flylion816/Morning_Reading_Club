/**
 * 环境配置文件 - 小程序版
 *
 * 📌 重要提示：此文件现在从根目录的 .env.config.js 加载配置
 * 只需在根目录修改 .env.config.js 中的 currentEnv 即可同时控制：
 * 1. 小程序调用的 API 环境
 * 2. 后端连接的数据库环境
 * 3. 管理后台的服务环境
 */

// 加载根目录的统一环境配置
const rootConfig = require('../../.env.config');

const currentEnv = rootConfig.currentEnv;

// 从统一配置中提取小程序配置
const minimumProgramConfig = rootConfig.config.miniprogram;

// 导出当前环境配置
module.exports = {
  apiBaseUrl: minimumProgramConfig.apiBaseUrl,
  wxAppId: minimumProgramConfig.wxAppId,
  enableDebug: minimumProgramConfig.enableDebug,
  enableLog: minimumProgramConfig.enableLog,
  useMock: false, // 使用后端服务，不使用 mock 数据
  currentEnv
};
