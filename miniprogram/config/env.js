/**
 * 环境配置文件 - 小程序版
 *
 * 📌 同步说明：此配置与根目录 .env.config.js 保持同步
 * 当修改根目录 .env.config.js 的 currentEnv 时，也请更新这里的 currentEnv 值
 *
 * 步骤：
 * 1. 编辑根目录 .env.config.js，修改 currentEnv 值
 * 2. 编辑此文件，修改下面的 currentEnv 值为相同值
 * 3. 重启小程序开发工具
 */

// 当前环境 ('dev' | 'test' | 'prod')
// 📌 注意：小程序可独立配置，不必与根目录 .env.config.js 同步
//    根目录 .env.config.js 控制后端和管理后台
//    此文件控制小程序开发工具连接的环境
const currentEnv = 'prod'; // ← 开发环境 (本地后端 localhost:3000)

// 环境配置
const envConfig = {
  // 开发环境
  dev: {
    apiBaseUrl: 'http://localhost:3000/api/v1',
    wxAppId: 'wx199d6d332344ed0a',
    enableDebug: true,
    enableLog: true,
    useMock: true // 使用 Mock 数据进行本地测试
  },

  // 测试环境
  test: {
    apiBaseUrl: 'https://wx.shubai01.com/api/v1',
    wxAppId: 'wx199d6d332344ed0a',
    enableDebug: true,
    enableLog: true,
    useMock: false
  },

  // 生产环境
  prod: {
    apiBaseUrl: 'https://wx.shubai01.com/api/v1',
    wxAppId: 'wx2b9a3c1d5e4195f8',
    enableDebug: false,
    enableLog: true, // ✅ 启用日志便于调试
    useMock: false
  }
};

// 调试输出（开发环境用）
console.log('[ENV DEBUG] currentEnv:', currentEnv);
console.log('[ENV DEBUG] apiBaseUrl:', envConfig[currentEnv].apiBaseUrl);

// 导出当前环境配置
module.exports = {
  ...envConfig[currentEnv],
  currentEnv
};
