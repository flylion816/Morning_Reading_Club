/**
 * 环境配置文件
 * 根据不同环境切换配置
 */

// 当前环境 ('dev' | 'test' | 'prod')
const currentEnv = 'dev';

// 环境配置
const envConfig = {
  // 开发环境
  dev: {
    apiBaseUrl: 'http://localhost:3000/api/v1',
    wxAppId: 'wx199d6d332344ed0a',
    enableDebug: true,
    enableLog: true,
    useMock: false  // 使用本地后端服务
  },

  // 测试环境
  test: {
    apiBaseUrl: 'https://test-api.morning-reading.com/api/v1',
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
    enableLog: false,
    useMock: false
  }
};

// 导出当前环境配置
module.exports = {
  ...envConfig[currentEnv],
  currentEnv
};
