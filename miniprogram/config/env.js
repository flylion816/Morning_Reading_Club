/**
 * 环境配置文件 - 小程序版
 *
 * 职责：仅配置「连哪个后端、是否调试」（环境维度）
 * wxAppId 等租户信息由 config/current-tenant.js 提供（租户维度），两者正交。
 *
 * 切换环境：修改下面的 currentEnv 值并重启开发者工具
 * 切换租户：npm run tenant:apply -- <slug>
 */

// 当前环境 ('dev' | 'test' | 'prod')
// 📌 生产发布前必须为 prod
const currentEnv = 'prod';

const envConfig = {
  // 开发环境（连本地后端）
  dev: {
    apiBaseUrl: 'http://localhost:3000/api/v1',
    enableDebug: true,
    enableLog: true,
    useMock: false
  },

  // 测试环境
  test: {
    apiBaseUrl: 'https://wx.shubai01.com/api/v1',
    enableDebug: true,
    enableLog: true,
    useMock: false
  },

  // 生产环境
  prod: {
    apiBaseUrl: 'https://wx.shubai01.com/api/v1',
    enableDebug: false,
    enableLog: false,
    useMock: false
  }
};

module.exports = {
  ...envConfig[currentEnv],
  currentEnv
};
