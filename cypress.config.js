/**
 * Cypress 配置文件
 * 定义 E2E 测试的基础设置
 */

module.exports = {
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    setupNodeEvents(on, config) {
      // 插件配置
    }
  }
};
